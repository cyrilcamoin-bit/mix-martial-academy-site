const HELLOASSO_API = "https://api.helloasso.com";
const ORGANIZATION_SLUG = "mix-martial-academy";
const FORM_TYPE = "Membership";
const FORM_SLUG = "adhesion-mma-2026-2027";
const BIRTHDATE_FIELD = "Date de naissance de l'adhérent";
const ALLOWED_ORIGINS = new Set([
  "https://www.mma-lerove.fr",
  "https://mma-lerove.fr"
]);

let tokenCache = null;
let membersCache = { expiresAt: 0, data: [] };

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[-‐‑‒–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeDate(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const fr = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (fr) {
    return `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`;
  }

  return "";
}

function safeFilenamePart(value, fallback) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 -]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return normalized || fallback;
}

function certificateFileName(member) {
  const lastName = safeFilenamePart(member.lastName, "ADHERENT").toUpperCase();
  const firstRaw = safeFilenamePart(member.firstName, "Adherent");
  const firstName = firstRaw
    .split("_")
    .map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : "")
    .join("_");
  return `${lastName}_${firstName}.pdf`;
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://www.mma-lerove.fr";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Expose-Headers": "Content-Disposition",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(request, data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(request),
      ...extraHeaders
    }
  });
}

async function getAccessToken(env) {
  const now = Date.now();
  if (tokenCache?.accessToken && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.accessToken;
  }

  const response = await fetch(`${HELLOASSO_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.HELLOASSO_CLIENT_ID,
      client_secret: env.HELLOASSO_CLIENT_SECRET
    })
  });

  if (!response.ok) {
    throw new Error(`HelloAsso OAuth ${response.status}`);
  }

  const data = await response.json();
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + Number(data.expires_in || 1700) * 1000
  };
  return tokenCache.accessToken;
}

function getBirthDate(item) {
  const direct = normalizeDate(item?.user?.dateOfBirth);
  if (direct) return direct;

  const field = (item?.customFields || []).find(
    (entry) => normalizeText(entry?.name) === normalizeText(BIRTHDATE_FIELD)
  );
  return normalizeDate(field?.answer);
}

async function fetchMembershipItems(env) {
  const now = Date.now();
  if (membersCache.expiresAt > now && membersCache.data.length) {
    return membersCache.data;
  }

  const token = await getAccessToken(env);
  const all = [];
  const pageSize = 100;

  for (let pageIndex = 1; pageIndex <= 50; pageIndex += 1) {
    const url = new URL(
      `${HELLOASSO_API}/v5/organizations/${ORGANIZATION_SLUG}/forms/${FORM_TYPE}/${FORM_SLUG}/items`
    );
    url.searchParams.set("pageIndex", String(pageIndex));
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("withDetails", "true");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`HelloAsso items ${response.status}`);
    }

    const payload = await response.json();
    const page = Array.isArray(payload?.data) ? payload.data : [];
    all.push(...page);

    if (page.length < pageSize) break;
  }

  const members = all
    .filter((item) => String(item?.type || item?.tierType || "").toLowerCase() === "membership")
    .map((item) => ({
      memberId: item.id ?? null,
      firstName: String(item?.user?.firstName || "").trim(),
      lastName: String(item?.user?.lastName || "").trim(),
      birthDate: getBirthDate(item)
    }))
    .filter((member) => member.memberId != null && member.firstName && member.lastName && member.birthDate);

  membersCache = {
    expiresAt: now + 5 * 60 * 1000,
    data: members
  };

  return members;
}

function matches(member, body) {
  return (
    normalizeText(member.firstName) === normalizeText(body.firstName) &&
    normalizeText(member.lastName) === normalizeText(body.lastName) &&
    member.birthDate === normalizeDate(body.birthDate)
  );
}

function storageReady(env) {
  return Boolean(env.CERTIFICATES && typeof env.CERTIFICATES.put === "function");
}

function isAdmin(request, env) {
  return Boolean(
    env.ADMIN_API_TOKEN &&
    request.headers.get("Authorization") === `Bearer ${env.ADMIN_API_TOKEN}`
  );
}

async function certificateObjectForMember(env, memberId) {
  if (!storageReady(env)) return null;
  const listed = await env.CERTIFICATES.list({
    prefix: `certificates/${memberId}/`,
    limit: 10
  });
  return listed.objects && listed.objects.length ? listed.objects[0] : null;
}

async function removeExistingCertificate(env, memberId) {
  const listed = await env.CERTIFICATES.list({
    prefix: `certificates/${memberId}/`,
    limit: 20
  });
  for (const object of listed.objects || []) {
    await env.CERTIFICATES.delete(object.key);
  }
}

function crc32(bytes) {
  let crc = 0 ^ -1;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function u16(value) {
  return new Uint8Array([value & 255, (value >>> 8) & 255]);
}

function u32(value) {
  return new Uint8Array([
    value & 255,
    (value >>> 8) & 255,
    (value >>> 16) & 255,
    (value >>> 24) & 255
  ]);
}

function concat(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function createZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const dt = dosDateTime();

  for (const file of files) {
    const name = encoder.encode(file.name);
    const bytes = file.bytes;
    const crc = crc32(bytes);

    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(dt.time),
      u16(dt.day),
      u32(crc),
      u32(bytes.length),
      u32(bytes.length),
      u16(name.length),
      u16(0),
      name,
      bytes
    ]);
    localParts.push(local);

    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(dt.time),
      u16(dt.day),
      u32(crc),
      u32(bytes.length),
      u32(bytes.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name
    ]);
    centralParts.push(central);
    offset += local.length;
  }

  const central = concat(centralParts);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0)
  ]);

  return concat([...localParts, central, end]);
}

async function buildCertificateStatus(env) {
  const members = await fetchMembershipItems(env);
  const receivedIds = new Set();

  if (storageReady(env)) {
    let cursor;
    do {
      const page = await env.CERTIFICATES.list({
        prefix: "certificates/",
        limit: 1000,
        cursor
      });
      for (const object of page.objects || []) {
        const match = object.key.match(/^certificates\/([^/]+)\//);
        if (match) receivedIds.add(String(match[1]));
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }

  return members
    .map((member) => ({
      memberId: member.memberId,
      firstName: member.firstName,
      lastName: member.lastName,
      received: receivedIds.has(String(member.memberId))
    }))
    .sort((a, b) => {
      const last = a.lastName.localeCompare(b.lastName, "fr", { sensitivity: "base" });
      if (last !== 0) return last;
      return a.firstName.localeCompare(b.firstName, "fr", { sensitivity: "base" });
    });
}

async function downloadMembersZip(request, env, memberIds) {
  const members = await fetchMembershipItems(env);
  const wanted = new Set((memberIds || []).map(String));
  const selected = wanted.size
    ? members.filter((member) => wanted.has(String(member.memberId)))
    : members;

  const files = [];
  const usedNames = new Map();

  for (const member of selected) {
    const object = await certificateObjectForMember(env, member.memberId);
    if (!object) continue;

    const stored = await env.CERTIFICATES.get(object.key);
    if (!stored) continue;

    let name = certificateFileName(member);
    const seen = usedNames.get(name) || 0;
    usedNames.set(name, seen + 1);
    if (seen > 0) name = name.replace(/\.pdf$/i, `_${seen + 1}.pdf`);

    files.push({
      name,
      bytes: new Uint8Array(await stored.arrayBuffer())
    });
  }

  if (!files.length) {
    return json(request, { ok: false, error: "no_certificates" }, 404);
  }

  const zip = createZip(files);
  return new Response(zip, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="Certificats_MMA_2026-2027.zip"',
      "Cache-Control": "no-store",
      ...corsHeaders(request)
    }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);

    try {
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
        return json(request, {
          ok: true,
          service: "mma-lerove-api",
          helloAssoCampaign: FORM_SLUG,
          certificateStorage: storageReady(env),
          certificateDeletion: true
        });
      }

      if (request.method === "GET" && url.pathname === "/stats") {
        const members = await fetchMembershipItems(env);
        return json(request, {
          ok: true,
          campaign: FORM_SLUG,
          memberships: members.length
        });
      }

      if (request.method === "POST" && url.pathname === "/members/verify") {
        const body = await request.json().catch(() => null);
        if (!body?.firstName || !body?.lastName || !normalizeDate(body?.birthDate)) {
          return json(request, { ok: false, error: "invalid_request" }, 400);
        }

        const members = await fetchMembershipItems(env);
        const member = members.find((entry) => matches(entry, body));

        if (!member) {
          return json(request, { ok: false });
        }

        return json(request, {
          ok: true,
          memberId: member.memberId
        });
      }

      if (request.method === "POST" && url.pathname === "/certificates/upload") {
        if (!storageReady(env)) {
          return json(request, { ok: false, error: "storage_not_configured" }, 503);
        }

        const form = await request.formData();
        const firstName = String(form.get("firstName") || "").trim();
        const lastName = String(form.get("lastName") || "").trim();
        const birthDate = String(form.get("birthDate") || "").trim();
        const file = form.get("file");

        if (!firstName || !lastName || !normalizeDate(birthDate) || !(file instanceof File)) {
          return json(request, { ok: false, error: "invalid_request" }, 400);
        }

        if (file.size <= 0 || file.size > 15 * 1024 * 1024) {
          return json(request, { ok: false, error: "invalid_file_size" }, 400);
        }

        if (String(file.type || "").toLowerCase() !== "application/pdf") {
          return json(request, { ok: false, error: "pdf_required" }, 400);
        }

        const members = await fetchMembershipItems(env);
        const member = members.find((entry) => matches(entry, { firstName, lastName, birthDate }));
        if (!member) {
          return json(request, { ok: false, error: "member_not_found" }, 404);
        }

        const fileName = certificateFileName(member);
        const key = `certificates/${member.memberId}/${fileName}`;

        await removeExistingCertificate(env, member.memberId);
        await env.CERTIFICATES.put(key, file.stream(), {
          httpMetadata: { contentType: "application/pdf" },
          customMetadata: {
            memberId: String(member.memberId),
            fileName
          }
        });

        return json(request, {
          ok: true,
          memberId: member.memberId,
          fileName
        });
      }

      if (url.pathname.startsWith("/admin/")) {
        if (!isAdmin(request, env)) {
          return json(request, { ok: false, error: "unauthorized" }, 401);
        }
        if (!storageReady(env)) {
          return json(request, { ok: false, error: "storage_not_configured" }, 503);
        }
      }

      if (request.method === "GET" && url.pathname === "/admin/certificates/status") {
        const members = await buildCertificateStatus(env);
        const received = members.filter((member) => member.received).length;
        return json(request, {
          ok: true,
          total: members.length,
          received,
          missing: members.length - received,
          members
        });
      }

      if (request.method === "GET" && url.pathname === "/admin/certificates/download") {
        const memberId = url.searchParams.get("memberId");
        if (!memberId) return json(request, { ok: false, error: "missing_member_id" }, 400);

        const members = await fetchMembershipItems(env);
        const member = members.find((entry) => String(entry.memberId) === String(memberId));
        if (!member) return json(request, { ok: false, error: "member_not_found" }, 404);

        const object = await certificateObjectForMember(env, member.memberId);
        if (!object) return json(request, { ok: false, error: "certificate_not_found" }, 404);

        const stored = await env.CERTIFICATES.get(object.key);
        if (!stored) return json(request, { ok: false, error: "certificate_not_found" }, 404);

        return new Response(stored.body, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${certificateFileName(member)}"`,
            "Cache-Control": "no-store",
            ...corsHeaders(request)
          }
        });
      }

      if (request.method === "POST" && url.pathname === "/admin/certificates/delete") {
        const body = await request.json().catch(() => null);
        const memberId = body?.memberId;
        if (!memberId) {
          return json(request, { ok: false, error: "missing_member_id" }, 400);
        }

        const members = await fetchMembershipItems(env);
        const member = members.find((entry) => String(entry.memberId) === String(memberId));
        if (!member) {
          return json(request, { ok: false, error: "member_not_found" }, 404);
        }

        const object = await certificateObjectForMember(env, member.memberId);
        if (!object) {
          return json(request, { ok: false, error: "certificate_not_found" }, 404);
        }

        const fileName = certificateFileName(member);
        await removeExistingCertificate(env, member.memberId);

        return json(request, {
          ok: true,
          memberId: member.memberId,
          fileName
        });
      }

      if (request.method === "POST" && url.pathname === "/admin/certificates/download-selected") {
        const body = await request.json().catch(() => null);
        const memberIds = Array.isArray(body?.memberIds) ? body.memberIds : [];
        return downloadMembersZip(request, env, memberIds);
      }

      if (request.method === "GET" && url.pathname === "/admin/certificates/download-all") {
        return downloadMembersZip(request, env, []);
      }

      return json(request, { error: "not_found" }, 404);
    } catch (error) {
      console.error(error);
      return json(request, { ok: false, error: "upstream_error" }, 502);
    }
  }
};
