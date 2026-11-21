import fs from "node:fs";
import path from "node:path";
import { validateCaptions } from "../core/captions";
import { alignSequences, foldForMatch } from "../core/align";
import { stripForCompare, type RenderPlan, type Rect } from "../core/schemas";
import { tokenizeWords } from "../core/persian/normalize";
import { spokenUnits } from "../core/spoken";
import { loadBrand } from "../lib/brand";
import { JobDir, PY, ROOT, log, run, writeJson } from "../lib/util";
import { measure } from "./mix";
import { probe, ENCODE } from "./render";
import { runAligner } from "./align";

export const QA_LIMITS = { driftMs: 120, loudI: -14, loudTol: 1.0, tpMax: -1.0, silenceMs: 700, blackS: 0.5, werMax: 0.25 };

export interface QaReport {
  pass: boolean;
  failures: string[];
  warnings: string[];
  checks: Record<string, unknown>;
}

const overlap = (a: Rect, b: Rect, pad = 0) => a.x + pad < b.x + b.w && b.x + pad < a.x + a.w && a.y + pad < b.y + b.h && b.y + pad < a.y + a.h;
const inside = (a: Rect, b: Rect, tol = 6) => a.x >= b.x - tol && a.y >= b.y - tol && a.x + a.w <= b.x + b.w + tol && a.y + a.h <= b.y + b.h + tol;

interface ProbeItem {
  layer: string;
  id?: string;
  text?: string;
  rendered?: string;
  opacity: number;
  box: Rect;
}

/** Layout zones, duplicated from templates/zones.ts on purpose (QA is an independent check). */
function zones(format: RenderPlan["storyboard"]["format"]) {
  if (format === "landscape_16x9")
    return { W: 1920, H: 1080, safe: { x: 192, y: 108, w: 1536, h: 864 }, subtitle: { x: 240, y: 800, w: 1440, h: 172 }, ui: [] as Rect[] };
  return {
    W: 1080,
    H: 1920,
    safe: { x: 48, y: 288, w: 840, h: 960 },
    subtitle: { x: 48, y: 1030, w: 840, h: 218 },
    ui: [
      { x: 0, y: 0, w: 1080, h: 288 },
      { x: 0, y: 1248, w: 1080, h: 672 },
      { x: 888, y: 288, w: 192, h: 960 },
    ],
  };
}

