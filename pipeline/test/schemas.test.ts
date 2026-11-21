import { describe, expect, it } from "vitest";
import { Storyboard, Scene, Template, TextLayer, MotionStyle } from "../src/core";

const scene = (id: string, sceneType: string, extra: object = {}) => ({
  id, sceneType, voiceText: "این یک جمله آزمایشی برای صحنه است.", onScreenText: ["کلمه کلیدی"], style: "kineticTypography",
  visual: { prompt: "piano", source: "none", noTextInImage: true }, icons: [], transitionIn: "fade", ...extra,
});
const sb = (type: string, scenes: object[]) => ({
  version: 1, jobId: "j1", type, channel: "pianova", format: "landscape_16x9", language: "fa-IR", title: "عنوان",
  mainStyle: "kineticTypography", accentStyles: [], scenes, youtube: { title: "عنوان ویدیو", description: "", hashtags: [] },
});

describe("Storyboard", () => {
  it("valid EDU", () => {
    const r = Storyboard.safeParse(sb("EDUCATIONAL", [scene("1", "hook"), scene("2", "problem"), scene("3", "step"), scene("4", "step"), scene("5", "step"), scene("6", "recap"), scene("7", "cta")]));
    expect(r.success).toBe(true);
  });
  it("EDU with 2 steps fails", () => {
    const r = Storyboard.safeParse(sb("EDUCATIONAL", [scene("1", "hook"), scene("2", "problem"), scene("3", "step"), scene("4", "step"), scene("6", "recap"), scene("7", "cta")]));
    expect(r.success).toBe(false);
  });
  it("NEWS fact without source fails", () => {
    const r = Storyboard.safeParse(sb("NEWS", [scene("1", "headline"), scene("2", "fact"), scene("3", "fact"), scene("4", "fact"), scene("5", "context"), scene("6", "whatNext")]));
    expect(r.success).toBe(false);
  });
  it("NEWS with sources passes", () => {
    const src = { sources: [{ label: "BBC", url: "https://bbc.com/x" }] };
    const r = Storyboard.safeParse(sb("NEWS", [scene("1", "headline"), scene("2", "fact", src), scene("3", "fact", src), scene("4", "fact", src), scene("5", "context"), scene("6", "whatNext")]));
    expect(r.success).toBe(true);
  });
  it("style outside main/accent fails", () => {
    const r = Storyboard.safeParse(sb("PROMO", [scene("1", "hook", { style: "neonGlow" }), scene("2", "pain"), scene("3", "benefit"), scene("4", "proof"), scene("5", "offer"), scene("6", "cta")]));
    expect(r.success).toBe(false);
  });
});

describe("Scene", () => {
  it("onScreenText copying voice fails", () => {
    const r = Scene.safeParse(scene("1", "hook", { onScreenText: ["این یک جمله آزمایشی برای صحنه است."] }));
    expect(r.success).toBe(false);
  });
  it("more than 8 words per line fails", () => {
    const r = Scene.safeParse(scene("1", "hook", { onScreenText: ["یک دو سه چهار پنج شش هفت هشت نه"] }));
    expect(r.success).toBe(false);
  });
  it("noTextInImage must be true", () => {
    const r = Scene.safeParse(scene("1", "hook", { visual: { prompt: "x", source: "flux", noTextInImage: false } }));
    expect(r.success).toBe(false);
  });
});

describe("Template zones", () => {
  const base = { id: "t", channel: "pianova", kind: "episode", format: "landscape_16x9", width: 1920, height: 1080, fps: 30, safeArea: { top: 108, bottom: 108, left: 192, right: 192 }, slots: [], goldenFrames: [0] };
  it("overlapping subtitle and typography fails", () => {
    const r = Template.safeParse({ ...base, zones: { sub: { rect: { x: 0, y: 900, w: 1920, h: 150 }, layer: "subtitle" }, t: { rect: { x: 0, y: 950, w: 400, h: 100 }, layer: "typography" } } });
    expect(r.success).toBe(false);
  });
  it("separate zones pass", () => {
    const r = Template.safeParse({ ...base, zones: { sub: { rect: { x: 0, y: 900, w: 1920, h: 150 }, layer: "subtitle" }, t: { rect: { x: 0, y: 100, w: 400, h: 100 }, layer: "typography" } } });
    expect(r.success).toBe(true);
  });
});

describe("TextLayer", () => {
  it("rejects letterSpacing != 0 and short hold", () => {
    const l = { id: "a", role: "title", text: "سلام", lang: "fa", dir: "rtl", zone: "z", font: "Estedad", sizePx: 120, weight: 800, lineHeight: 1.2, maxLines: 2, letterSpacing: 0, startFrame: 0, endFrame: 30, enter: "x", exit: "y" };
    expect(TextLayer.safeParse(l).success).toBe(false);
    expect(TextLayer.safeParse({ ...l, endFrame: 60 }).success).toBe(true);
    expect(TextLayer.safeParse({ ...l, endFrame: 60, letterSpacing: 2 }).success).toBe(false);
  });
});

describe("MotionStyle", () => {
  it("linear hero easing fails", () => {
    const s = { id: "kineticTypography", label: "x", labelFa: "x", easing: { heroIn: [0.5, 0.5, 0.5, 0.5] }, spring: { damping: 10, stiffness: 100, mass: 1 }, transitions: ["fade"], transitionFrames: 12, textPresets: ["wordSpring"], background: "gradient", effects: [], camera: ["static"], grade: { contrast: 1, saturation: 1, grain: 0, vignette: 0 }, allowedFonts: ["Vazirmatn"], audioReactive: false };
    expect(MotionStyle.safeParse(s).success).toBe(false);
  });
});
