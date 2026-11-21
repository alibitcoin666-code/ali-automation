import fs from "node:fs";
import path from "node:path";
import type { Storyboard } from "../core/schemas";
import { spokenUnits } from "../core/spoken";
import { loadBrand } from "../lib/brand";
import { JobDir, PY, ROOT, log, run } from "../lib/util";
import type { VoiceScene } from "./voice";

export interface LocalWord {
  text: string; // exact script word
  startMs: number; // relative to the scene's voice file
  endMs: number;
  score: number;
  interpolated: boolean;
}
export interface AlignedScene {
  id: string;
  durationMs: number;
  words: LocalWord[];
  meanScore: number;
}

interface PyOut {
  items: { id: string; durationMs: number; words: { i: number; startMs: number; endMs: number; score: number }[] }[];
}

export async function runAligner(items: { id: string; audio: string; words: string[] }[], workFile: string): Promise<PyOut> {
  fs.writeFileSync(workFile, JSON.stringify({ items }));
  const out = workFile.replace(/\.json$/, ".out.json");
  await run(PY, [path.join(ROOT, "pipeline", "py", "align.py"), "--in", workFile, "--out", out], {
    quiet: true,
    env: { ...process.env, HF_HUB_OFFLINE: process.env.HF_HUB_OFFLINE ?? "1", TOKENIZERS_PARALLELISM: "false" },
  });
  return JSON.parse(fs.readFileSync(out, "utf8")) as PyOut;
}

/**
 * Align stage: CTC forced alignment of the exact script (spoken form) to each scene's
 * voice file. Units missing from the aligner are linearly interpolated; multi-word
 * units are split by character length. Word ends are extended slightly so the
 * highlight never flickers off between words.
 */
export async function align(job: JobDir, sb: Storyboard, voice: VoiceScene[]): Promise<AlignedScene[]> {
  const brand = loadBrand(sb.channel);
  const per = sb.scenes.map((s) => ({ s, ...spokenUnits(s.voiceText, brand.pronunciation) }));
  const items = per.map(({ s, units }) => ({ id: s.id, audio: voice.find((v) => v.id === s.id)!.file, words: units.map((u) => u.spoken.replace(/\s+/g, "")) }));
  const res = await runAligner(items, job.p("align", "in.json"));
  const out: AlignedScene[] = [];
  for (const { s, words, units } of per) {
    const r = res.items.find((x) => x.id === s.id)!;
    const dur = r.durationMs;
    // unit-level timing (null when missing)
    const ut: ({ a: number; b: number; score: number } | null)[] = units.map(() => null);
    for (const w of r.words) ut[w.i] = { a: w.startMs, b: w.endMs, score: w.score };
    // interpolate gaps
    for (let i = 0; i < ut.length; i++) {
      if (ut[i]) continue;
      let j = i;
      while (j < ut.length && !ut[j]) j++;
      const a = i > 0 ? ut[i - 1]!.b + 20 : 0;
      const b = j < ut.length ? ut[j]!.a - 20 : dur;
      const n = j - i;
      for (let k = 0; k < n; k++) ut[i + k] = { a: a + ((b - a) * k) / n, b: a + ((b - a) * (k + 1)) / n, score: 0 };
      i = j - 1;
    }
    const lw: LocalWord[] = [];
    units.forEach((u, ui) => {
      const t = ut[ui]!;
      const lens = u.wordIdx.map((wi) => Math.max(1, words[wi]!.replace(/[^\p{L}\p{N}]/gu, "").length));
      const total = lens.reduce((x, y) => x + y, 0);
      let acc = 0;
      u.wordIdx.forEach((wi, k) => {
        const a = t.a + ((t.b - t.a) * acc) / total;
        acc += lens[k]!;
        const b = t.a + ((t.b - t.a) * acc) / total;
        lw.push({ text: words[wi]!, startMs: a, endMs: b, score: t.score, interpolated: t.score === 0 });
      });
    });
    // extend ends toward next start (max +80ms, keep 20ms gap); monotonic
    for (let i = 0; i < lw.length; i++) {
      const next = lw[i + 1]?.startMs ?? dur;
      lw[i]!.endMs = Math.max(lw[i]!.endMs, Math.min(next - 20, lw[i]!.endMs + 80));
      if (i > 0 && lw[i]!.startMs < lw[i - 1]!.endMs) lw[i]!.startMs = lw[i - 1]!.endMs;
      if (lw[i]!.endMs <= lw[i]!.startMs) lw[i]!.endMs = lw[i]!.startMs + 60;
    }
    const scored = lw.filter((w) => !w.interpolated);
    const meanScore = scored.length ? scored.reduce((x, w) => x + w.score, 0) / scored.length : 0;
    out.push({ id: s.id, durationMs: dur, words: lw, meanScore });
    log(`[align] ${s.id} words=${lw.length} interp=${lw.length - scored.length} score=${meanScore.toFixed(2)}`);
  }
  fs.writeFileSync(job.p("align", "aligned.json"), JSON.stringify(out, null, 2));
  return out;
}
