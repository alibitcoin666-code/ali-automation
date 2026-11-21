import { log, withRetry } from "./util";

/**
 * Gemini Interactions API (https://ai.google.dev/gemini-api/docs/interactions).
 * The key is read from GEMINI_API_KEY (GitHub Secret) and sent only as the
 * x-goog-api-key header; it is never logged.
 */
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

export class GeminiError extends Error {
  constructor(message: string, public status?: number, public quota = false) {
    super(message);
  }
}

async function call(body: unknown): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY missing");
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  if (!r.ok) throw new GeminiError(`Gemini HTTP ${r.status}: ${txt.slice(0, 400)}`, r.status, r.status === 429);
  return JSON.parse(txt);
}

/** Walk the interaction and collect model output parts. */
function collect(resp: unknown, kind: "text" | "audio"): string[] {
  const out: string[] = [];
  const visit = (v: unknown, parentType?: string) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach((x) => visit(x, parentType));
    const o = v as Record<string, unknown>;
    const type = typeof o.type === "string" ? o.type : parentType;
    if (type === "user_input" || type === "thought") return;
    if (kind === "text" && typeof o.text === "string" && type !== "thought") out.push(o.text);
    if (kind === "audio" && typeof o.data === "string" && o.data.length > 100) out.push(o.data);
    // legacy generateContent shape
    if (kind === "audio" && o.inlineData && typeof (o.inlineData as { data?: string }).data === "string") out.push((o.inlineData as { data: string }).data);
    for (const [k, val] of Object.entries(o)) if (k !== "data" && k !== "text") visit(val, type);
  };
  visit((resp as { steps?: unknown }).steps ?? (resp as { outputs?: unknown }).outputs ?? resp);
  return out;
}

export async function generateJson(opts: { models: string[]; system: string; prompt: string; schema: unknown; temperature?: number }): Promise<{ model: string; text: string }> {
  let last: unknown;
  for (const model of opts.models) {
    try {
      const resp = await withRetry(`gemini ${model}`, () =>
        call({
          model,
          system_instruction: opts.system,
          input: opts.prompt,
          generation_config: { temperature: opts.temperature ?? 0.7 },
          response_format: { type: "text", mime_type: "application/json", schema: opts.schema },
        }),
      );
      const text = collect(resp, "text").join("").trim();
      if (!text) throw new GeminiError("empty model output");
      return { model, text };
    } catch (e) {
      last = e;
      log(`[gemini] ${model} failed, trying fallback: ${(e as Error).message.slice(0, 200)}`);
    }
  }
  throw last;
}

/** Single-speaker TTS. Returns WAV/PCM bytes (24 kHz mono s16le). */
export async function tts(opts: { model: string; voice: string; text: string; style?: string }): Promise<{ bytes: Buffer; isWav: boolean }> {
  const resp = await call({
    model: opts.model,
    input: [{ type: "user_input", content: [{ type: "text", text: opts.text, ...(opts.style ? { annotations: [{ type: "speech_metadata", style: opts.style }] } : {}) }] }],
    response_format: { type: "audio" },
    generation_config: { speech_config: [{ voice: opts.voice }] },
  });
  const parts = collect(resp, "audio");
  if (!parts.length) throw new GeminiError("no audio in TTS response");
  const bytes = Buffer.concat(parts.map((p) => Buffer.from(p, "base64")));
  return { bytes, isWav: bytes.subarray(0, 4).toString("ascii") === "RIFF" };
}
