import { connect } from "cloudflare:sockets";

const HELLOASSO_API = "https://api.helloasso.com";
const ORGANIZATION_SLUG = "mix-martial-academy";
const FORM_TYPE = "Membership";
const FORM_SLUG = "adhesion-mma-2026-2027";
const BIRTHDATE_FIELD = "Date de naissance de l'adhérent";
const ICLOUD_SMTP_HOST = "smtp.mail.me.com";
const ICLOUD_SMTP_PORT = 587;
const ICLOUD_SMTP_USER = "mixmartialacademy@icloud.com";
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


function nextIsoDate(dateValue) {
  const match = String(dateValue || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function parisOffsetForDate(dateValue) {
  const reference = new Date(`${dateValue}T12:00:00Z`);
  if (Number.isNaN(reference.getTime())) return "+01:00";
  try {
    const part = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Paris",
      timeZoneName: "longOffset",
      year: "numeric"
    }).formatToParts(reference).find((entry) => entry.type === "timeZoneName");
    const value = String(part?.value || "").replace(/^GMT/, "");
    return /^[+-]\d{2}:\d{2}$/.test(value) ? value : "+01:00";
  } catch {
    return "+01:00";
  }
}

function parisDateRange(dateValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || ""))) return null;
  const nextDate = nextIsoDate(dateValue);
  if (!nextDate) return null;
  return {
    from: `${dateValue}T00:00:00${parisOffsetForDate(dateValue)}`,
    to: `${nextDate}T00:00:00${parisOffsetForDate(nextDate)}`
  };
}

async function fetchHelloAssoJson(url, token, label) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });
  if (!response.ok) {
    throw new Error(`${label} ${response.status}`);
  }
  return response.json();
}

async function fetchRefusedPayments(env, dateValue) {
  const range = parisDateRange(dateValue);
  if (!range) throw new Error("invalid_date");

  const token = await getAccessToken(env);
  const payments = [];
  const pageSize = 100;

  for (let pageIndex = 1; pageIndex <= 50; pageIndex += 1) {
    const url = new URL(
      `${HELLOASSO_API}/v5/organizations/${ORGANIZATION_SLUG}/forms/${FORM_TYPE}/${FORM_SLUG}/payments`
    );
    url.searchParams.set("from", range.from);
    url.searchParams.set("to", range.to);
    url.searchParams.append("states", "Refused");
    url.searchParams.set("pageIndex", String(pageIndex));
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("sortField", "Date");
    url.searchParams.set("sortOrder", "Asc");

    const payload = await fetchHelloAssoJson(url, token, "HelloAsso payments");
    const page = Array.isArray(payload?.data) ? payload.data : [];
    payments.push(...page);

    const totalPages = Number(payload?.pagination?.totalPages || 0);
    if (page.length < pageSize || (totalPages && pageIndex >= totalPages)) break;
  }

  const orderCache = new Map();

  async function getOrder(orderId) {
    if (!orderId) return null;
    if (orderCache.has(String(orderId))) return orderCache.get(String(orderId));

    const url = new URL(`${HELLOASSO_API}/v5/orders/${encodeURIComponent(orderId)}`);
    url.searchParams.set("withFormData", "true");

    try {
      const order = await fetchHelloAssoJson(url, token, "HelloAsso order");
      orderCache.set(String(orderId), order);
      return order;
    } catch (error) {
      console.error("Unable to load HelloAsso order", orderId, error);
      orderCache.set(String(orderId), null);
      return null;
    }
  }

  const rows = [];
  for (const payment of payments) {
    const orderId = payment?.order?.id ?? null;
    const order = await getOrder(orderId);
    const payer = payment?.payer || order?.payer || {};
    const orderItems = Array.isArray(order?.items) ? order.items : [];

    const members = [];
    const memberKeys = new Set();

    for (const item of orderItems) {
      if (String(item?.type || "").toLowerCase() !== "membership") continue;
      const firstName = String(item?.user?.firstName || "").trim();
      const lastName = String(item?.user?.lastName || "").trim();
      const itemId = item?.id ?? null;
      if (!firstName && !lastName) continue;
      const key = `${normalizeText(lastName)}|${normalizeText(firstName)}|${itemId ?? ""}`;
      if (memberKeys.has(key)) continue;
      memberKeys.add(key);
      members.push({ itemId, firstName, lastName });
    }

    rows.push({
      paymentId: payment?.id ?? null,
      orderId,
      paymentDate: payment?.date || payment?.meta?.updatedAt || null,
      installmentNumber: payment?.installmentNumber ?? null,
      amount: Number(payment?.amount || 0),
      state: String(payment?.state || ""),
      payer: {
        firstName: String(payer?.firstName || "").trim(),
        lastName: String(payer?.lastName || "").trim(),
        email: String(payer?.email || "").trim()
      },
      members,
      itemNames: orderItems.map((item) => String(item?.name || "").trim()).filter(Boolean)
    });
  }

  for (const row of rows) {
    row.reminder = await getPaymentReminder(env, dateValue, row.paymentId);
  }

  return rows;
}

