// Builds .work/panel-demo from local sample jobs for the static demo panel (no secrets, no final.mp4).
// Usage: node scripts/panel-demo.mjs id[,id...]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ids = (process.argv[2] ?? "").split(",").filter(Boolean);
const out = path.join(root, ".work/panel-demo");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const WANT = [
  "storyboard.json",
  "render/plan-final.json",
  "render/plan-preview.json",
  "qa/report.json",
  "qa/proof-sheet.png",
  "out/preview-720p.mp4",
  "audio/final.m4a",
];
const rows = [];
const now = Date.now();
ids.forEach((id, n) => {
  const job = path.join(root, ".work/jobs", id);
  const sb = JSON.parse(fs.readFileSync(path.join(job, "storyboard.json"), "utf8"));
  const dst = path.join(out, id);
  fs.mkdirSync(dst, { recursive: true });
  const m4a = path.join(job, "audio/final.m4a");
  if (!fs.existsSync(m4a) && fs.existsSync(path.join(job, "audio/final.wav")))
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", path.join(job, "audio/final.wav"), "-c:a", "aac", "-b:a", "160k", m4a]);
  const outFiles = fs.existsSync(path.join(job, "out")) ? fs.readdirSync(path.join(job, "out")).filter((f) => /\.(srt|txt|jpg|json)$/.test(f)).map((f) => `out/${f}`) : [];
  const files = {};
  for (const rel of [...WANT, ...outFiles]) {
    const src = path.join(job, rel);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(path.dirname(path.join(dst, rel)), { recursive: true });
    fs.copyFileSync(src, path.join(dst, rel));
    files[rel] = rel;
  }
  const final = fs.existsSync(path.join(job, "render/plan-final.json"));
  const qa = fs.existsSync(path.join(job, "qa/report.json")) ? JSON.parse(fs.readFileSync(path.join(job, "qa/report.json"), "utf8")) : null;
  const row = {
    id,
    channel: sb.channel,
    type: sb.type,
    format: sb.format,
    topic: sb.title ?? sb.topic ?? id,
    status: final && qa?.pass ? "delivered" : "preview_review",
    stage: final ? "final" : "preview",
    error: null,
    created_at: now - (ids.length - n) * 3600_000,
    updated_at: now - (ids.length - n) * 3600_000 + 900_000,
  };
  rows.push(row);
  const events = ["guard", "script", "voice", "align", "assets", "preview", ...(final ? ["final", "qa", "deliver"] : [])].map((stage, i) => ({ at: row.created_at + i * 60_000, stage, status: "ok", data: null }));
  fs.writeFileSync(path.join(dst, "job.json"), JSON.stringify({ job: row, events, files }, null, 1));
});
fs.writeFileSync(path.join(out, "index.json"), JSON.stringify(rows.reverse(), null, 1));
console.log(`panel-demo: ${rows.length} jobs → ${out}`);
