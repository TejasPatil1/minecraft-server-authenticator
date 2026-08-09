// Uses Web Crypto (not Node's `crypto` module) so this works identically in
// the Edge middleware runtime and in Node API routes.

export const SESSION_COOKIE_NAME = "mc_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

const encoder = new TextEncoder();

async function importKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bufToHex(sig);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionCookieValue(secret: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${expiresAt}`;
  const sig = await sign(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifySessionCookieValue(
  cookie: string | undefined,
  secret: string
): Promise<boolean> {
  if (!cookie) return false;
  const [payload, sig] = cookie.split(".");
  if (!payload || !sig) return false;
  if (Date.now() > Number(payload)) return false; // expired
  const expected = await sign(payload, secret);
  return constantTimeEqual(expected, sig);
}

export const SESSION_COOKIE_MAX_AGE = SESSION_MAX_AGE_SECONDS;
