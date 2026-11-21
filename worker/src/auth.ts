import type { Env } from "./env";
import { randomToken, sha256 } from "./crypto";

const MAGIC_TTL = 10 * 60 * 1000;
const SESSION_TTL = 7 * 24 * 3600 * 1000;
export const COOKIE = "amf_s";

/** One-time panel login token sent by the bot (/panel). Only its hash is stored. */
export async function createMagic(env: Env): Promise<string> {
  const t = randomToken();
  await env.DB.prepare(`DELETE FROM magic WHERE expires_at < ?1`).bind(Date.now()).run();
  await env.DB.prepare(`INSERT INTO magic (token_hash, expires_at) VALUES (?1, ?2)`).bind(await sha256(t), Date.now() + MAGIC_TTL).run();
  return t;
}

/** Consumes the magic token atomically; returns a new session token or null. */
export async function consumeMagic(env: Env, t: string): Promise<string | null> {
  const r = await env.DB.prepare(`UPDATE magic SET used = 1 WHERE token_hash = ?1 AND used = 0 AND expires_at > ?2`)
    .bind(await sha256(t), Date.now())
    .run();
  if (!r.meta.changes) return null;
  const s = randomToken();
  await env.DB.prepare(`INSERT INTO sessions (token_hash, expires_at) VALUES (?1, ?2)`).bind(await sha256(s), Date.now() + SESSION_TTL).run();
  return s;
}

export function readCookie(req: Request, name = COOKIE): string | null {
  const c = req.headers.get("cookie") ?? "";
  for (const part of c.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1);
  }
  return null;
}

export async function hasSession(env: Env, req: Request): Promise<boolean> {
  const s = readCookie(req);
  if (!s) return false;
  const r = await env.DB.prepare(`SELECT 1 AS ok FROM sessions WHERE token_hash = ?1 AND expires_at > ?2`).bind(await sha256(s), Date.now()).first();
  return !!r;
}

export const sessionCookie = (s: string) => `${COOKIE}=${s}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}`;

export async function logout(env: Env, req: Request) {
  const s = readCookie(req);
  if (s) await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?1`).bind(await sha256(s)).run();
}

/** Confirmation page: link previews (GET) never consume the token — only the POST does. */
export const confirmPage = (t: string) => `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>ورود به پنل</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0d12;color:#f1ece2;font:16px/1.6 system-ui,sans-serif}
form{background:#151922;padding:32px 36px;border-radius:14px;border:1px solid #2a2f3a;text-align:center}
button{margin-top:16px;font:inherit;padding:10px 28px;border-radius:10px;border:0;background:#c9a45c;color:#111;cursor:pointer}</style></head>
<body><form method="post" action="/auth"><div>ورود به پنل کارخانه‌ی موشن علی</div><input type="hidden" name="t" value="${t.replace(/[^A-Za-z0-9_-]/g, "")}"><button type="submit">ورود</button></form></body></html>`;
