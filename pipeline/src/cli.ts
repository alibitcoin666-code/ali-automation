#!/usr/bin/env tsx
/**
 * ALI MOTION FACTORY job runner (used by GitHub Actions and locally).
 *
 *   tsx src/cli.ts script  --id J --request req.json            → storyboard.json (awaits Telegram approval)
 *   tsx src/cli.ts produce --id J --storyboard sb.json [--stage preview|final] [--fps 30] [--4k]
 *   tsx src/cli.ts qa      --id J
 *
 * Every artefact is written to the job dir (AMF_WORK/jobs/<id>/), which the workflow mirrors to R2 jobs/<id>/.
 */
import fs from "node:fs";
import path from "node:path";
import { Storyboard, type JobRequest } from "./core/schemas";
import { guard, guardStoryboard } from "./stages/guard";
import { writeScript, hashScript } from "./stages/script";
import { voice as voiceStage, type VoiceScene } from "./stages/voice";
import { align as alignStage, type AlignedScene } from "./stages/align";
import { makePlan } from "./stages/plan";
import { mix } from "./stages/mix";
import { renderFinal, renderPreview, stagePublic } from "./stages/render";
import { runQa, proofSheet } from "./stages/qa";
import { run } from "./lib/util";
import { deliverables } from "./stages/deliver";
import { JobDir, log, readJson, writeJson } from "./lib/util";

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (k: string, d?: string) => {
  const i = argv.indexOf(`--${k}`);
  return i < 0 ? d : argv[i + 1];
};
const flag = (k: string) => argv.includes(`--${k}`);

function status(job: JobDir, stage: string, data: Record<string, unknown>) {
  const f = job.p("status.json");
  const cur = fs.existsSync(f) ? readJson<Record<string, unknown>>(f) : {};
  writeJson(f, { ...cur, [stage]: { ...data, at: new Date().toISOString() } });
}

function requestFromStoryboard(sb: Storyboard, fps: number, k4: boolean): JobRequest {
  return {
    type: sb.type,
    channel: sb.channel,
    format: sb.format,
    style: sb.mainStyle,
    durationSec: 60,
    topic: sb.title,
    points: [],
    sources: sb.scenes.flatMap((s) => s.sources),
    fps: fps as 30 | 60,
    quality: k4 ? "4k" : "1080p",
  };
}

