/**
 * Prototype WebAuthn de Mix Martial Academy.
 *
 * IMPORTANT :
 * - Version de test uniquement ; ces routes ne déverrouillent aucun module admin.
 * - Un jeton de session opaque de courte durée remplace le mot de passe pour les routes Cloudflare de test.
 * - L'enrôlement requiert le véritable ADMIN_API_TOKEN côté Cloudflare.
 * - Les challenges et la clé publique sont cantonnés au préfixe R2 passkey-preview/.
 * - La validation WebAuthn complète est réalisée par @simplewebauthn/server.
 */
import { issuePasskeySession, revokePasskeySession } from "./passkeySession.js";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from "@simplewebauthn/server";

const RP_ID = "mma-lerove.fr";
const ORIGINS = ["https://www.mma-lerove.fr", "https://mma-lerove.fr"];
const PATH = "passkey-preview/";
const SAVED_KEY = PATH + "credential/admin";
const EXPIRY_MS = 120_000;

const text = (value) => JSON.stringify(value);
const b64url = (bytes) => btoa(String.fromCharCode(...bytes))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const fromB64url = (value) => {
  const v = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(v + "=".repeat((4 - v.length % 4) % 4)), ch => ch.charCodeAt(0));
};
const validRequestOrigin = (request) => ORIGINS.includes(request.headers.get("Origin"));
const authorized = (request, env) => Boolean(
  env.ADMIN_API_TOKEN &&
  request.headers.get("Authorization") === "Bearer " + env.ADMIN_API_TOKEN
);

async function readJSON(r2, key) {
  const object = await r2.get(key);
  if (!object) return null;
  try { return await object.json(); } catch { return null; }
}
async function storeJSON(r2, key, value) {
  await r2.put(key, text(value), { httpMetadata: { contentType: "application/json" } });
}

async function newChallenge(env, purpose, options) {
  const requestId = crypto.randomUUID();
  await storeJSON(env.CERTIFICATES, PATH + "challenge/" + purpose + "/" + requestId, {
    challenge: options.challenge,
    expiresAt: Date.now() + EXPIRY_MS
  });
  return { options, requestId };
}
async function consumeChallenge(env, purpose, requestId) {
  if (!/^[a-f0-9-]{36}$/.test(String(requestId || ""))) return null;
  const key = PATH + "challenge/" + purpose + "/" + requestId;
  const challenge = await readJSON(env.CERTIFICATES, key);
  await env.CERTIFICATES.delete(key);
  if (!challenge || !challenge.challenge || Date.now() > Number(challenge.expiresAt)) return null;
  return challenge.challenge;
}

