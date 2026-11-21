import { buildCaptions, RenderPlan, type Storyboard } from "@amf/pipeline/core";
import { sampleScene } from "./samples";

/** Small studio-only plan with synthetic timings (the real pipeline supplies measured ones). */
export function demoPlan(): RenderPlan {
  const fps = 30;
  const intro = 120;
  const voice = [
    "آیا می‌دانستید که با فقط سه قدم ساده می‌توانید اولین آکورد پیانو را بنوازید؟",
    "خیلی‌ها فکر می‌کنند آکورد سخت است، اما راز آن فاصله‌هاست.",
    "قدم اول: انگشت شست را روی نت دو بگذارید.",
    "قدم دوم: انگشت میانی روی نت می قرار می‌گیرد.",
    "قدم سوم: انگشت کوچک را روی نت سل بگذارید و هر سه را با هم بزنید.",
    "پس شست روی دو، میانی روی می و کوچک روی سل.",
    "اگر این درس مفید بود، پیانووا را دنبال کنید.",
  ];
  const scenes = [
    sampleScene("s1", "cinematicLuxury", "hook", ["آکورد ماژور در ۳ قدم", "درس اول پیانو"], { emphasis: ["۳"], pianoNotes: [7, 9, 11] }),
    sampleScene("s2", "cinematicLuxury", "problem", ["راز آکورد: فاصله‌ها", "نه حفظ کردن، بلکه فهمیدن"], { icons: ["bulb", "music"] }),
    sampleScene("s3", "cinematicLuxury", "step", ["شست روی نت دو"], { pianoNotes: [7] }),
    sampleScene("s4", "kineticTypography", "step", ["انگشت میانی روی می"], { pianoNotes: [9], transitionIn: "maskWipeRtl" }),
    sampleScene("s5", "cinematicLuxury", "step", ["کوچک روی سل، با هم"], { pianoNotes: [11, 7, 9, 11], transitionIn: "lightSweep" }),
    sampleScene("s6", "cinematicLuxury", "recap", ["دو با شست", "می با میانی", "سل با کوچک"]),
    sampleScene("s7", "cinematicLuxury", "cta", ["درس بعد: آکورد مینور"], { transitionIn: "filmBurn" }),
  ].map((s, i) => ({ ...s, voiceText: voice[i]! }));
  let t = (intro / fps) * 1000 + 200;
  const words: { text: string; scriptWordIndex: number; startMs: number; endMs: number; breakAfter?: boolean }[] = [];
  const planned = scenes.map((scene) => {
    const startMs = t;
    const ws = scene.voiceText.split(" ");
    ws.forEach((w, i) => {
      words.push({ text: w, scriptWordIndex: words.length, startMs: t, endMs: t + 300, breakAfter: i === ws.length - 1 });
      t += 360;
    });
    const endMs = t;
    t += 500;
    return { scene, fromFrame: Math.round(((startMs - 200) * fps) / 1000), durationFrames: 1, voiceFromMs: startMs, voiceToMs: endMs };
  });
  planned.forEach((p, i) => {
    const next = planned[i + 1];
    p.durationFrames = (next ? next.fromFrame : Math.round((t * fps) / 1000)) - p.fromFrame;
  });
  const outroStart = Math.round((t * fps) / 1000);
  const outro = 20 * fps;
  const sb: Storyboard = {
    version: 1, jobId: "demo", type: "EDUCATIONAL", channel: "pianova", format: "landscape_16x9", language: "fa-IR",
    title: "آکورد ماژور", mainStyle: "cinematicLuxury", accentStyles: ["kineticTypography"], scenes: scenes as Storyboard["scenes"],
    youtube: { title: "آکورد ماژور در سه قدم", description: "", hashtags: [] }, factCheckConfirmed: false,
  };
  return RenderPlan.parse({
    jobId: "demo", storyboard: sb, fps, width: 1920, height: 1080, durationInFrames: outroStart + outro, introFrames: intro, outroFrames: outro,
    scenes: planned, captions: buildCaptions(words, { fps }), voiceOffsetMs: 0, chapters: [], preview: true,
  });
}
