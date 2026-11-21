import { webhookCallback } from "grammy";
import type { Env } from "./env";
import { enabled } from "./env";
import { makeBot } from "./bot";
import { verifyCallback, verifyMedia, safeEqual, signMedia } from "./crypto";
import { consumeMagic, confirmPage, hasSession, sessionCookie, logout, COOKIE } from "./auth";
import { listJobs, getJob, events, todayCount } from "./db";
import { onCallback, startJob, approve, reject, cancel, edit, THEMES, type CallbackPayload } from "./jobs";
import { ownerId } from "./env";
import { Store, storeStub, d1Shim, mediaShim } from "./store";
import { rpc } from "./rpc";

export { Store };

/** Attaches the Durable-Object-backed DB / MEDIA views and the claimed owner id. */
async function bindEnv(raw: Env): Promise<Env> {
  const stub = storeStub(raw.STORE);
  const env: Env = { ...raw, DB: d1Shim(stub), MEDIA: mediaShim(stub) };
  if (!env.OWNER_ID) env.OWNER_ID = (await stub.getSetting("owner_id")) ?? "";
  return env;
}

const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
};

/**
 * Streams a stored object with HTTP Range support (needed for video seeking in the panel).
 * Small blobs come from the Durable Object; large media are proxied from their GitHub Release asset.
 */
async function serveObject(env: Env, req: Request, key: string): Promise<Response> {
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response("not found", { status: 404 });
  const h = new Headers(SECURITY_HEADERS);
  h.set("content-type", obj.ctype || guessType(key));
  h.set("accept-ranges", "bytes");
  h.set("cache-control", "private, max-age=3600");
  const range = req.headers.get("range");
  if (obj.url) {
    const up = await fetch(obj.url, { headers: range ? { range } : {}, redirect: "follow" });
    for (const k of ["content-length", "content-range", "etag", "last-modified"]) {
      const v = up.headers.get(k);
      if (v) h.set(k, v);
    }
    return new Response(up.body, { status: up.status === 206 ? 206 : up.ok ? 200 : up.status, headers: h });
  }
  const data = new Uint8Array(obj.data ?? new ArrayBuffer(0));
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (m && (m[1] || m[2])) {
    const size = data.byteLength;
    const startB = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const endB = m[1] && m[2] ? Math.min(size - 1, Number(m[2])) : size - 1;
    if (startB >= size || startB > endB) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    h.set("content-range", `bytes ${startB}-${endB}/${size}`);
    h.set("content-length", String(endB - startB + 1));
    return new Response(data.slice(startB, endB + 1), { status: 206, headers: h });
  }
  h.set("content-length", String(data.byteLength));
  return new Response(data, { headers: h });
}

const guessType = (k: string) =>
  ({ mp4: "video/mp4", png: "image/png", jpg: "image/jpeg", json: "application/json", srt: "application/x-subrip; charset=utf-8", txt: "text/plain; charset=utf-8", wav: "audio/wav", m4a: "audio/mp4" })[
    k.split(".").pop() ?? ""
  ] ?? "application/octet-stream";

const JOB_ID = /^[0-9]{8}-[0-9a-z]{6}$/;

