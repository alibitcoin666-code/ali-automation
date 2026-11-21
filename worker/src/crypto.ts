const enc = new TextEncoder();

export const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function sha256(s: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

export async function hmac(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}

/** Constant-time comparison of two hex / ascii strings. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function randomToken(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Signed, expiring media link: /m/<key>?e=<exp>&s=<sig>. Lets Telegram / the panel fetch R2 objects without a cookie. */
export async function signMedia(secret: string, key: string, ttlSec = 3600 * 24 * 3): Promise<string> {
  const e = Math.floor(Date.now() / 1000) + ttlSec;
  const s = await hmac(secret, `${key}:${e}`);
  return `/m/${key.split("/").map(encodeURIComponent).join("/")}?e=${e}&s=${s}`;
}

export async function verifyMedia(secret: string, key: string, e: string | null, s: string | null): Promise<boolean> {
  if (!e || !s || Number(e) < Date.now() / 1000) return false;
  return safeEqual(await hmac(secret, `${key}:${e}`), s);
}

/** Verifies an Actions callback: X-AMF-Timestamp + X-AMF-Signature = hmac(ts + "." + body). */
export async function verifyCallback(secret: string, ts: string | null, sig: string | null, body: string): Promise<boolean> {
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  return safeEqual(await hmac(secret, `${ts}.${body}`), sig);
}