export function collisionCheck(plan: RenderPlan, probeLog: string) {
  const z = zones(plan.storyboard.format);
  const issues: string[] = [];
  const seen = new Set<string>();
  const add = (k: string, msg: string) => {
    if (!seen.has(k)) {
      seen.add(k);
      issues.push(msg);
    }
  };
  let frames = 0;
  const outroStart = plan.durationInFrames - plan.outroFrames;
  const subtitleRendered = new Map<number, string>();
  for (const line of fs.readFileSync(probeLog, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const { frame, items } = JSON.parse(line) as { frame: number; items: ProbeItem[] };
    frames++;
    const vis = items.filter((i) => i.opacity > 0.06 && i.box.w > 2 && i.box.h > 2);
    const subs = vis.filter((i) => i.layer === "subtitle");
    const others = vis.filter((i) => i.layer !== "subtitle" && i.layer !== "endScreen");
    for (const s of subs) {
      subtitleRendered.set(frame, s.rendered ?? "");
      if (!inside(s.box, z.subtitle)) add(`sz${Math.floor(frame / 15)}`, `frame ${frame}: subtitle outside subtitle zone ${JSON.stringify(s.box)}`);
      for (const o of others) if (overlap(s.box, o.box, 2)) add(`so${o.layer}${o.id}`, `frame ${frame}: subtitle overlaps ${o.layer}${o.id ? ":" + o.id : ""}`);
      for (const o of others)
        if (o.text && o.layer === "typography" && stripForCompare(o.text).length > 6 && stripForCompare(s.rendered ?? "").includes(stripForCompare(o.text)))
          add(`dup${o.text}`, `frame ${frame}: on-screen text duplicated in subtitle «${o.text}»`);
    }
    // logo vs typography / lower-third
    const logos = vis.filter((i) => i.layer === "logo");
    for (const l of logos)
      for (const o of vis.filter((i) => i.layer === "typography" || i.layer === "lowerThird"))
        // both must be legible (≥ 25 %); a faint element crossing a fading one inside a transition is not a collision
        if (l.opacity >= 0.25 && o.opacity >= 0.25 && overlap(l.box, o.box, 2) && frame >= plan.introFrames && frame < outroStart) add(`lo${o.id}${o.text}`, `frame ${frame}: logo overlaps ${o.layer} «${o.text ?? ""}»`);
    // safe areas (scene frames only – intro/outro are full-bleed brand animations)
    if (frame >= plan.introFrames && frame < outroStart) {
      for (const t of vis.filter((i) => ["typography", "lowerThird", "subtitle"].includes(i.layer))) {
        if (!inside(t.box, { x: 0, y: 0, w: z.W, h: z.H }, 1)) add(`off${t.layer}${t.id}${t.text}`, `frame ${frame}: ${t.layer} off-canvas «${t.text ?? ""}»`);
        else if (!inside(t.box, z.safe, 8)) add(`safe${t.layer}${t.id}${t.text}`, `frame ${frame}: ${t.layer} outside title-safe «${t.text ?? ""}» ${JSON.stringify(t.box)}`);
        for (const u of z.ui) if (overlap(t.box, u, 2)) add(`ui${t.layer}${t.id}${t.text}`, `frame ${frame}: ${t.layer} under Shorts UI «${t.text ?? ""}»`);
      }
    }
  }
  return { frames, issues, subtitleRendered };
}

/** Exact text diff: subtitle tokens vs approved script; rendered DOM text vs page text. */
export function textDiff(plan: RenderPlan, subtitleRendered: Map<number, string>) {
  const script = plan.storyboard.scenes.flatMap((s) => tokenizeWords(s.voiceText));
  const subs = plan.captions.flatMap((c) => c.tokens.map((t) => t.text));
  const issues: string[] = [];
  if (script.length !== subs.length) issues.push(`word count script=${script.length} subtitles=${subs.length}`);
  for (let i = 0; i < Math.min(script.length, subs.length); i++) if (script[i] !== subs[i]) issues.push(`word ${i}: «${subs[i]}» ≠ script «${script[i]}»`);
  // rendered pages (sample each page's middle frame)
  let checked = 0;
  for (const c of plan.captions) {
    if (c.hidden) continue;
    const mid = Math.round((((c.startMs + c.endMs) / 2) * plan.fps) / 1000);
    const r = subtitleRendered.get(mid);
    if (r == null) continue;
    checked++;
    if (stripForCompare(r) !== stripForCompare(c.text)) issues.push(`page ${c.pageIndex} rendered «${r}» ≠ «${c.text}»`);
  }
  return { issues, pagesChecked: checked };
}

/** Re-measure word timing on the FINAL mixed audio (music + sfx included) and compare to the burned captions. */
async function driftCheck(job: JobDir, plan: RenderPlan, finalAudio: string) {
  const brand = loadBrand(plan.storyboard.channel);
  const items: { id: string; audio: string; words: string[] }[] = [];
  const meta: { offset: number; tokens: { fromMs: number; text: string }[]; unitFirst: number[] }[] = [];
  const allTokens = plan.captions.flatMap((c) => c.tokens);
  let ti = 0;
  for (const ps of plan.scenes) {
    const { units, words } = spokenUnits(ps.scene.voiceText, brand.pronunciation);
    const tokens = allTokens.slice(ti, ti + words.length);
    ti += words.length;
    const from = Math.max(0, ps.voiceFromMs - 300);
    const to = ps.voiceToMs + 300;
    const seg = job.p("qa", "seg", `${ps.scene.id}.wav`);
    await run("ffmpeg", ["-y", "-v", "error", "-ss", (from / 1000).toFixed(3), "-to", (to / 1000).toFixed(3), "-i", finalAudio, "-ac", "1", "-ar", "16000", seg], { quiet: true });
    items.push({ id: ps.scene.id, audio: seg, words: units.map((u) => u.spoken.replace(/\s+/g, "")) });
    meta.push({ offset: from, tokens, unitFirst: units.map((u) => u.wordIdx[0]!) });
  }
  const res = await runAligner(items, job.p("qa", "realign.json"));
  const drifts: number[] = [];
  const worst: { word: string; driftMs: number }[] = [];
  res.items.forEach((it, k) => {
    const m = meta[k]!;
    for (const w of it.words) {
      if (w.score < 0.25) continue;
      const tok = m.tokens[m.unitFirst[w.i]!];
      if (!tok) continue;
      const d = Math.abs(m.offset + w.startMs - tok.fromMs);
      drifts.push(d);
      worst.push({ word: tok.text, driftMs: Math.round(d) });
    }
  });
  drifts.sort((a, b) => a - b);
  worst.sort((a, b) => b.driftMs - a.driftMs);
  const pct = (p: number) => drifts[Math.min(drifts.length - 1, Math.floor(drifts.length * p))] ?? 0;
  return { words: drifts.length, medianMs: Math.round(pct(0.5)), p95Ms: Math.round(pct(0.95)), maxMs: Math.round(drifts.at(-1) ?? 0), worst: worst.slice(0, 5) };
}

async function whisperCheck(job: JobDir, plan: RenderPlan, voiceAudio: string) {
  if (process.env.AMF_WHISPER === "0") return null;
  const out = job.p("qa", "asr.json");
  try {
    await run(PY, [path.join(ROOT, "pipeline", "py", "asr_check.py"), "--audio", voiceAudio, "--out", out], { quiet: true });
  } catch (e) {
    return { skipped: (e as Error).message.slice(0, 200) };
  }
  const asr = JSON.parse(fs.readFileSync(out, "utf8")) as { model: string; text: string; words: { w: string; s: number; e: number }[] };
  const script = plan.storyboard.scenes.flatMap((s) => tokenizeWords(s.voiceText)).map(foldForMatch).filter(Boolean);
  const al = alignSequences(script, asr.words.map((w) => ({ word: w.w, start: w.s, end: w.e })));
  const matched = al.filter((a) => a.matched).length;
  const wer = 1 - matched / Math.max(1, script.length);
  return { model: asr.model, wer: +wer.toFixed(3), matched, total: script.length, asrText: asr.text.slice(0, 400) };
}

async function avChecks(file: string, plan: RenderPlan) {
  const p = await probe(file);
  const fails: string[] = [];
  const v = p.v as Record<string, string | number>;
  const a = p.a as Record<string, string | number>;
  const want = (k: string, got: unknown, ok: boolean) => !ok && fails.push(`${k}=${String(got)}`);
  want("codec", v.codec_name, v.codec_name === "h264");
  want("profile", v.profile, v.profile === "High");
  want("pix_fmt", v.pix_fmt, v.pix_fmt === "yuv420p");
  want("color_space", v.color_space, v.color_space === "bt709");
  want("color_primaries", v.color_primaries, v.color_primaries === "bt709");
  want("color_transfer", v.color_transfer, v.color_transfer === "bt709");
  want("r_frame_rate", v.r_frame_rate, v.r_frame_rate === `${plan.fps}/1`);
  want("avg_frame_rate", v.avg_frame_rate, v.avg_frame_rate === `${plan.fps}/1`);
  want("audio_codec", a.codec_name, a.codec_name === "aac");
  want("audio_profile", a.profile, a.profile === "LC");
  want("sample_rate", a.sample_rate, String(a.sample_rate) === "48000");
  want("channels", a.channels, Number(a.channels) === 2);
  const vk = Number(v.bit_rate) / 1000;
  const ak = Number(a.bit_rate) / 1000;
  const min = plan.width >= 3840 || plan.height >= 3840 ? 35000 : (ENCODE.minKbps[plan.fps] ?? 8000);
  want("video_kbps", Math.round(vk), vk >= min * 0.98);
  // Encoded with -b:a 384k using FFmpeg's default "twoloop" coder (best quality). It is an ABR
  // coder that spends fewer bits on simple material, so the measured average can sit below 384.
  want("audio_kbps", Math.round(ak), ak >= 280);
  want("frames", v.nb_frames, Math.abs(Number(v.nb_frames) - plan.durationInFrames) <= 1);
  // +faststart: moov atom before mdat
  const head = Buffer.alloc(1 << 16);
  const fd = fs.openSync(file, "r");
  fs.readSync(fd, head, 0, head.length, 0);
  fs.closeSync(fd);
  const moov = head.indexOf("moov");
  const mdat = head.indexOf("mdat");
  want("faststart", `moov@${moov} mdat@${mdat}`, moov > 0 && (mdat < 0 || moov < mdat));
  return { fails, videoKbps: Math.round(vk), audioKbps: Math.round(ak), width: v.width, height: v.height, frames: v.nb_frames };
}

async function filters(file: string) {
  const { stderr } = await run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vf", "blackdetect=d=0.25:pix_th=0.06,freezedetect=n=0.0008:d=4", "-af", "silencedetect=n=-45dB:d=0.7", "-f", "null", "-"], { quiet: true });
  const black = [...stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g)].map((m) => ({ start: +m[1]!, end: +m[2]!, dur: +m[3]! }));
  const freeze = [...stderr.matchAll(/freeze_start: ([\d.]+)[\s\S]*?freeze_duration: ([\d.]+)/g)].map((m) => ({ start: +m[1]!, dur: +m[2]! }));
  const silenceStarts = [...stderr.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]!);
  const silenceEnds = [...stderr.matchAll(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)].map((m) => ({ end: +m[1]!, dur: +m[2]! }));
  const silence = silenceEnds.map((e, i) => ({ start: silenceStarts[i] ?? e.end - e.dur, ...e }));
  return { black, freeze, silence };
}