async function api(env: Env, req: Request, url: URL): Promise<Response> {
  if (url.pathname === "/api/health") return json({ ok: true, enabled: enabled(env), bot: !!env.BOT_TOKEN, owner: ownerId(env) > 0 });
  if (!(await hasSession(env, req))) return json({ error: "unauthorized" }, 401);
  const parts = url.pathname.split("/").filter(Boolean); // ["api", ...]
  const m = req.method;

  if (parts[1] === "me") return json({ owner: ownerId(env), enabled: enabled(env), today: await todayCount(env), cap: Number(env.DAILY_CAP || 6) });
  if (parts[1] === "logout" && m === "POST") {
    await logout(env, req);
    return json({ ok: true }, 200, { "set-cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` });
  }
  if (parts[1] === "templates") return json(THEMES);
  if (parts[1] === "jobs" && parts.length === 2) {
    if (m === "GET") return json(await listJobs(env, 50));
    if (m === "POST") {
      const r = await startJob(env, ownerId(env), await req.json());
      return json(r, r.ok ? 201 : 400);
    }
  }
  if (parts[1] === "jobs" && parts[2]) {
    const id = parts[2];
    if (!JOB_ID.test(id)) return json({ error: "bad id" }, 400);
    const j = await getJob(env, id);
    if (!j) return json({ error: "not found" }, 404);
    const action = parts[3];
    if (!action && m === "GET") {
      // Every published artifact of the job (the render workflow uploads only reviewable outputs).
      const files: Record<string, string> = {};
      const listed = await env.MEDIA.list({ prefix: `jobs/${id}/`, limit: 200 });
      for (const o of listed.objects) {
        const rel = o.key.slice(`jobs/${id}/`.length);
        if (/^(storyboard\.json|render\/plan-(preview|final)\.json|qa\/(report\.json|proof-sheet\.png)|audio\/final\.m4a|out\/[^/]+)$/.test(rel))
          files[rel] = await signMedia(env.SESSION_SECRET, o.key, 6 * 3600);
      }
      return json({ job: j, events: await events(env, id), files });
    }
    if (m === "POST") {
      const body = (await req.json().catch(() => ({}))) as { stage?: "s" | "p"; note?: string };
      if (action === "approve") return json({ message: await approve(env, id, body.stage ?? (j.status === "preview_review" ? "p" : "s")) });
      if (action === "reject") return json({ message: await reject(env, id) });
      if (action === "cancel") return json({ message: await cancel(env, id) });
      if (action === "edit" && body.note) return json({ message: await edit(env, id, body.note) });
    }
  }
  return json({ error: "not found" }, 404);
}

export default {
  async fetch(req: Request, rawEnv: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (url.pathname === "/health") return json({ ok: true, enabled: enabled(rawEnv), bot: !!rawEnv.BOT_TOKEN });
      const env = await bindEnv(rawEnv);
      // Telegram webhook — verified with the secret_token header (setWebhook secret_token).
      if (url.pathname === "/tg/webhook" && req.method === "POST") {
        if (!env.BOT_TOKEN || !env.TG_WEBHOOK_SECRET) return new Response("bot not configured", { status: 503 });
        if (!safeEqual(req.headers.get("x-telegram-bot-api-secret-token") ?? "", env.TG_WEBHOOK_SECRET)) return new Response("forbidden", { status: 403 });
        return await webhookCallback(makeBot(env), "cloudflare-mod")(req);
      }
      // Stage callbacks from GitHub Actions — HMAC-signed.
      if (url.pathname === "/cb/github" && req.method === "POST") {
        const body = await req.text();
        if (!(await verifyCallback(env.CALLBACK_SECRET, req.headers.get("x-amf-timestamp"), req.headers.get("x-amf-signature"), body)))
          return new Response("bad signature", { status: 401 });
        const p = JSON.parse(body) as CallbackPayload;
        if (!JOB_ID.test(p.jobId)) return new Response("bad id", { status: 400 });
        ctx.waitUntil(onCallback(env, p).catch((e) => console.error("callback failed", p.jobId, (e as Error).message)));
        return json({ ok: true });
      }
      // Storage / queue / AI RPC for the Actions workflows — HMAC-signed, same scheme as /cb/github.
      if (url.pathname === "/cb/rpc" && req.method === "POST") {
        const body = await req.text();
        if (!(await verifyCallback(env.CALLBACK_SECRET, req.headers.get("x-amf-timestamp"), req.headers.get("x-amf-signature"), body)))
          return new Response("bad signature", { status: 401 });
        return await rpc(env, JSON.parse(body));
      }
      // Magic-link login (GET shows a confirm button; only POST consumes the one-time token).
      if (url.pathname === "/auth") {
        if (req.method === "GET") return new Response(confirmPage(url.searchParams.get("t") ?? ""), { headers: { "content-type": "text/html; charset=utf-8", ...SECURITY_HEADERS } });
        const form = await req.formData();
        const s = await consumeMagic(env, String(form.get("t") ?? ""));
        if (!s) return new Response("لینک منقضی یا استفاده‌شده است. در ربات /panel را بزنید.", { status: 401, headers: { "content-type": "text/plain; charset=utf-8" } });
        return new Response(null, { status: 303, headers: { location: "/panel/", "set-cookie": sessionCookie(s) } });
      }
      // Signed media links (Telegram + panel).
      if (url.pathname.startsWith("/m/")) {
        const key = decodeURIComponent(url.pathname.slice(3));
        if (!key.startsWith("jobs/") || key.includes("..")) return new Response("bad key", { status: 400 });
        if (!(await verifyMedia(env.SESSION_SECRET, key, url.searchParams.get("e"), url.searchParams.get("s")))) return new Response("forbidden", { status: 403 });
        return await serveObject(env, req, key);
      }
      if (url.pathname.startsWith("/api/")) return await api(env, req, url);
      if (url.pathname === "/") return Response.redirect(`${url.origin}/panel/`, 302);
      return env.ASSETS.fetch(req);
    } catch (e) {
      console.error("request failed", url.pathname, (e as Error).message);
      return json({ error: "internal error" }, 500);
    }
  },

  /** Daily housekeeping: expire sessions / magic tokens and old wizard drafts. */
  async scheduled(_c: ScheduledController, rawEnv: Env): Promise<void> {
    const env = await bindEnv(rawEnv);
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM magic WHERE expires_at < ?1`).bind(now),
      env.DB.prepare(`DELETE FROM sessions WHERE expires_at < ?1`).bind(now),
      env.DB.prepare(`DELETE FROM drafts WHERE updated_at < ?1`).bind(now - 2 * 24 * 3600 * 1000),
    ]);
  },
} satisfies ExportedHandler<Env>;
