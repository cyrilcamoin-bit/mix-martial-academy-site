const HELLOASSO_API = "https://api.helloasso.com";
const ORGANIZATION_SLUG = "mix-martial-academy";
const FORM_TYPE = "Membership";
const FORM_SLUG = "adhesion-mma-2026-2027";
const BIRTHDATE_FIELD = "Date de naissance de l'adhérent";
const ALLOWED_ORIGIN = "https://www.mma-lerove.fr";

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

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  const allowed = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(request)
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
    .filter((member) => member.firstName && member.lastName && member.birthDate);

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
          helloAssoCampaign: FORM_SLUG
        });
      }

      if (request.method === "GET" && url.pathname === "/stats") {
        const token = await getAccessToken(env);
        const all = [];
        const pageSize = 100;

        for (let pageIndex = 1; pageIndex <= 50; pageIndex += 1) {
          const apiUrl = new URL(
            `${HELLOASSO_API}/v5/organizations/${ORGANIZATION_SLUG}/forms/${FORM_TYPE}/${FORM_SLUG}/items`
          );
          apiUrl.searchParams.set("pageIndex", String(pageIndex));
          apiUrl.searchParams.set("pageSize", String(pageSize));
          apiUrl.searchParams.set("withDetails", "true");

          const response = await fetch(apiUrl, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json"
            }
          });

          if (!response.ok) {
            throw new Error(`HelloAsso stats ${response.status}`);
          }

          const payload = await response.json();
          const page = Array.isArray(payload?.data) ? payload.data : [];
          all.push(...page);
          if (page.length < pageSize) break;
        }

        const memberships = all.filter(
          (item) => String(item?.type || item?.tierType || "").toLowerCase() === "membership"
        );

        const completeMembers = memberships.filter((item) => {
          const firstName = String(item?.user?.firstName || "").trim();
          const lastName = String(item?.user?.lastName || "").trim();
          const birthDate = getBirthDate(item);
          return firstName && lastName && birthDate;
        });

        return json(request, {
          ok: true,
          campaign: FORM_SLUG,
          totalItems: all.length,
          memberships: memberships.length,
          completeMembers: completeMembers.length,
          missingIdentityOrBirthDate: memberships.length - completeMembers.length
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

      return json(request, { error: "not_found" }, 404);
    } catch (error) {
      console.error(error);
      return json(request, { ok: false, error: "upstream_error" }, 502);
    }
  }
};
