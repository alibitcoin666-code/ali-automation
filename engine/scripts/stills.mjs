import os from "node:os";
// Usage: node scripts/stills.mjs out_dir comp:frame[,frame...] [comp:frame...] [--props file.json]
import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { webpackOverride } from "../src/webpack-override.ts";

const args = process.argv.slice(2);
const out = args.shift();
let props = {};
const pi = args.indexOf("--props");
if (pi >= 0) { props = JSON.parse(fs.readFileSync(args[pi + 1], "utf8")); args.splice(pi, 2); }
let publicDir = path.resolve("public");
const pu = args.indexOf("--public");
if (pu >= 0) {
  // fonts + extra assets (e.g. a job's images for thumbnails)
  const tmp = fs.mkdtempSync(path.join((await import("node:os")).tmpdir(), "amf-st-"));
  fs.cpSync(path.resolve("public/fonts"), path.join(tmp, "fonts"), { recursive: true });
  fs.cpSync(path.resolve(args[pu + 1]), tmp, { recursive: true });
  publicDir = tmp;
  args.splice(pu, 2);
}
const nameIdx = args.indexOf("--name");
let fixedName = null;
if (nameIdx >= 0) { fixedName = args[nameIdx + 1]; args.splice(nameIdx, 2); }
fs.mkdirSync(out, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), webpackOverride, publicDir });
for (const a of args) {
  const [id, frames] = a.split(":");
  const composition = await selectComposition({ serveUrl, id, inputProps: props });
  for (const fr of (frames ?? "0").split(",")) {
    const frame = fr.endsWith("%") ? Math.floor((composition.durationInFrames - 1) * Number(fr.slice(0, -1)) / 100) : Number(fr);
    const output = path.join(out, fixedName ?? `${id}_${String(frame).padStart(5, "0")}.png`);
    await renderStill({ composition, serveUrl, output, frame, inputProps: props, imageFormat: "png", chromiumOptions: { gl: "angle" },
      onBrowserLog: (l) => { if (l.type === "error" || l.text.startsWith("AMF_WARN")) console.error("[browser]", l.text); } });
    console.log("wrote", output);
  }
}
// Remove the temp webpack bundle (~90 MB).
if (serveUrl.startsWith(os.tmpdir())) fs.rmSync(serveUrl, { recursive: true, force: true });