async function main() {
  const id = opt("id");
  if (!id) throw new Error("--id required");
  const job = new JobDir(id);

  if (cmd === "script") {
    const req = readJson<JobRequest>(opt("request")!);
    const g = guard(req);
    status(job, "guard", g as unknown as Record<string, unknown>);
    if (!g.ok) throw new Error(`guard: ${g.reasons.join("; ")}`);
    const edits = opt("edits") && fs.existsSync(opt("edits")!) ? readJson<string[]>(opt("edits")!) : [];
    const previous = edits.length && job.has("storyboard.json") ? Storyboard.parse(readJson(job.p("storyboard.json"))) : undefined;
    const r = await writeScript(id, req, { edits, previous });
    writeJson(job.p("storyboard.json"), r.storyboard);
    status(job, "script", { ok: true, model: r.model, repaired: r.repaired, spell: r.spell });
    log(`[script] ok model=${r.model} scenes=${r.storyboard.scenes.length} spellFlags=${r.spell.length}`);
    return;
  }

  if (cmd === "produce") {
    const sb = Storyboard.parse(readJson(opt("storyboard") ?? job.p("storyboard.json")));
    // The owner approved this exact script in Telegram / the panel (sources were shown with it).
    if (flag("owner-approved") && sb.type === "NEWS") sb.factCheckConfirmed = true;
    sb.scriptHash = hashScript(sb);
    writeJson(job.p("storyboard.json"), sb);
    const fps = Number(opt("fps", sb.channel === "musicradio69" ? "60" : "30")) as 30 | 60;
    const k4 = flag("4k");
    const g0 = guard(requestFromStoryboard(sb, fps, k4));
    const gs = guardStoryboard(sb);
    const g = { ok: g0.ok && (gs.ok || (sb.type === "NEWS" && gs.reasons.every((r) => r.startsWith("NEWS")) && opt("stage") !== "final")), reasons: [...g0.reasons, ...gs.reasons] };
    status(job, "guard", g as unknown as Record<string, unknown>);
    if (!g.ok) throw new Error(`guard: ${g.reasons.join("; ")}`);
    if (sb.type === "NEWS" && !sb.factCheckConfirmed && opt("stage") === "final") throw new Error("NEWS final requires factCheckConfirmed");

    // voice + align are cached per script hash so preview → final reuse identical timing
    const cacheKey = job.p("voice", "hash.txt");
    let voice: VoiceScene[];
    let aligned: AlignedScene[];
    if (fs.existsSync(cacheKey) && fs.readFileSync(cacheKey, "utf8") === sb.scriptHash && job.has("align", "aligned.json") && !flag("revoice")) {
      voice = readJson(job.p("voice", "voice.json"));
      aligned = readJson(job.p("align", "aligned.json"));
      log("[produce] reusing voice + alignment (script unchanged)");
    } else {
      voice = await voiceStage(job, sb, { force: opt("tts") });
      fs.writeFileSync(cacheKey, sb.scriptHash!);
      status(job, "voice", { ok: true, provider: voice[0]!.provider });
      aligned = await alignStage(job, sb, voice);
      status(job, "align", { ok: true, meanScore: aligned.map((a) => +a.meanScore.toFixed(3)) });
    }

    const images: Record<string, string> = {};
    const imgDir = job.p("assets", ".keep");
    for (const s of sb.scenes) {
      for (const ext of ["jpg", "png", "webp", "mp4"]) {
        const f = path.join(path.dirname(imgDir), `${s.id}.${ext}`);
        if (fs.existsSync(f)) images[s.id] = `assets/${s.id}.${ext}`;
      }
    }
    const pre = makePlan({ sb, aligned, fps, preview: true, quality: k4 ? "4k" : "1080p", images });
    if (pre.captionErrors.length) throw new Error(`captions invalid:\n${pre.captionErrors.join("\n")}`);
    const audio = await mix(job, pre.plan, voice, pre.placements, { sfx: !flag("no-sfx") });
    status(job, "mix", { ok: true, ...audio.stats, track: audio.track });
    const files: Record<string, string> = { "audio/final.wav": audio.final, "audio/music.wav": audio.music };
    for (const [sid, rel] of Object.entries(images)) files[rel] = job.p(rel);
    const pub = stagePublic(job, files);
    const { plan } = makePlan({ sb, aligned, fps, preview: true, quality: k4 ? "4k" : "1080p", images, audioSrc: "audio/final.wav", musicSrc: "audio/music.wav", seriesTitle: opt("series"), episode: opt("episode") ? Number(opt("episode")) : undefined });
    writeJson(job.p("plan.json"), plan);

    const stage = opt("stage", "preview");
    if (stage === "plan") return;
    if (stage === "preview" || stage === "both") {
      const r = await renderPreview(job, plan, pub, audio.final);
      await proofSheet(job, plan, r.file);
      // compact AAC copy of the final mix for the web panel's live Remotion preview
      await run("ffmpeg", ["-y", "-v", "error", "-i", audio.final, "-c:a", "aac", "-b:a", "160k", job.p("audio", "final.m4a")], { quiet: true });
      status(job, "preview", { ok: true, file: r.file, seconds: r.seconds });
      log(`[preview] ${r.file} in ${r.seconds.toFixed(0)}s`);
    }
    if (stage === "final" || stage === "both") {
      const r = await renderFinal(job, { ...plan, preview: false }, pub, audio.final, { k4 });
      status(job, "final", { ok: true, file: r.file, seconds: r.seconds });
      log(`[final] ${r.file} in ${r.seconds.toFixed(0)}s`);
      const qa = await runQa(job, plan, r.file, r.probeLog!);
      status(job, "qa", qa as unknown as Record<string, unknown>);
      await deliverables(job, plan, r.file, pub);
      if (!qa.pass) throw new Error(`QA failed: ${qa.failures.join("; ")}`);
    }
    return;
  }

  if (cmd === "qa") {
    const plan = readJson<import("./core/schemas").RenderPlan>(job.p("plan.json"));
    const file = opt("file", job.p("out", "final.mp4"))!;
    const qa = await runQa(job, plan, file, opt("probe", job.p("qa", "probe-final.jsonl"))!);
    status(job, "qa", qa as unknown as Record<string, unknown>);
    if (!qa.pass) throw new Error(`QA failed: ${qa.failures.join("; ")}`);
    return;
  }
  throw new Error(`unknown command ${cmd}`);
}

main().catch((e) => {
  console.error(`[fail] ${(e as Error).stack ?? e}`);
  process.exit(1);
});
