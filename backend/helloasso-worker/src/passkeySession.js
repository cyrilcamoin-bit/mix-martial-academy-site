/**
 * Session temporaire après authentification WebAuthn vérifiée.
 *
 * Jeton opaque de 256 bits ; seul son hash SHA-256 est stocké dans R2.
 * Aucun secret admin ni mot de passe ne quitte Cloudflare.
 * Durée courte, aucune persistance entre sessions Safari.
 */
const PREFIX = "passkey-preview/session/";
const TTL_MS = 20 * 60 * 1000;
const textEncoder = new TextEncoder();

function base64url(bytes) {
  let result = "";
  for (let start = 0; start < bytes.length; start += 8192) {
    result += String.fromCharCode(...bytes.subarray(start, start + 8192));
  }
  return btoa(result).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sessionKey(token) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(token));
  return PREFIX + base64url(new Uint8Array(digest));
}

export async function issuePasskeySession(env) {
  if (!env.CERTIFICATES) throw new Error("passkey_storage_unavailable");
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = "mma-fid1." + base64url(bytes);
  const expiresAt = Date.now() + TTL_MS;
  await env.CERTIFICATES.put(
    await sessionKey(token),
    JSON.stringify({ purpose: "mma-admin", expiresAt }),
    { httpMetadata: { contentType: "application/json", cacheControl: "no-store" } }
  );
  return { token, expiresAt: new Date(expiresAt).toISOString(), expiresIn: TTL_MS / 1000 };
}

export async function verifyPasskeySession(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const match = /^Bearer (mma-fid1\.[A-Za-z0-9_-]{43})$/.exec(authorization);
  if (!match || !env.CERTIFICATES) return false;
  const key = await sessionKey(match[1]);
  const object = await env.CERTIFICATES.get(key);
  if (!object) return false;
  try {
    const saved = await object.json();
    if (saved?.purpose === "mma-admin" && Number(saved.expiresAt) > Date.now()) {
      return true;
    }
  } catch { /* Invalid record must never grant access. */ }
  await env.CERTIFICATES.delete(key);
  return false;
}

export async function revokePasskeySession(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const match = /^Bearer (mma-fid1\.[A-Za-z0-9_-]{43})$/.exec(authorization);
  if (!match || !env.CERTIFICATES) return;
  await env.CERTIFICATES.delete(await sessionKey(match[1]));
}
