import { buildCaptions, validateCaptions, type TimedWord } from "../core/captions";
import { RenderPlan, type Storyboard } from "../core/schemas";
import type { AlignedScene } from "./align";

export const TIMING = {
  introMs: 4000,
  voiceLeadMs: 300, // after intro
  preMs: 240, // scene visual starts this long before its voice
  postMs: 300, // and holds this long after the voice ends  (pre+post ≤ 700 ms of silence)
  outroMs16x9: 20000, // YouTube end screen needs 5–20 s
  outroMs9x16: 3000,
  introMsShorts: 1200, // Shorts: hook must start almost immediately
};

export interface PlanInput {
  sb: Storyboard;
  aligned: AlignedScene[];
  fps: 30 | 60;
  preview: boolean;
  quality?: "1080p" | "4k";
  audioSrc?: string;
  musicSrc?: string;
  images?: Record<string, string>;
  seriesTitle?: string;
  episode?: number;
}

export interface Placement {
  id: string;
  voiceStartMs: number; // absolute
  voiceEndMs: number;
}

/** Lay the scenes out on the absolute timeline and build captions, chapters and the plan. */
export function makePlan(inp: PlanInput): { plan: RenderPlan; placements: Placement[]; captionErrors: string[] } {
  const { sb, aligned, fps } = inp;
  const shorts = sb.format === "shorts_9x16";
  const f = (ms: number) => Math.round((ms * fps) / 1000);
  const introMs = shorts ? TIMING.introMsShorts : TIMING.introMs;
  const introFrames = f(introMs);
  let cursor = introMs + TIMING.voiceLeadMs;
  const placements: Placement[] = [];
  const scenes = sb.scenes.map((scene, i) => {
    const a = aligned.find((x) => x.id === scene.id);
    if (!a) throw new Error(`no alignment for ${scene.id}`);
    // snap the voice start to a frame so word frames are exact
    const voiceStartMs = (f(cursor) * 1000) / fps;
    const voiceEndMs = voiceStartMs + a.durationMs;
    placements.push({ id: scene.id, voiceStartMs, voiceEndMs });
    const fromFrame = i === 0 ? introFrames : f(voiceStartMs - TIMING.preMs);
    cursor = voiceEndMs + TIMING.postMs + TIMING.preMs;
    return { scene, fromFrame, durationFrames: 1, voiceFromMs: voiceStartMs, voiceToMs: voiceEndMs, imageSrc: inp.images?.[scene.id] };
  });
  const lastEnd = placements.at(-1)!.voiceEndMs + TIMING.postMs + 200;
  const outroStart = f(lastEnd);
  scenes.forEach((s, i) => (s.durationFrames = (scenes[i + 1]?.fromFrame ?? outroStart) - s.fromFrame));
  const outroFrames = f(shorts ? TIMING.outroMs9x16 : TIMING.outroMs16x9);

  // words on the absolute timeline
  const words: TimedWord[] = [];
  aligned.forEach((a, si) => {
    const off = placements[si]!.voiceStartMs;
    a.words.forEach((w, wi) => {
      words.push({ text: w.text, scriptWordIndex: words.length, startMs: off + w.startMs, endMs: off + w.endMs, breakAfter: wi === a.words.length - 1 });
    });
  });
  const onScreen = scenes.flatMap((s) => s.scene.onScreenText.map((t) => ({ text: t, fromMs: (s.fromFrame * 1000) / fps, toMs: ((s.fromFrame + s.durationFrames) * 1000) / fps })));
  const captions = buildCaptions(words, { fps, maxLineChars: shorts ? 24 : 42, onScreen });
  const captionErrors = validateCaptions(captions, fps);

  // YouTube chapters (16:9 only): first at 0:00, each ≥ 10 s, ≥ 3 total
  const chapters: { atMs: number; title: string }[] = [];
  if (!shorts) {
    chapters.push({ atMs: 0, title: "شروع" });
    for (const s of scenes) {
      const atMs = (s.fromFrame * 1000) / fps;
      if (s.scene.sceneType === "hook" || s.scene.sceneType === "headline") continue;
      const title = s.scene.onScreenText[0] ?? s.scene.sceneType;
      if (atMs - chapters.at(-1)!.atMs >= 10000) chapters.push({ atMs, title });
    }
    const outroMs = (outroStart * 1000) / fps;
    if (outroMs - chapters.at(-1)!.atMs >= 10000) chapters.push({ atMs: outroMs, title: "جمع‌بندی و ادامه" });
    if (chapters.length < 3) chapters.length = 0;
  }

  // 4K is rendered with Remotion `scale: 2`; the composition stays 1920×1080 so all layouts hold.
  const [width, height] = shorts ? [1080, 1920] : [1920, 1080];
  const plan = RenderPlan.parse({
    jobId: sb.jobId,
    storyboard: sb,
    fps,
    width,
    height,
    durationInFrames: outroStart + outroFrames,
    introFrames,
    outroFrames,
    scenes,
    captions,
    audioSrc: inp.audioSrc,
    musicSrc: inp.musicSrc,
    voiceOffsetMs: 0,
    chapters,
    preview: inp.preview,
    seriesTitle: inp.seriesTitle,
    episode: inp.episode,
  });
  return { plan, placements, captionErrors };
}
