// Render a RenderPlan to a high-quality intermediate (or stills) with Remotion.
// Usage:
//   node --experimental-strip-types scripts/render.mjs --plan plan.json --public dir --out out.mov
//        [--preview] [--scale 2] [--probe probe.jsonl] [--stills dir --frames 10,200,...] [--concurrency N]
// The final H.264/AAC encode is done by the pipeline with ffmpeg (x264 slow, bt709, +faststart).
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { webpackOverride } from "../src/webpack-override.ts";

const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i < 0 ? d : argv[i + 1];
};
const flag = (k) => argv.includes(`--${k}`);

const plan = JSON.parse(fs.readFileSync(opt("plan"), "utf8"));
const jobPublic = path.resolve(opt("public"));
const preview = flag("preview");
const scale = Number(opt("scale", "1"));
const probeFile = opt("probe");
const stillsDir = opt("stills");
const concurrency = Number(opt("concurrency", String(Math.max(1, os.cpus().length))));

// Public dir for this render: engine fonts + the job's assets.
const pub = fs.mkdtempSync(path.join(os.tmpdir(), "amf-pub-"));
fs.cpSync(path.resolve("public/fonts"), path.join(pub, "fonts"), { recursive: true });
if (fs.existsSync(jobPublic)) fs.cpSync(jobPublic, pub, { recursive: true });

const t0 = Date.now();
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), webpackOverride, publicDir: pub });
const inputProps = { plan };
const composition = await selectComposition({ serveUrl, id: "Video", inputProps });
console.log(`[render] ${composition.width}x${composition.height}@${composition.fps} ${composition.durationInFrames}f scale=${scale}`);

const probe = probeFile ? fs.createWriteStream(probeFile) : null;
const onBrowserLog = (l) => {
  if (l.text.startsWith("AMF_PROBE ")) probe?.write(l.text.slice(10) + "\n");
  else if (l.type === "error" || l.text.startsWith("AMF_WARN")) console.error("[browser]", l.text.slice(0, 300));
};

if (stillsDir) {
  fs.mkdirSync(stillsDir, { recursive: true });
  const frames = opt("frames", "0").split(",").map((f) => (f.endsWith("%") ? Math.floor(((composition.durationInFrames - 1) * Number(f.slice(0, -1))) / 100) : Number(f)));
  for (const frame of frames) {
    const output = path.join(stillsDir, `f${String(frame).padStart(5, "0")}.png`);
    await renderStill({ composition, serveUrl, output, frame, inputProps, imageFormat: "png", scale, chromiumOptions: { gl: "angle" }, onBrowserLog });
  }
  console.log(`[render] ${frames.length} stills in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
} else {
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    inputProps,
    outputLocation: path.resolve(opt("out")),
    codec: preview ? "h264" : "prores",
    proResProfile: preview ? undefined : "hq",
    crf: preview ? 20 : undefined,
    x264Preset: preview ? "veryfast" : undefined,
    imageFormat: preview ? "jpeg" : "png",
    jpegQuality: preview ? 90 : undefined,
    pixelFormat: preview ? "yuv420p" : "yuv422p10le",
    colorSpace: "bt709",
    muted: true,
    scale: preview ? 720 / Math.min(composition.width, composition.height) : scale,
    concurrency,
    chromiumOptions: { gl: "angle" },
    onBrowserLog,
    onProgress: ({ progress, renderedFrames }) => {
      const p = Math.floor(progress * 20);
      if (p !== last) {
        last = p;
        console.log(`[render] ${(progress * 100).toFixed(0)}% (${renderedFrames} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
      }
    },
  });
  console.log(`[render] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
probe?.end();
fs.rmSync(pub, { recursive: true, force: true });
// The webpack bundle is a temp dir (~90 MB) — remove it so repeated runs do not fill the disk.
if (serveUrl.startsWith(os.tmpdir())) fs.rmSync(serveUrl, { recursive: true, force: true });
