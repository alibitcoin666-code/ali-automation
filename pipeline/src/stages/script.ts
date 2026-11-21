import { guardStoryboard } from "./guard";
import { z } from "zod";
import { MotionStyleId, STRUCTURE, Storyboard, TransitionId, type JobRequest } from "../core/schemas";
import { normalizePersian, screenDigits } from "../core/persian/normalize";
import { spellCheck, type SpellFlag } from "../core/persian/spell";
import { generateJson } from "../lib/gemini";
import { loadBrand } from "../lib/brand";
import { log, sha256 } from "../lib/util";

export const SCRIPT_MODELS = (process.env.AMF_SCRIPT_MODELS ?? "gemini-3.8-flash,gemini-3.5-flash-lite").split(",");

/** Words per second of natural Persian narration (measured on Dilara/Sulafat ≈ 2.3). */
export const WPS = 2.3;

/** Gemini-facing JSON schema: flat and small (constraints are re-checked by zod). */
function draftSchema(styles: string[]) {
  const str = { type: "string" };
  return {
    type: "object",
    properties: {
      title: str,
      mainStyle: { type: "string", enum: styles },
      accentStyles: { type: "array", items: { type: "string", enum: styles }, maxItems: 2 },
      scenes: {
        type: "array",
        minItems: 3,
        maxItems: 12,
        items: {
          type: "object",
          properties: {
            sceneType: { type: "string", enum: [...new Set(Object.values(STRUCTURE).flat(2))] },
            voiceText: { ...str, description: "Narration in fluent spoken Persian. Natural sentences, no lists, no emojis." },
            onScreenText: { type: "array", items: { ...str, description: "Short headline, max 6 words, NOT a copy of voiceText" }, maxItems: 2 },
            style: { type: "string", enum: styles },
            visualPrompt: { ...str, description: "English image prompt, photographic or illustrative, absolutely no text, letters or logos" },
            icons: { type: "array", items: str, maxItems: 3 },
            emphasis: { type: "array", items: str, maxItems: 3 },
            transitionIn: { type: "string", enum: TransitionId.options },
            sources: { type: "array", items: { type: "object", properties: { label: str, url: str }, required: ["label", "url"] } },
            chart: {
              type: ["object", "null"],
              properties: {
                kind: { type: "string", enum: ["bar", "counter", "progress", "timeline"] },
                title: str,
                series: { type: "array", maxItems: 6, items: { type: "object", properties: { label: str, value: { type: "number" } }, required: ["label", "value"] } },
                unit: str,
              },
            },
          },
          required: ["sceneType", "voiceText", "onScreenText", "style", "visualPrompt", "transitionIn"],
        },
      },
      youtube: {
        type: "object",
        properties: { title: str, description: str, hashtags: { type: "array", items: str, maxItems: 12 } },
        required: ["title", "description", "hashtags"],
      },
    },
    required: ["title", "mainStyle", "accentStyles", "scenes", "youtube"],
  };
}

const Draft = z.object({
  title: z.string(),
  mainStyle: MotionStyleId,
  accentStyles: z.array(MotionStyleId).max(2),
  scenes: z.array(
    z.object({
      sceneType: z.string(),
      voiceText: z.string(),
      onScreenText: z.array(z.string()).default([]),
      style: MotionStyleId,
      visualPrompt: z.string(),
      icons: z.array(z.string()).default([]),
      emphasis: z.array(z.string()).default([]),
      transitionIn: TransitionId,
      sources: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
      chart: z.any().nullable().optional(),
    }),
  ),
  youtube: z.object({ title: z.string(), description: z.string(), hashtags: z.array(z.string()) }),
});