export async function handlePasskeyPreview(request, env, reply) {
  const route = new URL(request.url).pathname;
  if (route === "/passkey-preview/health" && request.method === "GET") {
    const productionHost = new URL(request.url).hostname ===
      "mma-lerove-api.cyril-camoin.workers.dev";
    const writable = productionHost && env.PASSKEY_ADMIN_WRITE_ENABLED === "true";
    return reply({
      ok: true,
      version: "faceid-full-admin-20261009-v1",
      storage: Boolean(env.CERTIFICATES),
      origin: "https://www.mma-lerove.fr",
      adminWritable: writable && Boolean(env.CERTIFICATES && env.ADMIN_API_TOKEN),
      testOnly: !writable
    });
  }

  if (!validRequestOrigin(request)) {
    return reply({ ok: false, error: "origin_not_allowed" }, 403);
  }
  if (!env.CERTIFICATES) {
    return reply({ ok: false, error: "passkey_storage_unavailable" }, 503);
  }
  if (request.method !== "POST") {
    return reply({ ok: false, error: "method_not_allowed" }, 405);
  }
  const isRegistration = route.includes("/register/");
  if (isRegistration && !authorized(request, env)) {
    return reply({ ok: false, error: "incorrect_admin_password" }, 401);
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return reply({ ok: false, error: "invalid_request" }, 400);
  }

  if (route === "/passkey-preview/register/options") {
    const saved = await readJSON(env.CERTIFICATES, SAVED_KEY);
    const options = await generateRegistrationOptions({
      rpName: "Mix Martial Academy - Test Face ID",
      rpID: RP_ID,
      userID: new TextEncoder().encode("mma-admin"),
      userName: "administration-mma",
      attestationType: "none",
      timeout: 90_000,
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        userVerification: "required"
      },
      supportedAlgorithmIDs: [-7],
      excludeCredentials: saved ? [{ id: saved.id, transports: saved.transports }] : []
    });
    return reply({ ok: true, ...(await newChallenge(env, "register", options)) });
  }

  if (route === "/passkey-preview/register/verify") {
    const challenge = await consumeChallenge(env, "register", body.requestId);
    if (!challenge || !body.credential || typeof body.credential !== "object") {
      return reply({ ok: false, error: "challenge_expired" }, 400);
    }
    try {
      const verification = await verifyRegistrationResponse({
        response: body.credential,
        expectedChallenge: challenge,
        expectedOrigin: ORIGINS,
        expectedRPID: RP_ID,
        requireUserVerification: true,
        supportedAlgorithmIDs: [-7]
      });
      if (!verification.verified || !verification.registrationInfo?.credential) {
        return reply({ ok: false, error: "verification_failed" }, 401);
      }
      const cred = verification.registrationInfo.credential;
      await storeJSON(env.CERTIFICATES, SAVED_KEY, {
        id: cred.id,
        publicKey: b64url(cred.publicKey),
        counter: cred.counter,
        transports: body.credential.response?.transports || [],
        createdAt: new Date().toISOString()
      });
      return reply({ ok: true, enrolled: true, testOnly: true });
    } catch {
      return reply({ ok: false, error: "verification_failed" }, 401);
    }
  }

  if (route === "/passkey-preview/logout") {
    await revokePasskeySession(request, env);
    return reply({ ok: true, revoked: true });
  }

  if (route === "/passkey-preview/login/options") {
    const saved = await readJSON(env.CERTIFICATES, SAVED_KEY);
    if (!saved) return reply({ ok: false, error: "not_registered" }, 404);
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      timeout: 90_000,
      userVerification: "required",
      allowCredentials: [{ id: saved.id, transports: saved.transports }]
    });
    return reply({ ok: true, ...(await newChallenge(env, "login", options)) });
  }

  if (route === "/passkey-preview/login/verify") {
    const challenge = await consumeChallenge(env, "login", body.requestId);
    if (!challenge || !body.credential || typeof body.credential !== "object") {
      return reply({ ok: false, error: "challenge_expired" }, 400);
    }
    const saved = await readJSON(env.CERTIFICATES, SAVED_KEY);
    if (!saved || String(body.credential.id) !== saved.id) {
      return reply({ ok: false, error: "credential_not_registered" }, 401);
    }
    try {
      const verification = await verifyAuthenticationResponse({
        response: body.credential,
        expectedChallenge: challenge,
        expectedOrigin: ORIGINS,
        expectedRPID: RP_ID,
        requireUserVerification: true,
        credential: {
          id: saved.id,
          publicKey: fromB64url(saved.publicKey),
          counter: saved.counter,
          transports: saved.transports
        }
      });
      if (!verification.verified || !verification.authenticationInfo) {
        return reply({ ok: false, error: "verification_failed" }, 401);
      }
      saved.counter = verification.authenticationInfo.newCounter;
      await storeJSON(env.CERTIFICATES, SAVED_KEY, saved);
      // Session valable uniquement sur le Worker de prévisualisation.
      // Le code de production et les aides chiffrées restent inchangés.
      const session = await issuePasskeySession(env);
      return reply({ ok: true, verified: true, testOnly: true, cloudflareSession: true, ...session });
    } catch {
      return reply({ ok: false, error: "verification_failed" }, 401);
    }
  }

  return reply({ ok: false, error: "not_found" }, 404);
}
