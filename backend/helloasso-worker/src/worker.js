import { connect } from "cloudflare:sockets";
import { rowsFromOrders, makeXlsx } from "./membersExport.js";

const HELLOASSO_API = "https://api.helloasso.com";
const ORGANIZATION_SLUG = "mix-martial-academy";
const FORM_TYPE = "Membership";
const FORM_SLUG = "adhesion-mma-2026-2027";
const BIRTHDATE_FIELD = "Date de naissance de l'adhérent";
const ICLOUD_SMTP_HOST = "smtp.mail.me.com";
const ICLOUD_SMTP_PORT = 587;
const ICLOUD_SMTP_AUTH_USER = "cyril.camoin@icloud.com";
const ICLOUD_SMTP_FROM = "mixmartialacademy@icloud.com";
const CLUB_LOGO_URL = "https://www.mma-lerove.fr/assets/logo/logo-mma-2627-officiel.png";
const WORKER_RELEASE = "2026-10-06-certificate-reminders-email-fallback-v2";
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
    "Access-Control-Expose-Headers": "Content-Disposition, X-Members-Total, X-Members-Enfants, X-Members-Ados, X-Members-Adultes, X-Members-Incomplete",
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
      birthDate: getBirthDate(item),
      orderId: item?.order?.id ?? item?.orderId ?? null,
      payerEmail: String(item?.payer?.email || item?.order?.payer?.email || "").trim(),
      payerFirstName: String(item?.payer?.firstName || item?.order?.payer?.firstName || "").trim(),
      memberEmail: String(item?.user?.email || "").trim()
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

function paymentDateKey(value) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function normalizeSmsPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  // HelloAsso peut contenir des numéros français saisis avec +33 / 0033
  // ou avec des chiffres ajoutés par erreur. On reconstruit d'abord le
  // format national, puis on conserve uniquement les 10 premiers chiffres.
  if (digits.startsWith("0033")) {
    digits = digits.slice(4);
    if (digits.startsWith("0")) digits = digits.slice(1);
    digits = "0" + digits;
  } else if (digits.startsWith("33")) {
    digits = digits.slice(2);
    if (digits.startsWith("0")) digits = digits.slice(1);
    digits = "0" + digits;
  } else if (!digits.startsWith("0") && digits.length >= 9) {
    digits = "0" + digits;
  }

  if (digits.length < 10 || !digits.startsWith("0")) return "";
  digits = digits.slice(0, 10);

  return /^0\d{9}$/.test(digits) ? digits : "";
}

function phoneFromCustomFields(fields) {
  for (const field of Array.isArray(fields) ? fields : []) {
    const type = String(field?.type || "").toLowerCase();
    const name = normalizeText(field?.name || field?.label || "");
    if (type === "phone" || /telephone|mobile|portable|tel/.test(name)) {
      const phone = normalizeSmsPhone(field?.answer);
      if (phone) return phone;
    }
  }
  return "";
}

function phoneFromOrder(order, orderItems) {
  const directCandidates = [
    order?.payer?.phone,
    order?.payer?.mobile,
    order?.payer?.phoneNumber
  ];
  for (const candidate of directCandidates) {
    const phone = normalizeSmsPhone(candidate);
    if (phone) return phone;
  }

  for (const item of Array.isArray(orderItems) ? orderItems : []) {
    const userCandidates = [item?.user?.phone, item?.user?.mobile, item?.user?.phoneNumber];
    for (const candidate of userCandidates) {
      const phone = normalizeSmsPhone(candidate);
      if (phone) return phone;
    }

    const itemPhone = phoneFromCustomFields(item?.customFields);
    if (itemPhone) return itemPhone;

    for (const option of Array.isArray(item?.options) ? item.options : []) {
      const optionPhone = phoneFromCustomFields(option?.customFields);
      if (optionPhone) return optionPhone;
    }
  }

  return "";
}