function systemPrompt(req: JobRequest, brand: ReturnType<typeof loadBrand>): string {
  const words = Math.round(req.durationSec * WPS * 0.82);
  const structure = STRUCTURE[req.type].map((s) => s.join("|")).join(" → ");
  return [
    `You are the head writer of the YouTube channel "${brand.theme.displayName}". Write in natural, modern, spoken Persian (fa-IR), the way a skilled Iranian presenter talks. Never translate literally from English.`,
    `Video type ${req.type}. Scene structure (in order): ${structure}. EDUCATIONAL may have 3-5 steps.`,
    `Total narration ≈ ${words} words for ≈ ${req.durationSec}s. Each scene 8-30 words of voiceText, ending with proper Persian punctuation (. ؟ !).`,
    `Use Persian punctuation « » ، ؛ ؟ and ZWNJ (نیم‌فاصله) correctly: می‌خواهیم، کتاب‌ها، بزرگ‌تر. Use the letters ی and ک only.`,
    `Write numbers in voiceText as digits only when short (e.g. 3, 2026); never use symbols like & or / in voiceText.`,
    `onScreenText is SEPARATE on-screen typography: 1-2 punchy headlines of max 6 words each, never a copy or near-copy of voiceText.`,
    `Allowed styles for this channel: ${brand.theme.allowedStyles.join(", ")}. Use one mainStyle and up to 2 accentStyles; every scene style must be one of them.`,
    `visualPrompt is in English, describes a cinematic image WITHOUT any text, letters, numbers, signs or logos.`,
    req.type === "NEWS"
      ? `Every fact scene MUST cite at least one of the provided sources (label + exact url). Do not invent sources or facts. Only use facts present in the provided points/sources.`
      : `Do not invent statistics. Only use numbers given by the user.`,
    brand.theme.id === "onehandonedream" ? `The presenter Ali Baghbani plays with his LEFT hand only. Never mention a right hand.` : ``,
    `youtube.title ≤ 90 chars, Persian, curiosity-driven but honest. description 2-4 short Persian paragraphs. 6-10 hashtags without spaces.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function userPrompt(req: JobRequest): string {
  return [
    `Topic: ${req.topic}`,
    req.points.length ? `Key points:\n- ${req.points.join("\n- ")}` : "",
    req.sources.length ? `Sources:\n${req.sources.map((s) => `- ${s.label}: ${s.url}`).join("\n")}` : "",
    `Format: ${req.format === "shorts_9x16" ? "YouTube Shorts (vertical, fast pace, hook in first 2 seconds)" : "YouTube landscape 16:9"}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Convert a draft into a validated, normalized Storyboard. Throws ZodError with readable issues. */
export function finalizeDraft(jobId: string, req: JobRequest, draft: z.infer<typeof Draft>): Storyboard {
  const sb = {
    version: 1 as const,
    jobId,
    type: req.type,
    channel: req.channel,
    format: req.format,
    language: "fa-IR" as const,
    title: normalizePersian(draft.title),
    mainStyle: req.style ?? draft.mainStyle,
    accentStyles: draft.accentStyles.filter((s) => s !== (req.style ?? draft.mainStyle)),
    scenes: draft.scenes.map((s, i) => ({
      id: `s${i + 1}`,
      sceneType: s.sceneType,
      voiceText: normalizePersian(s.voiceText),
      onScreenText: s.onScreenText.map((t) => screenDigits(normalizePersian(t))).filter(Boolean).slice(0, 2),
      style: s.style,
      visual: { prompt: s.visualPrompt, source: "flux" as const, noTextInImage: true as const },
      icons: s.icons,
      chart: s.chart ?? undefined,
      sources: s.sources,
      transitionIn: s.transitionIn,
      emphasis: s.emphasis.map(normalizePersian),
    })),
    youtube: {
      title: normalizePersian(draft.youtube.title).slice(0, 100),
      description: normalizePersian(draft.youtube.description),
      hashtags: draft.youtube.hashtags.map((h) => "#" + h.replace(/^#/, "").replace(/\s+/g, "_")),
    },
    factCheckConfirmed: false,
  };
  // When the request forces a style, any scene style outside main/accent is coerced to it.
  const allowed = new Set([sb.mainStyle, ...sb.accentStyles]);
  for (const s of sb.scenes) if (!allowed.has(s.style)) s.style = sb.mainStyle;
  return Storyboard.parse(sb);
}

export function hashScript(sb: Storyboard): string {
  return sha256(JSON.stringify(sb.scenes.map((s) => [s.id, s.voiceText, s.onScreenText])));
}

export interface ScriptResult {
  storyboard: Storyboard;
  model: string;
  repaired: boolean;
  spell: SpellFlag[];
}

/** Script stage: Gemini JSON → zod; one automatic repair round with the validation errors. */
export async function writeScript(jobId: string, req: JobRequest, opts: { edits?: string[]; previous?: Storyboard } = {}): Promise<ScriptResult> {
  const brand = loadBrand(req.channel);
  const schema = draftSchema(brand.theme.allowedStyles);
  const system = systemPrompt(req, brand);
  const revision = opts.edits?.length
    ? `\n\nThis is a REVISION. The owner asked for these changes (apply all of them, keep everything else):\n- ${opts.edits.join("\n- ")}` +
      (opts.previous ? `\n\nPrevious version (JSON):\n${JSON.stringify({ title: opts.previous.title, scenes: opts.previous.scenes.map((x) => ({ sceneType: x.sceneType, voiceText: x.voiceText, onScreenText: x.onScreenText })) })}` : "")
    : "";
  const base = userPrompt(req) + revision;
  let prompt = base;
  let repaired = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { model, text } = await generateJson({ models: SCRIPT_MODELS, system, prompt, schema });
    try {
      const draft = Draft.parse(JSON.parse(text));
      const storyboard = finalizeDraft(jobId, req, draft);
      storyboard.scriptHash = hashScript(storyboard);
      const g = guardStoryboard(storyboard);
      const brandIssues = g.reasons.filter((r) => !r.startsWith("NEWS"));
      if (brandIssues.length) throw new Error(`brand rules: ${brandIssues.join("; ")}`);
      const spell = spellCheck(storyboard.scenes, brand.dictionary);
      return { storyboard, model, repaired, spell };
    } catch (e) {
      if (attempt === 1) throw e;
      const issues = e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n") : String(e);
      log(`[script] validation failed, auto-repair once:\n${issues}`);
      repaired = true;
      prompt = `${base}\n\nYour previous JSON was invalid. Fix ALL of these problems and return the full corrected JSON:\n${issues}\n\nPrevious JSON:\n${text}`;
    }
  }
  throw new Error("unreachable");
}
