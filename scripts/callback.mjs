#!/usr/bin/env node
// Signed stage callback from GitHub Actions to the Worker: X-AMF-Timestamp + X-AMF-Signature = HMAC-SHA256(ts + "." + body).
// Usage: node scripts/callback.mjs <jobId> <stage> <ok|failed|running> [errorFile] [qaReport]
import crypto from "node:crypto";
import fs from "node:fs";

const [jobId, stage, status, errFile, qaFile] = process.argv.slice(2);
const url = process.env.CALLBACK_URL;
const secret = process.env.CALLBACK_SECRET;
if (!url || !secret) {
  console.log("[callback] CALLBACK_URL / CALLBACK_SECRET not set — skipped");
  process.exit(0);
}
const body = { jobId, stage, status };
if (errFile && fs.existsSync(errFile)) body.error = fs.readFileSync(errFile, "utf8").split("\n").filter((l) => /fail|error|QA/i.test(l)).slice(-12).join("\n").slice(0, 1800) || "see Actions log";
if (qaFile && fs.existsSync(qaFile)) {
  const qa = JSON.parse(fs.readFileSync(qaFile, "utf8"));
  const c = qa.checks ?? {};
  const lines = [
    `QA: ${qa.pass ? "PASS" : "FAIL"}`,
    c.av ? `video: ${c.av.codec ?? ""} ${c.av.profile ?? ""} ${c.av.width ?? ""}x${c.av.height ?? ""} ${c.av.fps ?? ""}fps ${c.av.videoKbps ? Math.round(c.av.videoKbps / 1000) + " Mbps" : ""}` : "",
    c.loudness ? `loudness: ${c.loudness.I ?? c.loudness.integrated} LUFS, TP ${c.loudness.TP ?? c.loudness.truePeak}` : "",
    c.drift ? `subtitle drift max: ${c.drift.maxMs ?? c.drift.max} ms` : "",
    ...(qa.failures ?? []).map((f) => `✗ ${f}`),
  ].filter(Boolean);
  body.qa = { pass: !!qa.pass, lines };
}
if (process.env.DRIVE_URL) body.driveUrl = process.env.DRIVE_URL;
const raw = JSON.stringify(body);
const ts = String(Math.floor(Date.now() / 1000));
const sig = crypto.createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");
const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-amf-timestamp": ts, "x-amf-signature": sig }, body: raw });
console.log(`[callback] ${stage}/${status} → HTTP ${res.status}`);
if (!res.ok) process.exit(1);