async function fetchRefusedPayments(env) {
  const token = await getAccessToken(env);
  const payments = [];
  const pageSize = 100;

  for (let pageIndex = 1; pageIndex <= 50; pageIndex += 1) {
    const url = new URL(
      `${HELLOASSO_API}/v5/organizations/${ORGANIZATION_SLUG}/forms/${FORM_TYPE}/${FORM_SLUG}/payments`
    );
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


  const historicalPhoneCache = new Map();

  async function findHistoricalPhone(payerEmail, currentOrderId) {
    const email = String(payerEmail || "").trim().toLowerCase();
    if (!email) return "";
    if (historicalPhoneCache.has(email)) return historicalPhoneCache.get(email);

    let recovered = "";
    try {
      for (let pageIndex = 1; pageIndex <= 10 && !recovered; pageIndex += 1) {
        const url = new URL(`${HELLOASSO_API}/v5/organizations/${ORGANIZATION_SLUG}/orders`);
        url.searchParams.set("userSearchKey", email);
        url.searchParams.append("formTypes", "Membership");
        url.searchParams.set("pageIndex", String(pageIndex));
        url.searchParams.set("pageSize", "100");
        url.searchParams.set("withDetails", "true");
        url.searchParams.set("sortOrder", "Desc");

        const payload = await fetchHelloAssoJson(url, token, "HelloAsso organization orders");
        const candidates = Array.isArray(payload?.data) ? payload.data : [];

        for (const candidate of candidates) {
          const candidateOrderId = candidate?.id ?? candidate?.order?.id ?? null;
          if (candidateOrderId != null && String(candidateOrderId) === String(currentOrderId ?? "")) continue;

          const candidatePayerEmail = String(candidate?.payer?.email || "").trim().toLowerCase();
          if (candidatePayerEmail !== email) continue;

          recovered = phoneFromOrder(candidate, Array.isArray(candidate?.items) ? candidate.items : []);
          if (recovered) break;

          if (candidateOrderId != null) {
            const detailedOrder = await getOrder(candidateOrderId);
            if (String(detailedOrder?.payer?.email || "").trim().toLowerCase() !== email) continue;
            recovered = phoneFromOrder(
              detailedOrder,
              Array.isArray(detailedOrder?.items) ? detailedOrder.items : []
            );
            if (recovered) break;
          }
        }

        const totalPages = Number(payload?.pagination?.totalPages || 0);
        if (!candidates.length || (totalPages && pageIndex >= totalPages)) break;
      }
    } catch (error) {
      console.error("Unable to load previous HelloAsso contact data", error);
    }

    historicalPhoneCache.set(email, recovered);
    return recovered;
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

    const paymentDate = payment?.date || payment?.meta?.updatedAt || null;
    const payerEmail = String(payer?.email || "").trim();
    let smsPhone = phoneFromOrder(order, orderItems);
    if (!smsPhone && payerEmail) {
      smsPhone = await findHistoricalPhone(payerEmail, orderId);
    }

    rows.push({
      paymentId: payment?.id ?? null,
      orderId,
      paymentDate,
      dateKey: paymentDateKey(paymentDate),
      installmentNumber: payment?.installmentNumber ?? null,
      amount: Number(payment?.amount || 0),
      state: String(payment?.state || ""),
      smsPhone,
      payer: {
        firstName: String(payer?.firstName || "").trim(),
        lastName: String(payer?.lastName || "").trim(),
        email: payerEmail
      },
      members,
      itemNames: orderItems.map((item) => String(item?.name || "").trim()).filter(Boolean)
    });
  }

  for (const row of rows) {
    row.reminder = row.dateKey
      ? await getPaymentReminder(env, row.dateKey, row.paymentId)
      : null;
  }

  return rows;
}

function mailConfigured(env) {
  return Boolean(env.ICLOUD_APP_PASSWORD);
}

function paymentReminderKey(dateValue, paymentId) {
  return `payment-reminders/${dateValue}/${String(paymentId)}.json`;
}

function paymentReminderHistoryKey(dateValue, paymentId, sentAt) {
  const safeSentAt = String(sentAt || "").replace(/[:.]/g, "-");
  return `payment-reminders-history/${dateValue}/${String(paymentId)}/${safeSentAt}.json`;
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

async function listPaymentReminders(env, limit = 100) {
  if (!storageReady(env)) return [];

  const maxRows = Math.max(1, Math.min(Number(limit) || 100, 500));
  const rows = [];
  const seen = new Set();

  async function collect(prefix, matcher) {
    let cursor;
    do {
      const listed = await env.CERTIFICATES.list({
        prefix,
        limit: 1000,
        cursor
      });

      for (const object of listed.objects || []) {
        const match = matcher(String(object.key || ""));
        if (!match) continue;

        const stored = await env.CERTIFICATES.get(object.key);
        if (!stored) continue;

        try {
          const data = JSON.parse(await stored.text());
          const date = match.date;
          const paymentId = data.paymentId ?? match.paymentId;
          const sentAt = data.sentAt || null;
          const dedupeKey = [String(paymentId), String(sentAt || ""), String(data.email || "")].join("|");
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);

          rows.push({
            date,
            paymentId,
            orderId: data.orderId ?? null,
            sentAt,
            email: data.email || "",
            payerFirstName: data.payerFirstName || "",
            payerLastName: data.payerLastName || "",
            members: Array.isArray(data.members) ? data.members : [],
            amount: Number(data.amount || 0),
            status: "sent"
          });
        } catch {}
      }

      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  }

  await collect("payment-reminders-history/", (key) => {
    const match = key.match(/^payment-reminders-history\/(\d{4}-\d{2}-\d{2})\/([^/]+)\/[^/]+\.json$/);
    return match ? { date: match[1], paymentId: match[2] } : null;
  });

  await collect("payment-reminders/", (key) => {
    const match = key.match(/^payment-reminders\/(\d{4}-\d{2}-\d{2})\/([^/]+)\.json$/);
    return match ? { date: match[1], paymentId: match[2] } : null;
  });

  rows.sort((a, b) => String(b.sentAt || "").localeCompare(String(a.sentAt || "")));
  return rows.slice(0, maxRows);
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

function escapeMailHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
    "HelloAsso vous a envoyé un e-mail contenant le lien permettant de régulariser la situation. Merci de vérifier votre boîte de réception principale ainsi que vos messages indésirables / spams, puis d’effectuer la régularisation dès que possible.",
    "",
    "Vous ne retrouvez pas l’e-mail HelloAsso ? Aucun problème.",
    "",
    "Vous pouvez accéder directement à votre espace HelloAsso et retrouver votre paiement :",
    "1. Rendez-vous sur la page de connexion HelloAsso : https://auth.helloasso.com/connexion",
    "2. Cliquez sur « Mot de passe oublié »",
    "3. Saisissez l’adresse e-mail utilisée lors du paiement",
    "4. Utilisez le lien reçu par e-mail pour créer ou réinitialiser votre mot de passe",
    "5. Connectez-vous à votre espace HelloAsso",
    "6. Retrouvez votre paiement au statut « Refusé » et procédez à sa régularisation",
    "",
    "Une fois la régularisation effectuée, le statut du paiement passera à « Payé ».",
    "",
    "Cette procédure vous permet donc de régulariser votre échéance même si vous ne retrouvez plus l’e-mail initial envoyé par HelloAsso.",
    "",
    "Si la régularisation a déjà été effectuée entre-temps, vous pouvez ne pas tenir compte de ce message.",
    "",
    "Cordialement,",
    "Mix Martial Academy — Le Rove",
    "www.mma-lerove.fr"
  ].join("\n");

  const htmlBody = `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#171717;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f4f4;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid #e6e6e6;border-radius:16px;overflow:hidden;">
            <tr>
              <td align="center" style="background:#000000;padding:24px 20px 18px;">
                <img src="${CLUB_LOGO_URL}" width="130" alt="Mix Martial Academy — Le Rove" style="display:block;width:130px;max-width:100%;height:auto;border:0;">
              </td>
            </tr>
            <tr>
              <td style="height:4px;background:#c90f13;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:28px 28px 30px;">
                <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">${escapeMailHtml(intro)}</p>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">
                  Nous vous informons que l’échéance HelloAsso du <strong>${escapeMailHtml(formatDateFr(dateValue))}</strong>${escapeMailHtml(membership)} a été refusée.
                </p>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">
                  HelloAsso vous a envoyé un e-mail contenant le lien permettant de régulariser la situation.
                  Merci de vérifier votre boîte de réception principale ainsi que vos messages indésirables / spams,
                  puis d’effectuer la régularisation dès que possible.
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0;background:#f5f5f5;border:1px solid #dddddd;border-radius:12px;">
                  <tr>
                    <td style="padding:20px;">
                      <p style="margin:0 0 12px;font-size:16px;line-height:1.5;font-weight:700;color:#171717;">
                        Vous ne retrouvez pas l’e-mail HelloAsso ? Aucun problème.
                      </p>
                      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#333333;">
                        Vous pouvez accéder directement à votre espace HelloAsso et retrouver votre paiement :
                      </p>
                      <ol style="margin:0 0 18px;padding-left:20px;color:#333333;font-size:15px;line-height:1.7;">
                        <li>Rendez-vous sur la page de connexion HelloAsso.</li>
                        <li>Cliquez sur <strong>« Mot de passe oublié »</strong>.</li>
                        <li>Saisissez <strong>l’adresse e-mail utilisée lors du paiement</strong>.</li>
                        <li>Utilisez le lien reçu par e-mail pour créer ou réinitialiser votre mot de passe.</li>
                        <li>Connectez-vous à votre espace HelloAsso.</li>
                        <li>Retrouvez votre paiement au statut <strong>« Refusé »</strong> et procédez à sa régularisation.</li>
                      </ol>
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 16px;">
                        <tr>
                          <td align="center" bgcolor="#c90f13" style="border-radius:999px;">
                            <a href="https://auth.helloasso.com/connexion" style="display:inline-block;padding:12px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">
                              Se connecter à HelloAsso
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#555555;">
                        Une fois la régularisation effectuée, le statut du paiement passera à <strong>« Payé »</strong>.
                      </p>
                      <p style="margin:0;font-size:14px;line-height:1.6;color:#555555;">
                        Cette procédure vous permet donc de régulariser votre échéance même si vous ne retrouvez plus l’e-mail initial envoyé par HelloAsso.
                      </p>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#555555;">
                  Si la régularisation a déjà été effectuée entre-temps, vous pouvez ne pas tenir compte de ce message.
                </p>
                <p style="margin:0;font-size:16px;line-height:1.6;">
                  Cordialement,<br>
                  <strong>Mix Martial Academy — Le Rove</strong>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px;background:#000000;color:#ffffff;font-size:16px;line-height:1.5;text-align:center;">
                <a href="https://www.mma-lerove.fr/" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;letter-spacing:.2px;">www.mma-lerove.fr</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { recipient, subject, body, htmlBody };
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
      const payload = utf8Base64(`\u0000${ICLOUD_SMTP_AUTH_USER}\u0000${password}`);
      await smtpWriteLine(state, `AUTH PLAIN ${payload}`);
      smtpExpect(await smtpRead(state), [235], "auth");
    } else {
      await smtpWriteLine(state, "AUTH LOGIN");
      smtpExpect(await smtpRead(state), [334], "auth_login");
      await smtpWriteLine(state, utf8Base64(ICLOUD_SMTP_AUTH_USER));
      smtpExpect(await smtpRead(state), [334], "auth_user");
      await smtpWriteLine(state, utf8Base64(password));
      smtpExpect(await smtpRead(state), [235], "auth_password");
    }

    await smtpWriteLine(state, `MAIL FROM:<${ICLOUD_SMTP_FROM}>`);
    smtpExpect(await smtpRead(state), [250], "mail_from");

    await smtpWriteLine(state, `RCPT TO:<${mail.recipient}>`);
    smtpExpect(await smtpRead(state), [250, 251], "rcpt_to");

    await smtpWriteLine(state, "DATA");
    smtpExpect(await smtpRead(state), [354], "data");

    const messageIdPart = String(paymentId || Date.now()).replace(/[^A-Za-z0-9._-]/g, "");
    const headers = [
      `From: =?UTF-8?B?${utf8Base64("Mix Martial Academy — Le Rove")}?= <${ICLOUD_SMTP_FROM}>`,
      `To: <${mail.recipient}>`,
      `Reply-To: <${ICLOUD_SMTP_FROM}>`,
      `Subject: =?UTF-8?B?${utf8Base64(mail.subject)}?=`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <helloasso-${messageIdPart}@mma-lerove.fr>`,
      "MIME-Version: 1.0"
    ];

    let message;
    if (mail.htmlBody) {
      const boundary = `mma-alt-${messageIdPart}-${Date.now()}`;
      message = [
        ...headers,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        wrapBase64(mail.body),
        `--${boundary}`,
        "Content-Type: text/html; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        wrapBase64(mail.htmlBody),
        `--${boundary}--`,
        "."
      ].join("\r\n");
    } else {
      message = [
        ...headers,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        wrapBase64(mail.body),
        "."
      ].join("\r\n");
    }

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
    payerFirstName: String(payment?.payer?.firstName || "").trim(),
    payerLastName: String(payment?.payer?.lastName || "").trim(),
    members: paymentMemberNames(payment),
    amount: Number(payment?.amount || 0)
  };

  const payload = JSON.stringify(record);
  const metadata = {
    httpMetadata: { contentType: "application/json" },
    customMetadata: {
      sentAt,
      paymentId: String(payment.paymentId ?? "")
    }
  };

  await env.CERTIFICATES.put(
    paymentReminderKey(dateValue, payment.paymentId),
    payload,
    metadata
  );

  await env.CERTIFICATES.put(
    paymentReminderHistoryKey(dateValue, payment.paymentId, sentAt),
    payload,
    metadata
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


async function resolveMembershipContact(env, member, orderCache = new Map()) {
  const directPayerEmail = String(member?.payerEmail || "").trim();
  const directPayerFirstName = String(member?.payerFirstName || "").trim();
  const fallbackEmail = String(member?.memberEmail || "").trim();
  const orderId = member?.orderId;

  if (directPayerEmail) {
    return {
      email: directPayerEmail,
      firstName: directPayerFirstName || String(member?.firstName || "").trim()
    };
  }

  if (!orderId) {
    return {
      email: fallbackEmail,
      firstName: String(member?.firstName || "").trim()
    };
  }

  const cacheKey = String(orderId);
  let order = orderCache.get(cacheKey);
  if (order === undefined) {
    try {
      const token = await getAccessToken(env);
      const url = new URL(`${HELLOASSO_API}/v5/orders/${encodeURIComponent(orderId)}`);
      url.searchParams.set("withFormData", "true");
      order = await fetchHelloAssoJson(url, token, "HelloAsso order");
    } catch (error) {
      console.error("Unable to resolve certificate reminder recipient", orderId, error);
      order = null;
    }
    orderCache.set(cacheKey, order);
  }

  const payer = order?.payer || {};
  const payerEmail = String(payer?.email || "").trim();
  return {
    email: payerEmail || fallbackEmail,
    firstName: String(payer?.firstName || directPayerFirstName || member?.firstName || "").trim()
  };
}

function certificateReminderPrefix(memberId) {
  return `certificate-reminders/${String(memberId)}/`;
}

function certificateReminderKey(memberId, sentAt) {
  const safeStamp = String(sentAt || new Date().toISOString()).replace(/[:.]/g, "-");
  return `${certificateReminderPrefix(memberId)}${safeStamp}.json`;
}

async function listCertificateReminderRecords(env, limit = 500) {
  if (!storageReady(env)) return [];

  const listed = await env.CERTIFICATES.list({
    prefix: "certificate-reminders/",
    limit: Math.max(1, Math.min(Number(limit) || 500, 1000))
  });

  const rows = [];
  for (const object of listed.objects || []) {
    const stored = await env.CERTIFICATES.get(object.key);
    if (!stored) continue;
    try {
      const data = JSON.parse(await stored.text());
      rows.push({
        memberId: String(data.memberId || ""),
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        email: data.email || "",
        recipientFirstName: data.recipientFirstName || "",
        sentAt: data.sentAt || null,
        status: data.status || "sent"
      });
    } catch {}
  }

  rows.sort((a, b) => String(b.sentAt || "").localeCompare(String(a.sentAt || "")));
  return rows;
}

async function certificateReminderIndex(env) {
  const rows = await listCertificateReminderRecords(env, 1000);
  const latest = new Map();
  for (const row of rows) {
    const key = String(row.memberId || "");
    if (key && !latest.has(key)) latest.set(key, row);
  }
  return latest;
}

async function storeCertificateReminder(env, member, contact) {
  const sentAt = new Date().toISOString();
  const record = {
    memberId: String(member.memberId),
    firstName: String(member.firstName || "").trim(),
    lastName: String(member.lastName || "").trim(),
    email: String(contact.email || "").trim(),
    recipientFirstName: String(contact.firstName || "").trim(),
    sentAt,
    status: "sent"
  };

  await env.CERTIFICATES.put(
    certificateReminderKey(member.memberId, sentAt),
    JSON.stringify(record),
    {
      httpMetadata: { contentType: "application/json" },
      customMetadata: {
        sentAt,
        memberId: String(member.memberId)
      }
    }
  );
  return record;
}

function buildCertificateReminderMail(member, contact) {
  const recipient = String(contact?.email || "").trim();
  const recipientFirstName = String(contact?.firstName || "").trim();
  const memberName = [member?.firstName, member?.lastName].filter(Boolean).join(" ").trim();
  const intro = recipientFirstName ? `Bonjour ${recipientFirstName},` : "Bonjour,";
  const subject = "Certificat médical manquant — Mix Martial Academy";
  const documentsUrl = "https://www.mma-lerove.fr/#documents-medicaux";
  const body = [
    intro,
    "",
    `Sauf erreur de notre part, nous n’avons pas encore reçu le certificat médical de ${memberName}.`,
    "",
    "Merci de le déposer directement sur notre site internet dans l’onglet « Documents Médicaux » :",
    documentsUrl,
    "",
    "Si le certificat a déjà été transmis entre-temps, vous pouvez ne pas tenir compte de ce message.",
    "",
    "Cordialement,",
    "Mix Martial Academy — Le Rove"
  ].join("\n");

  const htmlBody = `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#171717;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f4f4;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid #e6e6e6;border-radius:16px;overflow:hidden;">
            <tr>
              <td align="center" style="background:#000000;padding:24px 20px 18px;">
                <img src="${CLUB_LOGO_URL}" width="130" alt="Mix Martial Academy — Le Rove" style="display:block;width:130px;max-width:100%;height:auto;border:0;">
              </td>
            </tr>
            <tr>
              <td style="height:4px;background:#c90f13;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:28px 28px 30px;">
                <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">${escapeMailHtml(intro)}</p>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">
                  Sauf erreur de notre part, nous n’avons pas encore reçu le certificat médical de
                  <strong>${escapeMailHtml(memberName)}</strong>.
                </p>
                <p style="margin:0 0 20px;font-size:16px;line-height:1.6;">
                  Merci de le déposer directement sur notre site internet dans l’onglet « Documents Médicaux ».
                </p>
                <p style="margin:0 0 24px;text-align:center;">
                  <a href="${documentsUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#c90f13;color:#ffffff;text-decoration:none;font-weight:700;">Déposer le certificat médical</a>
                </p>
                <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#555555;">
                  Si le certificat a déjà été transmis entre-temps, vous pouvez ne pas tenir compte de ce message.
                </p>
                <p style="margin:0;font-size:16px;line-height:1.6;">
                  Cordialement,<br>
                  <strong>Mix Martial Academy — Le Rove</strong>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px;background:#000000;color:#ffffff;font-size:16px;line-height:1.5;text-align:center;">
                <a href="https://www.mma-lerove.fr/" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;letter-spacing:.2px;">www.mma-lerove.fr</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { recipient, subject, body, htmlBody };
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

  const reminderIndex = await certificateReminderIndex(env);
  const orderCache = new Map();
  const enriched = await Promise.all(members.map(async (member) => {
    const contact = await resolveMembershipContact(env, member, orderCache);
    const reminder = reminderIndex.get(String(member.memberId)) || null;
    return {
      memberId: member.memberId,
      firstName: member.firstName,
      lastName: member.lastName,
      received: receivedIds.has(String(member.memberId)),
      email: String(contact.email || "").trim(),
      recipientFirstName: String(contact.firstName || "").trim(),
      lastReminderAt: reminder?.sentAt || null
    };
  }));

  return enriched.sort((a, b) => {
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


async function fetchMembershipOrdersForExport(env) {
  const token = await getAccessToken(env);
  const orders = [];
  const pageSize = 100;
  for (let pageIndex = 1; pageIndex <= 50; pageIndex += 1) {
    const url = new URL(
      HELLOASSO_API + "/v5/organizations/" + ORGANIZATION_SLUG
      + "/forms/" + FORM_TYPE + "/" + FORM_SLUG + "/orders"
    );
    url.searchParams.set("pageIndex", String(pageIndex));
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("withDetails", "true");
    const payload = await fetchHelloAssoJson(url, token, "HelloAsso members orders");
    const page = Array.isArray(payload?.data) ? payload.data : [];
    orders.push(...page);
    const totalPages = Number(payload?.pagination?.totalPages || 0);
    if (!page.length || (totalPages && pageIndex >= totalPages) || page.length < pageSize) {
      return orders;
    }
  }
  throw new Error("HelloAsso pagination limit reached; refusing an incomplete export");
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
          certificateReminders: true,
          refusedPayments: true,
          refusedPaymentsScope: "campaign"
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


      if (request.method === "GET" && (
        url.pathname === "/admin/members/summary" ||
        url.pathname === "/admin/members/export.xlsx"
      )) {
        // Autorisation contrôlée plus haut pour l'ensemble des routes /admin/.
        // Lire HelloAsso à chaque action : aucune mise en cache de la liste nominative.
        const orders = await fetchMembershipOrdersForExport(env);
        const members = rowsFromOrders(orders);
        const counts = {
          Enfant: members.filter((member) => member.category === "Enfant").length,
          Ado: members.filter((member) => member.category === "Ado").length,
          Adulte: members.filter((member) => member.category === "Adulte").length
        };
        const incomplete = members.filter((member) =>
          !member.address || !member.postal || !member.phone
        ).length;
        if (url.pathname === "/admin/members/summary") {
          return json(request, {
            ok: true,
            campaign: FORM_SLUG,
            total: members.length,
            enfants: counts.Enfant,
            ados: counts.Ado,
            adultes: counts.Adulte,
            incomplete
          });
        }
        const book = makeXlsx(members, createZip);
        const date = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit"
        }).format(new Date());
        const fileName = "listing_adherents_Mix_Martial_Academy_2026-2027_" + date + ".xlsx";
        return new Response(book.bytes, {
          status: 200,
          headers: {
            ...corsHeaders(request),
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": 'attachment; filename="' + fileName + '"',
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "X-Members-Total": String(book.total),
            "X-Members-Enfants": String(book.counts.Enfant),
            "X-Members-Ados": String(book.counts.Ado),
            "X-Members-Adultes": String(book.counts.Adulte),
            "X-Members-Incomplete": String(book.missing)
          }
        });
      }

      if (request.method === "GET" && url.pathname === "/admin/mail/status") {
        return json(request, {
          ok: true,
          configured: mailConfigured(env),
          sender: ICLOUD_SMTP_FROM
        });
      }

      if (request.method === "POST" && url.pathname === "/admin/mail/test") {
        if (!mailConfigured(env)) {
          return json(request, { ok: false, error: "mail_not_configured" }, 503);
        }

        try {
          const fakePayment = {
            paymentId: `test-${Date.now()}`,
            payer: {
              firstName: "Cyril",
              lastName: "TEST",
              email: ICLOUD_SMTP_FROM
            },
            members: [
              {
                firstName: "Lucas",
                lastName: "MARTIN"
              }
            ]
          };

          const mail = buildPaymentReminderMail(fakePayment, "2026-10-05");
          mail.recipient = ICLOUD_SMTP_FROM;

          await sendIcloudMail(env, mail, fakePayment.paymentId);

          return json(request, {
            ok: true,
            sent: true,
            recipient: ICLOUD_SMTP_FROM,
            preview: {
              payerFirstName: fakePayment.payer.firstName,
              memberName: "Lucas MARTIN",
              date: "05/10/2026"
            }
          });
        } catch (error) {
          console.error("iCloud SMTP realistic reminder test failed", error);
          return json(request, {
            ok: false,
            error: publicMailError(error)
          }, 502);
        }
      }

      if (request.method === "GET" && url.pathname === "/admin/payments/reminders") {
        if (!storageReady(env)) {
          return json(request, { ok: false, error: "storage_not_configured" }, 503);
        }
        const reminders = await listPaymentReminders(env, url.searchParams.get("limit") || 100);
        return json(request, {
          ok: true,
          total: reminders.length,
          reminders
        });
      }

      if (request.method === "GET" && url.pathname === "/admin/payments/refused") {
        const payments = await fetchRefusedPayments(env);
        return json(request, {
          ok: true,
          campaign: FORM_SLUG,
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
        const requestedIds = Array.isArray(body?.paymentIds)
          ? [...new Set(body.paymentIds.map((value) => String(value)).filter(Boolean))]
          : [];

        if (!requestedIds.length || requestedIds.length > 20) {
          return json(request, { ok: false, error: "invalid_request" }, 400);
        }

        const payments = await fetchRefusedPayments(env);
        const paymentById = new Map(payments.map((payment) => [String(payment.paymentId), payment]));
        const results = [];

        for (const paymentId of requestedIds) {
          const payment = paymentById.get(paymentId);
          if (!payment) {
            results.push({ paymentId, status: "not_found" });
            continue;
          }

          const date = String(payment.dateKey || "").trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            results.push({ paymentId, status: "invalid_payment_date" });
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
          sent: results.filter((result) => result.status === "sent").length,
          alreadySent: results.filter((result) => result.status === "already_sent").length,
          failed: results.filter((result) => result.status === "failed").length,
          invalidEmail: results.filter((result) => result.status === "invalid_email").length,
          notFound: results.filter((result) => result.status === "not_found").length,
          invalidPaymentDate: results.filter((result) => result.status === "invalid_payment_date").length,
          results
        });
      }

      if (request.method === "GET" && url.pathname === "/admin/certificates/reminders") {
        if (!storageReady(env)) {
          return json(request, { ok: false, error: "storage_not_configured" }, 503);
        }
        const reminders = await listCertificateReminderRecords(env, url.searchParams.get("limit") || 200);
        return json(request, {
          ok: true,
          total: reminders.length,
          reminders
        });
      }

      if (request.method === "POST" && url.pathname === "/admin/certificates/reminders/test") {
        if (!mailConfigured(env)) {
          return json(request, { ok: false, error: "mail_not_configured" }, 503);
        }
        try {
          const fakeMember = {
            memberId: `test-${Date.now()}`,
            firstName: "Lucas",
            lastName: "MARTIN"
          };
          const fakeContact = {
            email: ICLOUD_SMTP_FROM,
            firstName: "Cyril"
          };
          const mail = buildCertificateReminderMail(fakeMember, fakeContact);
          await sendIcloudMail(env, mail, `certificate-test-${Date.now()}`);
          return json(request, {
            ok: true,
            sent: true,
            recipient: ICLOUD_SMTP_FROM
          });
        } catch (error) {
          console.error("iCloud certificate reminder test failed", error);
          return json(request, { ok: false, error: publicMailError(error) }, 502);
        }
      }

      if (request.method === "POST" && url.pathname === "/admin/certificates/reminders/send") {
        if (!mailConfigured(env)) {
          return json(request, { ok: false, error: "mail_not_configured" }, 503);
        }
        if (!storageReady(env)) {
          return json(request, { ok: false, error: "storage_not_configured" }, 503);
        }

        const body = await request.json().catch(() => null);
        const requestedIds = Array.isArray(body?.memberIds)
          ? [...new Set(body.memberIds.map((value) => String(value)).filter(Boolean))]
          : [];

        if (!requestedIds.length || requestedIds.length > 20) {
          return json(request, { ok: false, error: "invalid_request" }, 400);
        }

        const members = await fetchMembershipItems(env);
        const memberById = new Map(members.map((member) => [String(member.memberId), member]));
        const orderCache = new Map();
        const results = [];

        for (const memberId of requestedIds) {
          const member = memberById.get(memberId);
          if (!member) {
            results.push({ memberId, status: "not_found" });
            continue;
          }

          const certificate = await certificateObjectForMember(env, member.memberId);
          if (certificate) {
            results.push({ memberId, status: "certificate_received" });
            continue;
          }

          const contact = await resolveMembershipContact(env, member, orderCache);
          if (!validEmail(contact.email)) {
            results.push({ memberId, status: "invalid_email" });
            continue;
          }

          const mail = buildCertificateReminderMail(member, contact);
          try {
            await sendIcloudMail(env, mail, `certificate-${member.memberId}-${Date.now()}`);
            const record = await storeCertificateReminder(env, member, contact);
            results.push({
              memberId,
              status: "sent",
              sentAt: record.sentAt,
              email: record.email
            });
          } catch (error) {
            console.error("Unable to send certificate reminder", memberId, error);
            results.push({
              memberId,
              status: "failed",
              error: publicMailError(error)
            });
          }
        }

        return json(request, {
          ok: true,
          sent: results.filter((result) => result.status === "sent").length,
          received: results.filter((result) => result.status === "certificate_received").length,
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
