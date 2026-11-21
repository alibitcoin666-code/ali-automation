import type { Env } from "./env";
import { storeStub } from "./store";
import { startJob, approve } from "./jobs";
import { getJob, events } from "./db";
import { ownerId } from "./env";

/**
 * POST /cb/rpc — called only by the GitHub Actions workflows (HMAC-verified in index.ts).
 * Keeps every credential on the Cloudflare side: the workflows never need an R2 key or an AI token.
 */
export type RpcCall =
  | { op: "getBlob"; key: string }
  | { op: "putBlob"; key: string; b64: string; ctype?: string }
  | { op: "putLink"; key: string; url: string; size: number; ctype?: string }
  | { op: "list"; prefix: string }
  | { op: "claim"; max?: number }
  /* end-to-end test harness (e2e.yml) — same guard, cap and queue as the bot */
  | { op: "createJob"; request: unknown }
  | { op: "job"; id: string }
  | { op: "approve"; id: string; stage: "s" | "p" }
  | { op: "flux"; prompt: string; steps?: number; seed?: number }
  | { op: "text"; model?: string; messages: { role: "system" | "user" | "assistant"; content: string }[]; max_tokens?: number; temperature?: number };

const KEY = /^jobs\/[0-9]{8}-[0-9a-z]{6}\/[A-Za-z0-9._\/-]{1,160}$/;
const TEXT_MODELS = new Set(["@cf/openai/gpt-oss-120b", "@cf/openai/gpt-oss-20b", "@cf/meta/llama-4-scout-17b-16e-instruct", "@cf/qwen/qwen3-30b-a3b-fp8"]);
const MAX_BLOB = 1024 * 1024; // larger files go to GitHub Releases (putLink)

const j = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export async function rpc(env: Env, c: RpcCall): Promise<Response> {
  const s = storeStub(env.STORE);
  switch (c.op) {
    case "getBlob": {
      if (!KEY.test(c.key) || c.key.includes("..")) return j({ error: "bad key" }, 400);
      const b = await s.getBlob(c.key);
      if (!b) return j({ error: "not found" }, 404);
      if (b.url) return Response.redirect(b.url, 302); // fetch follows (POST → GET on 302)
      return new Response(b.data, { headers: { "content-type": b.ctype || "application/octet-stream" } });
    }
    case "putBlob": {
      if (!KEY.test(c.key) || c.key.includes("..")) return j({ error: "bad key" }, 400);
      const bin = Uint8Array.from(atob(c.b64), (ch) => ch.charCodeAt(0));
      if (bin.byteLength > MAX_BLOB) return j({ error: "too large — use putLink" }, 413);
      await s.putBlob(c.key, bin.buffer, null, bin.byteLength, c.ctype ?? "");
      return j({ ok: true, size: bin.byteLength });
    }
    case "putLink": {
      if (!KEY.test(c.key) || c.key.includes("..")) return j({ error: "bad key" }, 400);
      if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/releases\/download\//.test(c.url)) return j({ error: "only GitHub release asset links" }, 400);
      await s.putBlob(c.key, null, c.url, Math.max(0, Math.floor(c.size)), c.ctype ?? "");
      return j({ ok: true });
    }
    case "list":
      if (!/^jobs\/[0-9]{8}-[0-9a-z]{6}\/$/.test(c.prefix)) return j({ error: "bad prefix" }, 400);
      return j(await s.listBlobs(c.prefix, 500));
    case "createJob":
      return j(await startJob(env, ownerId(env), c.request));
    case "job": {
      if (!/^[0-9]{8}-[0-9a-z]{6}$/.test(c.id)) return j({ error: "bad id" }, 400);
      return j({ job: await getJob(env, c.id), events: await events(env, c.id) });
    }
    case "approve":
      if (!/^[0-9]{8}-[0-9a-z]{6}$/.test(c.id)) return j({ error: "bad id" }, 400);
      return j({ message: await approve(env, c.id, c.stage) });
    case "claim":
      return j(await s.claim(Math.min(8, c.max ?? 4)));
    case "flux": {
      // https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/ — returns { image: base64 JPEG }
      const r = (await (env.AI.run as (m: string, i: unknown) => Promise<unknown>)("@cf/black-forest-labs/flux-1-schnell", { prompt: c.prompt.slice(0, 2048), steps: Math.min(8, c.steps ?? 8), seed: c.seed })) as { image?: string };
      return r.image ? j({ image: r.image }) : j({ error: "no image" }, 502);
    }
    case "text": {
      const model = c.model && TEXT_MODELS.has(c.model) ? c.model : "@cf/openai/gpt-oss-120b";
      const r = await (env.AI.run as (m: string, i: unknown) => Promise<unknown>)(model, { messages: c.messages, max_tokens: Math.min(8000, c.max_tokens ?? 4000), temperature: c.temperature ?? 0.6 });
      return j({ model, result: r });
    }
    default:
      return j({ error: "unknown op" }, 400);
  }
}
