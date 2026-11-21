import fs from "node:fs";
import path from "node:path";
import type { RenderPlan } from "../core/schemas";
import { loadBrand, type LedgerTrack } from "../lib/brand";
import { JobDir, PY, ROOT, log, run } from "../lib/util";
import type { Placement } from "./plan";
import type { VoiceScene } from "./voice";

export const LOUDNESS = { voice: -16, music: -28, final: -14, tp: -1.5 };

interface LoudStats {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
}

/** Two-pass EBU R128 loudnorm (linear mode) – accurate to ±0.5 LU. */
export async function loudnorm(input: string, out: string, I: number, TP: number, extraPre = "") {
  const f1 = `${extraPre}${extraPre ? "," : ""}loudnorm=I=${I}:TP=${TP}:LRA=11:print_format=json`;
  const { stderr } = await run("ffmpeg", ["-hide_banner", "-nostats", "-i", input, "-af", f1, "-f", "null", "-"], { quiet: true });
  const js = stderr.slice(stderr.lastIndexOf("{"), stderr.lastIndexOf("}") + 1);
  const s = JSON.parse(js) as LoudStats;
  const f2 =
    `${extraPre}${extraPre ? "," : ""}loudnorm=I=${I}:TP=${TP}:LRA=11:linear=true:` +
    `measured_I=${s.input_i}:measured_TP=${s.input_tp}:measured_LRA=${s.input_lra}:measured_thresh=${s.input_thresh}:offset=${s.target_offset}`;
  await run("ffmpeg", ["-y", "-v", "error", "-i", input, "-af", `${f2},aresample=48000:resampler=soxr`, "-ac", "2", "-c:a", "pcm_s24le", out], { quiet: true });
}

export async function measure(file: string): Promise<{ I: number; TP: number; LRA: number }> {
  const { stderr } = await run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"], { quiet: true });
  const sum = stderr.slice(stderr.lastIndexOf("Summary:"));
  const num = (re: RegExp) => parseFloat(sum.match(re)?.[1] ?? "NaN");
  return { I: num(/I:\s+(-?[\d.]+) LUFS/), TP: num(/Peak:\s+(-?[\d.]+) dBFS/), LRA: num(/LRA:\s+(-?[\d.]+) LU/) };
}

