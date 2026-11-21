import fs from "node:fs";
import path from "node:path";
import type { RenderPlan } from "../core/schemas";
import { JobDir, ROOT, log, run, writeJson } from "../lib/util";

const ENGINE = path.join(ROOT, "engine");

export const ENCODE = {
  crf: 17,
  preset: "slow",
  minKbps: { 30: 8000, 60: 12000 } as Record<number, number>,
  twoPassKbps: { 30: 10000, 60: 15000 } as Record<number, number>,
  k4: 40000,
  audio: "384k",
};

async function engine(args: string[]) {
  await run(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/render.mjs", ...args], { cwd: ENGINE });
}

export async function probe(file: string): Promise<{ v: Record<string, string>; a: Record<string, string>; f: Record<string, string> }> {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { quiet: true });
  const j = JSON.parse(stdout) as { streams: Record<string, string>[]; format: Record<string, string> };
  return { v: j.streams.find((s) => s.codec_type === "video") ?? {}, a: j.streams.find((s) => s.codec_type === "audio") ?? {}, f: j.format };
}

const colorArgs = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"];

/** Final encode: H.264 High, yuv420p, bt709, CFR, +faststart, AAC-LC 48 kHz stereo 384k. */
async function encodeFinal(src: string, audio: string, out: string, fps: number, k4: boolean) {
  const gop = String(Math.round(fps / 2));
  const vf = `scale=in_range=tv:out_range=tv:in_color_matrix=bt709:out_color_matrix=bt709:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p`;
  const common = ["-r", String(fps), "-fps_mode", "cfr", "-vf", vf, "-c:v", "libx264", "-preset", ENCODE.preset, "-profile:v", "high", "-pix_fmt", "yuv420p", ...colorArgs, "-g", gop, "-bf", "2", "-flags", "+cgop", "-x264-params", "aq-mode=3:deblock=-1,-1"];
  const aArgs = ["-c:a", "aac", "-profile:a", "aac_low", "-b:a", ENCODE.audio, "-ar", "48000", "-ac", "2"];
  const twoPass = async (kbps: number) => {
    const plog = out + ".2pass";
    await run("ffmpeg", ["-y", "-v", "error", "-i", src, ...common, "-b:v", `${kbps}k`, "-pass", "1", "-passlogfile", plog, "-an", "-f", "mp4", "/dev/null"], { quiet: true });
    await run("ffmpeg", ["-y", "-v", "error", "-i", src, "-i", audio, "-map", "0:v:0", "-map", "1:a:0", ...common, "-b:v", `${kbps}k`, "-maxrate", `${Math.round(kbps * 1.5)}k`, "-bufsize", `${kbps * 2}k`, "-pass", "2", "-passlogfile", plog, ...aArgs, "-movflags", "+faststart", "-shortest", out], { quiet: true });
    for (const f of fs.readdirSync(path.dirname(out))) if (f.startsWith(path.basename(plog))) fs.rmSync(path.join(path.dirname(out), f));
  };
  if (k4) return twoPass(ENCODE.k4);
  await run("ffmpeg", ["-y", "-v", "error", "-i", src, "-i", audio, "-map", "0:v:0", "-map", "1:a:0", ...common, "-crf", String(ENCODE.crf), ...aArgs, "-movflags", "+faststart", "-shortest", out], { quiet: true });
  const p = await probe(out);
  const kbps = Number(p.v.bit_rate ?? 0) / 1000;
  const min = ENCODE.minKbps[fps] ?? 8000;
  if (kbps < min) {
    log(`[render] CRF ${ENCODE.crf} gave ${kbps.toFixed(0)} kbps < ${min}; 2-pass at ${ENCODE.twoPassKbps[fps]} kbps`);
    await twoPass(ENCODE.twoPassKbps[fps] ?? 10000);
  }
}

/** Stage the job's assets into a public folder the engine bundles. Plan paths are relative to it. */
export function stagePublic(job: JobDir, files: Record<string, string>): string {
  const pub = job.p("public", ".keep");
  const dir = path.dirname(pub);
  for (const [rel, abs] of Object.entries(files)) {
    const dst = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (path.resolve(abs) !== path.resolve(dst)) fs.copyFileSync(abs, dst);
  }
  return dir;
}

export interface RenderOut {
  file: string;
  probeLog?: string;
  seconds: number;
}

/** Preview: 720p H.264 with audio, small enough for Telegram (≤ 50 MB). */
export async function renderPreview(job: JobDir, plan: RenderPlan, pub: string, audio: string): Promise<RenderOut> {
  const t0 = Date.now();
  const planFile = job.p("render", "plan-preview.json");
  writeJson(planFile, { ...plan, preview: true, qaProbe: true });
  const silent = job.p("render", "preview-silent.mp4");
  const probeLog = job.p("qa", "probe.jsonl");
  await engine(["--plan", planFile, "--public", pub, "--out", silent, "--preview", "--probe", probeLog]);
  const out = job.p("out", "preview-720p.mp4");
  await run("ffmpeg", ["-y", "-v", "error", "-i", silent, "-i", audio, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart", "-shortest", out], { quiet: true });
  const mb = fs.statSync(out).size / 1e6;
  if (mb > 48) {
    const small = out.replace(".mp4", "-s.mp4");
    const secs = plan.durationInFrames / plan.fps;
    const kbps = Math.floor((44 * 8000) / secs) - 160;
    await run("ffmpeg", ["-y", "-v", "error", "-i", out, "-c:v", "libx264", "-b:v", `${kbps}k`, "-preset", "medium", "-c:a", "copy", "-movflags", "+faststart", small], { quiet: true });
    fs.renameSync(small, out);
  }
  return { file: out, probeLog, seconds: (Date.now() - t0) / 1000 };
}

export async function renderFinal(job: JobDir, plan: RenderPlan, pub: string, audio: string, opts: { k4?: boolean } = {}): Promise<RenderOut> {
  const t0 = Date.now();
  const planFile = job.p("render", "plan-final.json");
  writeJson(planFile, { ...plan, preview: false, qaProbe: true });
  const master = job.p("render", "master.mov");
  const probeLog = job.p("qa", "probe-final.jsonl");
  await engine(["--plan", planFile, "--public", pub, "--out", master, "--probe", probeLog, ...(opts.k4 ? ["--scale", "2"] : [])]);
  const out = job.p("out", "final.mp4");
  await encodeFinal(master, audio, out, plan.fps, !!opts.k4);
  if (process.env.AMF_KEEP_MASTER !== "1") fs.rmSync(master, { force: true });
  return { file: out, probeLog, seconds: (Date.now() - t0) / 1000 };
}

export async function renderStills(job: JobDir, plan: RenderPlan, pub: string, frames: (number | string)[], dir = job.p("stills", ".keep")): Promise<string[]> {
  const planFile = job.p("render", "plan-stills.json");
  writeJson(planFile, { ...plan, preview: false });
  const outDir = path.dirname(dir);
  await engine(["--plan", planFile, "--public", pub, "--stills", outDir, "--frames", frames.join(",")]);
  return fs.readdirSync(outDir).filter((f) => f.endsWith(".png")).sort().map((f) => path.join(outDir, f));
}
