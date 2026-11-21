import fs from "node:fs";
import path from "node:path";
import type { Storyboard } from "../core/schemas";
import { ttsText } from "../core/spoken";
import { tts, GeminiError } from "../lib/gemini";
import { loadBrand } from "../lib/brand";
import { JobDir, log, run, withRetry } from "../lib/util";

export const TTS_CHAIN = (process.env.AMF_TTS_CHAIN ?? "gemini-3.8-flash-tts,gemini-3.8-flash-lite-tts,edge").split(",");
const EDGE = process.env.AMF_EDGE_TTS ?? path.join(process.env.HOME ?? "", ".venv-align/bin/edge-tts");

export interface VoiceScene {
  id: string;
  file: string; // 48 kHz stereo s16 wav, trimmed of leading/trailing silence
  durationMs: number;
  provider: string;
}

async function probeMs(file: string): Promise<number> {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { quiet: true });
  return Math.round(parseFloat(stdout.trim()) * 1000);
}

/** Normalise any TTS output to 48 kHz stereo wav with ~40 ms head/tail silence trimmed. */
async function toMaster(input: string, out: string, rawPcm24k = false) {
  const inArgs = rawPcm24k ? ["-f", "s16le", "-ar", "24000", "-ac", "1", "-i", input] : ["-i", input];
  const trim =
    "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.04," +
    "areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.06,areverse";
  const tmp = out + ".trim.wav";
  await run("ffmpeg", ["-y", "-v", "error", ...inArgs, "-af", `${trim},aresample=48000:resampler=soxr`, "-ac", "2", "-c:a", "pcm_s16le", tmp], { quiet: true });
  await capPauses(tmp, out);
  fs.rmSync(tmp, { force: true });
}

/** Max internal pause kept inside one scene's voice (QA fails any silence > 700 ms inside speech). */
export const MAX_PAUSE_S = 0.42;

/**
 * Shorten long internal TTS pauses (sentence breaks) to MAX_PAUSE_S by cutting the middle
 * of each pause, so the breath on both sides stays natural. Detection uses a stricter
 * threshold (-38 dB) than QA (-42 dB) so near-silence is caught too.
 */
export async function capPauses(input: string, out: string) {
  const { stderr } = await run("ffmpeg", ["-hide_banner", "-nostats", "-i", input, "-af", `silencedetect=n=-38dB:d=${MAX_PAUSE_S}`, "-f", "null", "-"], { quiet: true });
  const total = (await probeMs(input)) / 1000;
  const cuts: Array<[number, number]> = [];
  for (const m of stderr.matchAll(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)) {
    const end = +m[1]!;
    const start = end - +m[2]!;
    if (start < 0.02 || end > total - 0.02) continue; // edges are handled by the trim
    cuts.push([start + MAX_PAUSE_S / 2, end - MAX_PAUSE_S / 2]);
  }
  if (!cuts.length) {
    fs.copyFileSync(input, out);
    return;
  }
  // keep segments between cuts
  const keep: Array<[number, number]> = [];
  let t = 0;
  for (const [a, b] of cuts) {
    keep.push([t, a]);
    t = b;
  }
  keep.push([t, total]);
  const parts = keep.map(([a, b], i) => `[0:a]atrim=${a.toFixed(4)}:${b.toFixed(4)},asetpts=PTS-STARTPTS,afade=t=in:d=0.008,afade=t=out:st=${Math.max(0, b - a - 0.008).toFixed(4)}:d=0.008[k${i}]`);
  const fc = `${parts.join(";")};${keep.map((_, i) => `[k${i}]`).join("")}concat=n=${keep.length}:v=0:a=1[o]`;
  await run("ffmpeg", ["-y", "-v", "error", "-i", input, "-filter_complex", fc, "-map", "[o]", "-c:a", "pcm_s16le", out], { quiet: true });
}

async function geminiScene(model: string, voice: string, style: string, text: string, out: string) {
  const { bytes, isWav } = await tts({ model, voice, text, style });
  const raw = out + (isWav ? ".src.wav" : ".src.pcm");
  fs.writeFileSync(raw, bytes);
  await toMaster(raw, out, !isWav);
  fs.rmSync(raw);
}

async function edgeScene(voice: string, text: string, out: string, rate: string) {
  const mp3 = out + ".src.mp3";
  await withRetry("edge-tts", () => run(EDGE, ["--voice", voice, "--rate", rate, "--text", text, "--write-media", mp3], { quiet: true }));
  await toMaster(mp3, out);
  fs.rmSync(mp3);
}

/** Voice stage: one file per scene so a bad take can be redone without touching the rest. */
export async function voice(job: JobDir, sb: Storyboard, opts: { force?: string } = {}): Promise<VoiceScene[]> {
  const brand = loadBrand(sb.channel);
  const chain = opts.force ? [opts.force] : TTS_CHAIN;
  const rate = sb.format === "shorts_9x16" ? "+6%" : "+0%";
  // One provider for the whole video so the voice never changes mid-video.
  let out: VoiceScene[] = [];
  let lastErr: unknown;
  for (const p of chain) {
    out = [];
    try {
      if (p !== "edge" && !process.env.GEMINI_API_KEY) throw new GeminiError("no GEMINI_API_KEY");
      for (const s of sb.scenes) {
        const file = job.p("voice", `${s.id}.wav`);
        const text = ttsText(s.voiceText, brand.pronunciation);
        fs.writeFileSync(job.p("voice", `${s.id}.txt`), text);
        if (p === "edge") await edgeScene(brand.theme.voice.edge, text, file, rate);
        else await withRetry(`tts ${p}`, () => geminiScene(p, brand.theme.voice.gemini, brand.theme.voice.stylePrompt, text, file), 2);
        out.push({ id: s.id, file, durationMs: await probeMs(file), provider: p });
        log(`[voice] ${s.id} ${p} ${out[out.length - 1]!.durationMs}ms`);
      }
      break;
    } catch (e) {
      lastErr = e;
      log(`[voice] provider ${p} failed, falling back: ${(e as Error).message.slice(0, 160)}`);
      out = [];
    }
  }
  if (!out.length) throw lastErr ?? new Error("voice failed");
  fs.writeFileSync(job.p("voice", "voice.json"), JSON.stringify(out, null, 2));
  return out;
}
