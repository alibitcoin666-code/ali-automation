#!/usr/bin/env node
// Scene images with flux-1-schnell on Workers AI (REST). Images never contain text; the engine adds all typography.
// Writes <jobDir>/assets/<sceneId>.jpg (1920×1080 or 1080×1920, cover-cropped). Skips scenes that already have an asset.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const dir = process.argv[2];
const { CF_ACCOUNT_ID: acct, CF_AI_TOKEN: token } = process.env;
if (!acct || !token) {
  console.error("[flux] CF_ACCOUNT_ID / CF_AI_TOKEN missing — skipped");
  process.exit(0);
}
const sb = JSON.parse(fs.readFileSync(path.join(dir, "storyboard.json"), "utf8"));
const theme = JSON.parse(fs.readFileSync(path.resolve("brands", sb.channel, "theme.json"), "utf8"));
const portrait = sb.format === "shorts_9x16";
const [W, H] = portrait ? [1080, 1920] : [1920, 1080];
const NEG = "absolutely no text, no letters, no words, no numbers, no logos, no watermark, no captions, no signage";
const brandLook = {
  pianova: "elegant ivory and warm gold palette, deep navy shadows, soft cinematic light, luxury, shallow depth of field",
  musicradio69: "black chrome and gold, glossy reflections, night studio, moody neon accents, high contrast",
  onehandonedream: "warm gold and deep orange light, hopeful sunrise mood, film grain, no people, no hands",
  neutral: "clean modern editorial look, cool neutral palette, soft daylight",
}[sb.channel];
fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
let made = 0;
for (const s of sb.scenes) {
  if (s.visual?.source !== "flux" || !s.visual.prompt?.trim()) continue;
  const out = path.join(dir, "assets", `${s.id}.jpg`);
  if (fs.existsSync(out)) continue;
  const prompt = `${s.visual.prompt}. ${brandLook}. ${portrait ? "vertical composition, subject centered, empty lower third" : "wide cinematic composition, calm empty lower area"}. ${NEG}.`.slice(0, 2000);
  let ok = false;
  for (let attempt = 0; attempt < 3 && !ok; attempt++) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ prompt, steps: 8, seed: 1000 + attempt + Number(s.id.replace(/\D/g, "")) * 17 }),
    });
    if (!res.ok) {
      console.error(`[flux] ${s.id} HTTP ${res.status}`);
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    const j = await res.json();
    const b64 = j?.result?.image;
    if (!b64) continue;
    const raw = out.replace(/\.jpg$/, ".raw.jpg");
    fs.writeFileSync(raw, Buffer.from(b64, "base64"));
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", raw, "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},unsharp=5:5:0.6`, "-q:v", "2", out]);
    fs.rmSync(raw);
    ok = true;
    made++;
  }
  if (!ok) console.error(`[flux] ${s.id} failed — SVG visual will be used`);
}
console.error(`[flux] ${made} image(s) generated`);