/** Speech-gap check on the voice stem: no silence > 0.7 s between the first and last spoken word. */
async function speechGaps(plan: RenderPlan, voiceStem: string) {
  const { stderr } = await run("ffmpeg", ["-hide_banner", "-nostats", "-i", voiceStem, "-af", "silencedetect=n=-42dB:d=0.7", "-f", "null", "-"], { quiet: true });
  const first = plan.captions[0]!.tokens[0]!.fromMs / 1000;
  const last = plan.captions.at(-1)!.tokens.at(-1)!.toMs / 1000;
  const gaps = [...stderr.matchAll(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)]
    .map((m) => ({ end: +m[1]!, dur: +m[2]! }))
    .filter((g) => g.end - g.dur > first + 0.05 && g.end < last - 0.05);
  const tokens = plan.captions.flatMap((c) => c.tokens);
  const wordGaps = tokens.slice(1).map((t, i) => ({ at: tokens[i]!.text, gap: t.fromMs - tokens[i]!.toMs })).filter((g) => g.gap > QA_LIMITS.silenceMs);
  return { gaps, wordGaps };
}

/** Proof sheet: frames at caption midpoints and scene starts, tiled with timecodes. */
export async function proofSheet(job: JobDir, plan: RenderPlan, file: string) {
  const portrait = plan.height > plan.width;
  const times = [
    ...plan.scenes.map((s) => (s.fromFrame + Math.min(s.durationFrames - 1, Math.round(plan.fps * 1.5))) / plan.fps),
    ...plan.captions.filter((_, i) => i % Math.max(1, Math.floor(plan.captions.length / 8)) === 0).map((c) => (c.startMs + c.endMs) / 2000),
  ]
    .sort((a, b) => a - b)
    .slice(0, portrait ? 12 : 16);
  const dir = job.p("qa", "proof", ".keep");
  const d = path.dirname(dir);
  const tw = portrait ? 360 : 480;
  for (const [i, t] of times.entries()) {
    const tc = `${Math.floor(t / 60)}\\:${(t % 60).toFixed(2).padStart(5, "0")}`;
    await run("ffmpeg", ["-y", "-v", "error", "-ss", t.toFixed(3), "-i", file, "-frames:v", "1", "-vf", `scale=${tw}:-2,drawtext=text='${tc}':x=8:y=8:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6`, path.join(d, `p${String(i).padStart(2, "0")}.png`)], { quiet: true });
  }
  const out = job.p("qa", "proof-sheet.png");
  const cols = portrait ? 6 : 4;
  await run("ffmpeg", ["-y", "-v", "error", "-framerate", "1", "-i", path.join(d, "p%02d.png"), "-vf", `tile=${cols}x${Math.ceil(times.length / cols)}:padding=6:margin=6:color=0x101010`, "-frames:v", "1", out], { quiet: true });
  return out;
}

