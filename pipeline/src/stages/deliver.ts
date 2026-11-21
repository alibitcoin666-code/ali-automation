import fs from "node:fs";
import path from "node:path";
import { toSrt } from "../core/captions";
import type { RenderPlan } from "../core/schemas";
import { toPersianDigits } from "../core/persian/normalize";
import { JobDir, ROOT, log, run, writeJson } from "../lib/util";

const ENGINE = path.join(ROOT, "engine");

export function chaptersText(plan: RenderPlan): string {
  return plan.chapters
    .map((c) => {
      const s = Math.floor(c.atMs / 1000);
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} ${c.title}`;
    })
    .join("\n");
}

/** Persian title / description / hashtags / chapters — ready to paste into YouTube Studio. */
export function metadataText(plan: RenderPlan): string {
  const y = plan.storyboard.youtube;
  const sources = plan.storyboard.scenes.flatMap((s) => s.sources);
  const uniq = [...new Map(sources.map((s) => [s.url, s])).values()];
  return [
    `عنوان:\n${y.title}`,
    `توضیحات:\n${y.description}`,
    plan.chapters.length ? `فصل‌ها:\n${chaptersText(plan)}` : "",
    uniq.length ? `منابع:\n${uniq.map((s) => `- ${s.label}: ${s.url}`).join("\n")}` : "",
    `هشتگ‌ها:\n${y.hashtags.join(" ")}`,
  ]
    .filter(Boolean)
    .join("\n\n") + "\n";
}

export interface Deliverables {
  video: string;
  srt: string;
  txt: string;
  chapters?: string;
  thumbs: string[];
  manifest: string;
}

export async function deliverables(job: JobDir, plan: RenderPlan, video: string, pub: string): Promise<Deliverables> {
  const base = plan.storyboard.format === "shorts_9x16" ? "short" : "video";
  const srt = job.p("out", `${base}.fa.srt`);
  fs.writeFileSync(srt, toSrt(plan.captions.filter((c) => !c.hidden)));
  const txt = job.p("out", `${base}.youtube.txt`);
  fs.writeFileSync(txt, metadataText(plan));
  let chapters: string | undefined;
  if (plan.chapters.length) {
    chapters = job.p("out", "chapters.txt");
    fs.writeFileSync(chapters, chaptersText(plan) + "\n");
  }
  // thumbnails: 1280×720 and 1080×1920 for every job
  const thumbs: string[] = [];
  const hook = plan.scenes[0]!;
  const title = hook.scene.onScreenText[0] ?? plan.storyboard.title;
  const kicker = plan.episode ? `قسمت ${toPersianDigits(String(plan.episode))}` : plan.seriesTitle;
  const props = job.p("render", "thumb-props.json");
  writeJson(props, { channel: plan.storyboard.channel, title, kicker, imageSrc: hook.imageSrc });
  for (const [fmt, name] of [["16x9", "thumb-1280x720.png"], ["9x16", "thumb-1080x1920.png"]] as const) {
    await run(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/stills.mjs", job.p("out"), `Thumb-${plan.storyboard.channel}-${fmt}:0`, "--props", props, "--public", pub, "--name", name], { cwd: ENGINE, quiet: true });
    // YouTube thumbnail limit is 2 MB → JPEG if needed
    const f = job.p("out", name);
    if (fs.statSync(f).size > 1.9e6) {
      const jpg = f.replace(/\.png$/, ".jpg");
      await run("ffmpeg", ["-y", "-v", "error", "-i", f, "-q:v", "2", jpg], { quiet: true });
      fs.rmSync(f);
      thumbs.push(jpg);
    } else thumbs.push(f);
  }
  const manifest = job.p("out", "manifest.json");
  writeJson(manifest, {
    jobId: plan.jobId,
    channel: plan.storyboard.channel,
    format: plan.storyboard.format,
    scriptHash: plan.storyboard.scriptHash,
    files: [video, srt, txt, chapters, ...thumbs].filter(Boolean).map((f) => ({ name: path.basename(f!), bytes: fs.statSync(f!).size })),
    createdAt: new Date().toISOString(),
  });
  log(`[deliver] ${[video, srt, txt, ...thumbs].map((f) => path.basename(f)).join(", ")}`);
  return { video, srt, txt, chapters, thumbs, manifest };
}