/** Pick a ledger track for the brand mood (never anything outside the ledger). */
export function pickTrack(channel: RenderPlan["storyboard"]["channel"], jobId: string): LedgerTrack {
  const brand = loadBrand(channel);
  const tracks = brand.ledger.tracks;
  if (!tracks.length) throw new Error(`music ledger for ${channel} is empty`);
  let h = 0;
  for (const c of jobId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return tracks[h % tracks.length]!;
}

async function trackFile(job: JobDir, t: LedgerTrack, seconds: number): Promise<string> {
  if (t.file) return path.isAbsolute(t.file) ? t.file : path.join(ROOT, t.file);
  const out = job.p("audio", `music-${t.id}.wav`);
  const args = [path.join(ROOT, "pipeline", "py", "music.py"), "--mood", t.mood, "--seconds", String(Math.ceil(seconds)), "--seed", String(t.seed ?? 7), "--out", out];
  if (t.bpm) args.push("--bpm", String(t.bpm));
  await run(PY, args, { quiet: true });
  return out;
}

async function sfxFile(job: JobDir, kind: string) {
  const out = job.p("audio", `sfx-${kind}.wav`);
  if (!fs.existsSync(out)) await run(PY, [path.join(ROOT, "pipeline", "py", "music.py"), "--sfx", kind, "--out", out], { quiet: true });
  return out;
}

export interface MixResult {
  final: string; // 48 kHz stereo wav, −14 LUFS, TP ≤ −1.5
  voice: string; // voice stem on the absolute timeline (for QA re-alignment)
  music: string; // music stem (for audio-reactive visuals)
  track: LedgerTrack;
  stats: { voice: Awaited<ReturnType<typeof measure>>; final: Awaited<ReturnType<typeof measure>> };
}

/**
 * Mix stage:
 *  voice stem  = scene takes placed at their absolute starts, loudnorm −16 LUFS
 *  music stem  = ledger track, loudnorm −28 LUFS, sidechain-ducked under the voice
 *  sfx         = whooshes on transitions, riser→impact on the intro, chime at the outro
 *  final       = sum, loudnorm −14 LUFS / TP −1.5 dBTP
 */
export async function mix(job: JobDir, plan: RenderPlan, voice: VoiceScene[], placements: Placement[], opts: { sfx?: boolean } = {}): Promise<MixResult> {
  const fps = plan.fps;
  const totalS = plan.durationInFrames / fps;
  const tot = totalS.toFixed(3);

  // 1) voice stem
  const vin: string[] = [];
  const vf: string[] = [];
  placements.forEach((p, i) => {
    vin.push("-i", voice.find((v) => v.id === p.id)!.file);
    vf.push(`[${i}:a]adelay=${Math.round(p.voiceStartMs)}:all=1[v${i}]`);
  });
  const voiceRaw = job.p("audio", "voice-raw.wav");
  await run("ffmpeg", ["-y", "-v", "error", ...vin, "-filter_complex", `${vf.join(";")};${placements.map((_, i) => `[v${i}]`).join("")}amix=inputs=${placements.length}:normalize=0:dropout_transition=0,apad=whole_dur=${tot},atrim=0:${tot}[out]`, "-map", "[out]", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s24le", voiceRaw], { quiet: true });
  const voiceStem = job.p("audio", "voice.wav");
  // gentle presence EQ + de-ess-ish high shelf cut, then loudnorm
  await loudnorm(voiceRaw, voiceStem, LOUDNESS.voice, -2, "highpass=f=70,equalizer=f=3200:t=q:w=1.2:g=1.5,equalizer=f=7500:t=q:w=2:g=-1.5");

  // 2) music stem
  const track = pickTrack(plan.storyboard.channel, plan.jobId);
  const musicRaw = await trackFile(job, track, totalS + 1);
  const musicN = job.p("audio", "music-norm.wav");
  await loudnorm(musicRaw, musicN, LOUDNESS.music, -6, `atrim=0:${tot},afade=t=out:st=${Math.max(0, totalS - 3).toFixed(2)}:d=3`);
  // the bed is louder during intro/outro (no voice) – +6 dB swell there via volume envelope
  const introS = plan.introFrames / fps;
  const outroS = (plan.durationInFrames - plan.outroFrames) / fps;
  const swell = `volume='if(lt(t,${introS.toFixed(2)}),2.0,if(gt(t,${outroS.toFixed(2)}),1.8,1))':eval=frame`;

  // 3) sfx
  const sfxIn: string[] = [];
  const sfxF: string[] = [];
  const labels: string[] = [];
  if (opts.sfx !== false) {
    const events: { kind: string; atMs: number; gain: number }[] = [];
    events.push({ kind: "riser", atMs: Math.max(0, introS * 1000 - 2400), gain: 0.18 });
    events.push({ kind: "impact", atMs: introS * 1000 - 300, gain: 0.22 });
    plan.scenes.slice(1).forEach((s) => {
      if (s.scene.transitionIn !== "hardCut") events.push({ kind: "whoosh", atMs: (s.fromFrame * 1000) / fps - 250, gain: 0.12 });
    });
    events.push({ kind: "chime", atMs: outroS * 1000, gain: 0.16 });
    for (const [i, e] of events.entries()) {
      sfxIn.push("-i", await sfxFile(job, e.kind));
      const idx = 2 + i;
      sfxF.push(`[${idx}:a]volume=${e.gain},adelay=${Math.max(0, Math.round(e.atMs))}:all=1[x${i}]`);
      labels.push(`[x${i}]`);
    }
  }

  // 4) duck music under voice, sum, final loudness
  const sum = job.p("audio", "sum.wav");
  const fc = [
    `[0:a]asplit=2[vk][vm]`,
    `[1:a]${swell}[mu]`,
    `[mu][vk]sidechaincompress=threshold=0.03:ratio=6:attack=25:release=350:makeup=1:knee=4[duck]`,
    ...sfxF,
    `[vm][duck]${labels.join("")}amix=inputs=${2 + labels.length}:normalize=0:dropout_transition=0,atrim=0:${tot}[out]`,
  ].join(";");
  await run("ffmpeg", ["-y", "-v", "error", "-i", voiceStem, "-i", musicN, ...sfxIn, "-filter_complex", fc, "-map", "[out]", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s24le", sum], { quiet: true });
  const final = job.p("audio", "final.wav");
  await loudnorm(sum, final, LOUDNESS.final, LOUDNESS.tp);
  // safety limiter pass if TP still above target (linear loudnorm can fall back to dynamic)
  let st = await measure(final);
  if (st.TP > LOUDNESS.tp + 0.2) {
    const lim = job.p("audio", "final-lim.wav");
    await run("ffmpeg", ["-y", "-v", "error", "-i", final, "-af", "alimiter=limit=0.79:attack=3:release=60:level=false", "-c:a", "pcm_s24le", lim], { quiet: true });
    fs.renameSync(lim, final);
    st = await measure(final);
  }
  const stats = { voice: await measure(voiceStem), final: st };
  log(`[mix] voice ${stats.voice.I} LUFS, final ${st.I} LUFS TP ${st.TP} track=${track.id}`);
  return { final, voice: voiceStem, music: musicN, track, stats };
}