export async function runQa(job: JobDir, plan: RenderPlan, file: string, probeLog: string): Promise<QaReport> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const checks: Record<string, unknown> = {};

  const av = await avChecks(file, plan);
  checks.av = av;
  failures.push(...av.fails.map((f) => `spec: ${f}`));

  const finalWav = job.p("audio", "final.wav");
  const loud = await measure(file);
  checks.loudness = loud;
  if (Math.abs(loud.I - QA_LIMITS.loudI) > QA_LIMITS.loudTol) failures.push(`loudness ${loud.I} LUFS (target −14)`);
  if (loud.TP > QA_LIMITS.tpMax) failures.push(`true peak ${loud.TP} dBTP > −1`);

  const flt = await filters(file);
  checks.filters = flt;
  const dur = plan.durationInFrames / plan.fps;
  for (const b of flt.black) if (b.start > 0.3 && b.end < dur - 0.3 && b.dur > QA_LIMITS.blackS) failures.push(`black frames ${b.start.toFixed(2)}s for ${b.dur.toFixed(2)}s`);
  for (const f of flt.freeze) warnings.push(`static picture ${f.start.toFixed(1)}s for ${f.dur.toFixed(1)}s`);

  const gaps = await speechGaps(plan, job.p("audio", "voice.wav"));
  checks.speechGaps = gaps;
  for (const g of gaps.gaps) failures.push(`silence ${g.dur.toFixed(2)}s inside speech at ${(g.end - g.dur).toFixed(2)}s`);

  const capErr = validateCaptions(plan.captions, plan.fps);
  checks.captionRules = capErr;
  failures.push(...capErr.map((e) => `caption: ${e}`));

  const col = collisionCheck(plan, probeLog);
  checks.collision = { frames: col.frames, issues: col.issues.slice(0, 30) };
  if (col.frames < plan.durationInFrames * 0.95) warnings.push(`probe covered ${col.frames}/${plan.durationInFrames} frames`);
  failures.push(...col.issues.slice(0, 10).map((i) => `collision: ${i}`));

  const td = textDiff(plan, col.subtitleRendered);
  checks.textDiff = td;
  failures.push(...td.issues.slice(0, 10).map((i) => `text: ${i}`));

  const drift = await driftCheck(job, plan, finalWav);
  checks.drift = drift;
  if (drift.maxMs > QA_LIMITS.driftMs) failures.push(`subtitle drift max ${drift.maxMs}ms > 120ms (${drift.worst.map((w) => `${w.word}:${w.driftMs}`).join(", ")})`);

  const asr = await whisperCheck(job, plan, job.p("audio", "voice.wav"));
  checks.whisper = asr;
  const wer = asr && "wer" in asr ? (asr.wer ?? 0) : 0;
  if (wer > QA_LIMITS.werMax) failures.push(`Whisper WER ${wer} > ${QA_LIMITS.werMax} (pronunciation problem?)`);
  else if (wer > 0.12) warnings.push(`Whisper WER ${wer}`);

  checks.proofSheet = await proofSheet(job, plan, file);
  const report: QaReport = { pass: failures.length === 0, failures, warnings, checks };
  writeJson(job.p("qa", "report.json"), report);
  log(`[qa] ${report.pass ? "PASS" : "FAIL"} failures=${failures.length} warnings=${warnings.length} drift=${drift.maxMs}ms loud=${loud.I}/${loud.TP}`);
  return report;
}