function mailConfigured(env) {
  return Boolean(env.ICLOUD_APP_PASSWORD);
}

function paymentReminderKey(dateValue, paymentId) {
  return `payment-reminders/${dateValue}/${String(paymentId)}.json`;
}

async function getPaymentReminder(env, dateValue, paymentId) {
  if (!storageReady(env) || paymentId == null) return null;
  const object = await env.CERTIFICATES.get(paymentReminderKey(dateValue, paymentId));
  if (!object) return null;
  try {
    const data = JSON.parse(await object.text());
    return {
      sentAt: data.sentAt || null,
      email: data.email || "",
      paymentId: data.paymentId ?? paymentId
    };
  } catch {
    return null;
  }
}

function formatDateFr(dateValue) {
  const match = String(dateValue || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(dateValue || "");
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function paymentMemberNames(payment) {
  const members = Array.isArray(payment?.members) ? payment.members : [];
  return members
    .map((member) => [member?.firstName, member?.lastName].filter(Boolean).join(" ").trim())
    .filter(Boolean);
}

function buildPaymentReminderMail(payment, dateValue) {
  const payer = payment?.payer || {};
  const payerFirstName = String(payer.firstName || "").trim();
  const recipient = String(payer.email || "").trim();
  const members = paymentMemberNames(payment);
  const intro = payerFirstName ? `Bonjour ${payerFirstName},` : "Bonjour,";
  let membership = "";
  if (members.length === 1) membership = ` concernant l’adhésion de ${members[0]}`;
  if (members.length > 1) membership = ` concernant les adhésions de ${members.join(", ")}`;

  const subject = "Échéance HelloAsso refusée — régularisation";
  const body = [
    intro,
    "",
    `Nous vous informons que l’échéance HelloAsso du ${formatDateFr(dateValue)}${membership} a été refusée.`,
    "",
    "HelloAsso a normalement dû vous envoyer un e-mail contenant le lien permettant de régulariser la situation. Merci de vérifier votre boîte de réception principale ainsi que vos messages indésirables / spams, puis d’effectuer la régularisation dès que possible.",
    "",
    "Si la régularisation a déjà été effectuée entre-temps, vous pouvez ne pas tenir compte de ce message.",
    "",
    "Cordialement,",
    "Mix Martial Academy — Le Rove"
  ].join("\n");

  return { recipient, subject, body };
}

function validEmail(value) {
  const email = String(value || "").trim();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) && !/[\r\n]/.test(email);
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function utf8Base64(value) {
  return bytesToBase64(new TextEncoder().encode(String(value || "")));
}

function wrapBase64(value) {
  const encoded = utf8Base64(value);
  return encoded.match(/.{1,76}/g)?.join("\r\n") || "";
}

function createSmtpState(socket) {
  return {
    socket,
    reader: socket.readable.getReader(),
    writer: socket.writable.getWriter(),
    buffer: "",
    decoder: new TextDecoder(),
    encoder: new TextEncoder()
  };
}

async function smtpRead(state) {
  const lines = [];
  while (true) {
    const newline = state.buffer.indexOf("\n");
    if (newline >= 0) {
      const line = state.buffer.slice(0, newline).replace(/\r$/, "");
      state.buffer = state.buffer.slice(newline + 1);
      lines.push(line);
      if (/^\d{3} /.test(line)) {
        return {
          code: Number(line.slice(0, 3)),
          text: lines.join("\n")
        };
      }
      continue;
    }

    const result = await state.reader.read();
    if (result.done) throw new Error("smtp_connection_closed");
    state.buffer += state.decoder.decode(result.value, { stream: true });
  }
}

async function smtpWriteLine(state, line) {
  await state.writer.write(state.encoder.encode(String(line) + "\r\n"));
}

function smtpExpect(response, allowedCodes, step) {
  if (!allowedCodes.includes(response.code)) {
    throw new Error(`smtp_${step}_${response.code}`);
  }
}

function publicMailError(error) {
  const raw = String(error?.message || error || "mail_failed");
  if (/^smtp_[a-z0-9_]+$/i.test(raw)) return raw;
  if (raw === "mail_not_configured" || raw === "invalid_recipient") return raw;
  if (/tls/i.test(raw)) return "smtp_tls_failed";
  if (/socket|connect|network|tcp/i.test(raw)) return "smtp_connection_failed";
  return "smtp_unknown_failure";
}

async function sendIcloudMail(env, mail, paymentId) {
  if (!mailConfigured(env)) throw new Error("mail_not_configured");
  if (!validEmail(mail.recipient)) throw new Error("invalid_recipient");

  const socket = connect(
    { hostname: ICLOUD_SMTP_HOST, port: ICLOUD_SMTP_PORT },
    { secureTransport: "starttls" }
  );
  let state = createSmtpState(socket);

  try {
    await socket.opened;
    smtpExpect(await smtpRead(state), [220], "greeting");

    await smtpWriteLine(state, "EHLO mma-lerove.fr");
    smtpExpect(await smtpRead(state), [250], "ehlo");

    await smtpWriteLine(state, "STARTTLS");
    smtpExpect(await smtpRead(state), [220], "starttls");

    state.reader.releaseLock();
    state.writer.releaseLock();

    const secureSocket = state.socket.startTls();
    await secureSocket.opened;
    state = createSmtpState(secureSocket);

    await smtpWriteLine(state, "EHLO mma-lerove.fr");
    const ehlo = await smtpRead(state);
    smtpExpect(ehlo, [250], "secure_ehlo");

    const password = String(env.ICLOUD_APP_PASSWORD || "").trim();
    const authText = ehlo.text.toUpperCase();

    if (authText.includes("AUTH PLAIN")) {
      const payload = utf8Base64(`\u0000${ICLOUD_SMTP_USER}\u0000${password}`);
      await smtpWriteLine(state, `AUTH PLAIN ${payload}`);
      smtpExpect(await smtpRead(state), [235], "auth");
    } else {
      await smtpWriteLine(state, "AUTH LOGIN");
      smtpExpect(await smtpRead(state), [334], "auth_login");
      await smtpWriteLine(state, utf8Base64(ICLOUD_SMTP_USER));
      smtpExpect(await smtpRead(state), [334], "auth_user");
      await smtpWriteLine(state, utf8Base64(password));
      smtpExpect(await smtpRead(state), [235], "auth_password");
    }

    await smtpWriteLine(state, `MAIL FROM:<${ICLOUD_SMTP_USER}>`);
    smtpExpect(await smtpRead(state), [250], "mail_from");

    await smtpWriteLine(state, `RCPT TO:<${mail.recipient}>`);
    smtpExpect(await smtpRead(state), [250, 251], "rcpt_to");

    await smtpWriteLine(state, "DATA");
    smtpExpect(await smtpRead(state), [354], "data");

    const messageIdPart = String(paymentId || Date.now()).replace(/[^A-Za-z0-9._-]/g, "");
    const message = [
      `From: =?UTF-8?B?${utf8Base64("Mix Martial Academy — Le Rove")}?= <${ICLOUD_SMTP_USER}>`,
      `To: <${mail.recipient}>`,
      `Reply-To: <${ICLOUD_SMTP_USER}>`,
      `Subject: =?UTF-8?B?${utf8Base64(mail.subject)}?=`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <helloasso-${messageIdPart}@mma-lerove.fr>`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(mail.body),
      "."
    ].join("\r\n");

    await state.writer.write(state.encoder.encode(message + "\r\n"));
    smtpExpect(await smtpRead(state), [250], "message");

    await smtpWriteLine(state, "QUIT");
    const quit = await smtpRead(state).catch(() => ({ code: 221 }));
    smtpExpect(quit, [221], "quit");
  } finally {
    try { state.reader.releaseLock(); } catch {}
    try { state.writer.releaseLock(); } catch {}
    try { await state.socket.close(); } catch {}
  }
}

async function storePaymentReminder(env, dateValue, payment) {
  const sentAt = new Date().toISOString();
  const record = {
    sentAt,
    paymentId: payment.paymentId,
    orderId: payment.orderId,
    email: String(payment?.payer?.email || "").trim(),
    members: paymentMemberNames(payment)
  };
  await env.CERTIFICATES.put(
    paymentReminderKey(dateValue, payment.paymentId),
    JSON.stringify(record),
    {
      httpMetadata: { contentType: "application/json" },
      customMetadata: {
        sentAt,
        paymentId: String(payment.paymentId ?? "")
      }
    }
  );
  return record;
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
          certificateDeletion: true,
          refusedPayments: true,
          icloudMailConfigured: mailConfigured(env)
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
      }

      if (url.pathname.startsWith("/admin/certificates/") && !storageReady(env)) {
        return json(request, { ok: false, error: "storage_not_configured" }, 503);
      }

      if (request.method === "GET" && url.pathname === "/admin/mail/status") {
        return json(request, {
          ok: true,
          configured: mailConfigured(env),
          sender: ICLOUD_SMTP_USER
        });
      }

      if (request.method === "POST" && url.pathname === "/admin/mail/test") {
        if (!mailConfigured(env)) {
          return json(request, { ok: false, error: "mail_not_configured" }, 503);
        }

        try {
          await sendIcloudMail(env, {
            recipient: ICLOUD_SMTP_USER,
            subject: "Test envoi iCloud — Mix Martial Academy",
            body: [
              "Bonjour,",
              "",
              "Ceci est un message de test envoyé automatiquement depuis l’administration de Mix Martial Academy.",
              "",
              "La connexion SMTP iCloud du club fonctionne correctement.",
              "",
              "Mix Martial Academy — Le Rove"
            ].join("\n")
          }, `test-${Date.now()}`);

          return json(request, {
            ok: true,
            sent: true,
            recipient: ICLOUD_SMTP_USER
          });
        } catch (error) {
          console.error("iCloud SMTP test failed", error);
          return json(request, {
            ok: false,
            error: publicMailError(error)
          }, 502);
        }
      }

      if (request.method === "GET" && url.pathname === "/admin/payments/refused") {
        const date = String(url.searchParams.get("date") || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return json(request, { ok: false, error: "invalid_date" }, 400);
        }

        const payments = await fetchRefusedPayments(env, date);
        return json(request, {
          ok: true,
          date,
          total: payments.length,
          totalAmount: payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
          payments
        });
      }

      if (request.method === "POST" && url.pathname === "/admin/payments/refused/send") {
        if (!mailConfigured(env)) {
          return json(request, { ok: false, error: "mail_not_configured" }, 503);
        }
        if (!storageReady(env)) {
          return json(request, { ok: false, error: "storage_not_configured" }, 503);
        }

        const body = await request.json().catch(() => null);
        const date = String(body?.date || "").trim();
        const requestedIds = Array.isArray(body?.paymentIds)
          ? [...new Set(body.paymentIds.map((value) => String(value)).filter(Boolean))]
          : [];

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !requestedIds.length || requestedIds.length > 20) {
          return json(request, { ok: false, error: "invalid_request" }, 400);
        }

        const payments = await fetchRefusedPayments(env, date);
        const paymentById = new Map(payments.map((payment) => [String(payment.paymentId), payment]));
        const results = [];

        for (const paymentId of requestedIds) {
          const payment = paymentById.get(paymentId);
          if (!payment) {
            results.push({ paymentId, status: "not_found" });
            continue;
          }

          const existing = await getPaymentReminder(env, date, payment.paymentId);
          if (existing?.sentAt) {
            results.push({
              paymentId,
              status: "already_sent",
              sentAt: existing.sentAt,
              email: existing.email || ""
            });
            continue;
          }

          const mail = buildPaymentReminderMail(payment, date);
          if (!validEmail(mail.recipient)) {
            results.push({ paymentId, status: "invalid_email" });
            continue;
          }

          try {
            await sendIcloudMail(env, mail, payment.paymentId);
            const record = await storePaymentReminder(env, date, payment);
            results.push({
              paymentId,
              status: "sent",
              sentAt: record.sentAt,
              email: record.email
            });
          } catch (error) {
            console.error("Unable to send iCloud payment reminder", paymentId, error);
            results.push({
              paymentId,
              status: "failed",
              error: publicMailError(error)
            });
          }
        }

        return json(request, {
          ok: true,
          date,
          sent: results.filter((result) => result.status === "sent").length,
          alreadySent: results.filter((result) => result.status === "already_sent").length,
          failed: results.filter((result) => result.status === "failed").length,
          invalidEmail: results.filter((result) => result.status === "invalid_email").length,
          notFound: results.filter((result) => result.status === "not_found").length,
          results
        });
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
