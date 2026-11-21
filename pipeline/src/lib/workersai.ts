import crypto from "node:crypto";
import { log, withRetry } from "./util";

/**
 * Fallback script model when no GEMINI_API_KEY is configured: Workers AI (@cf/openai/gpt-oss-120b)
 * through the Worker's AI binding — POST <AMF_PUBLIC_URL>/cb/rpc {op:"text"}, HMAC-signed with CALLBACK_SECRET.
 * Model page: https://developers.cloudflare.com/workers-ai/models/gpt-oss-120b/
 */
export const workersAiAvailable = () => !!(process.env.AMF_PUBLIC_URL && process.env.CALLBACK_SECRET);

async function rpc(call: unknown): Promise<unknown> {
  const url = `${process.env.AMF_PUBLIC_URL!.replace(/\/+$/, "")}/cb/rpc`;
  const body = JSON.stringify(call);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac("sha256", process.env.CALLBACK_SECRET!).update(`${ts}.${body}`).digest("hex");
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-amf-timestamp": ts, "x-amf-signature": sig }, body });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Workers AI rpc HTTP ${r.status}: ${txt.slice(0, 300)}`);
  return JSON.parse(txt);
}

/** Pulls the assistant text out of the several response shapes Workers AI text models use. */
export function extractText(res: unknown): string {
  const r = (res as { result?: unknown }).result ?? res;
  if (typeof r === "string") return r;
  const o = r as Record<string, unknown>;
  if (typeof o.response === "string") return o.response;
  const choices = o.choices as { message?: { content?: string } }[] | undefined;
  if (choices?.[0]?.message?.content) return choices[0].message.content;
  const output = o.output as { type?: string; content?: { type?: string; text?: string }[] }[] | undefined;
  if (Array.isArray(output)) return output.filter((x) => x.type === "message").flatMap((x) => x.content ?? []).map((c) => c.text ?? "").join("");
  return "";
}

/** First top-level JSON object in a model reply (tolerates code fences / prose around it). */
export function firstJson(text: string): string {
  const t = text.replace(/```(?:json)?/g, "");
  const start = t.indexOf("{");
  if (start < 0) return t.trim();
  let depth = 0;
  let inStr = false;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return t.slice(start, i + 1);
  }
  return t.slice(start).trim();
}

export async function workersAiJson(opts: { system: string; prompt: string; schema: unknown; temperature?: number }): Promise<{ model: string; text: string }> {
  const model = process.env.AMF_WORKERS_AI_MODEL ?? "@cf/openai/gpt-oss-120b";
  const system = `${opts.system}\n\nReturn ONLY one JSON object that validates against this JSON Schema (no prose, no code fences):\n${JSON.stringify(opts.schema)}`;
  const res = await withRetry(`workers-ai ${model}`, () =>
    rpc({ op: "text", model, messages: [{ role: "system", content: system }, { role: "user", content: opts.prompt }], max_tokens: 6000, temperature: opts.temperature ?? 0.6 }),
  );
  const text = firstJson(extractText(res));
  if (!text) throw new Error("Workers AI returned no text");
  log(`[script] Workers AI fallback used (${model})`);
  return { model, text };
}
