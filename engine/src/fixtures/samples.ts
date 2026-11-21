import type { Channel, MotionStyleId, PlannedScene, Scene } from "@amf/pipeline/core";

/** Sample copy used by the template gallery and studio previews (not deliverables). */
export const SAMPLE: Record<Channel, { title: string; sub: string; lt: [string, string]; quote: [string, string]; series: string; step: string }> = {
  pianova: { title: "آکورد ماژور در ۳ قدم", sub: "درس اول پیانو برای شروع", lt: ["علی باغبانی", "مدرس پیانو"], quote: ["هر نت، یک قدم به سوی رؤیاست", "پیانووا"], series: "آموزش پیانو از صفر", step: "انگشت اول روی نت دو" },
  musicradio69: { title: "موسیقی را حس کن", sub: "پلی‌لیست تازه این هفته", lt: ["رادیو موزیک ۶۹", "پخش زنده"], quote: ["ریتم، زبان مشترک همه ماست", "رادیو موزیک ۶۹"], series: "پلی‌لیست هفته", step: "ریتم را با بیس بشنو" },
  onehandonedream: { title: "با یک دست، یک رؤیا", sub: "داستان یک تصمیم بزرگ", lt: ["علی باغبانی", "نوازنده پیانو"], quote: ["محدودیت، آغاز خلاقیت است", "علی باغبانی"], series: "روایت یک رؤیا", step: "هر روز فقط ده دقیقه" },
  neutral: { title: "سه خبر مهم امروز", sub: "مرور سریع و دقیق", lt: ["تحریریه", "گزارش ویژه"], quote: ["دانستن، اولین قدم تغییر است", "تحریریه"], series: "مرور هفته", step: "داده‌ها را بررسی کن" },
};

export const sampleScene = (id: string, style: MotionStyleId, sceneType: Scene["sceneType"], onScreenText: string[], extra: Partial<Scene> = {}): Scene => ({
  id,
  sceneType,
  voiceText: "این یک متن نمونه برای گالری قالب‌هاست.",
  onScreenText,
  style,
  visual: { prompt: "", source: "none", noTextInImage: true },
  icons: [],
  sources: [],
  transitionIn: "fade",
  emphasis: [],
  ...extra,
});

export const planned = (scene: Scene, durationFrames: number): PlannedScene => ({ scene, fromFrame: 0, durationFrames, voiceFromMs: 0, voiceToMs: 0 });
