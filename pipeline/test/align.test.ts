import { describe, expect, it } from "vitest";
import { alignSequences, driftStats, similarity } from "../src/core";

describe("alignSequences", () => {
  const script = "امروز می‌خواهیم آکوردهای پایه را با دست چپ بنوازیم".split(" ");
  it("maps exact ASR", () => {
    const asr = script.map((w, i) => ({ word: w, start: i * 400, end: i * 400 + 350 }));
    const a = alignSequences(script, asr);
    expect(a.every((x) => x.matched)).toBe(true);
    expect(a.map((x) => x.text)).toEqual(script);
  });
  it("tolerates ASR spelling variants (no ZWNJ, Arabic yeh)", () => {
    const asr = ["امروز", "میخواهیم", "آکوردهاي", "پایه", "را", "با", "دست", "چپ", "بنوازیم"].map((w, i) => ({ word: w, start: i * 400, end: i * 400 + 350 }));
    const a = alignSequences(script, asr);
    expect(a.filter((x) => x.matched).length).toBe(script.length);
  });
  it("interpolates missing words; text always from script", () => {
    const asr = ["امروز", "آکوردهای", "پایه", "را", "چپ", "بنوازیم"].map((w, i) => ({ word: w, start: i * 500, end: i * 500 + 400 }));
    const a = alignSequences(script, asr);
    expect(a.map((x) => x.text)).toEqual(script);
    for (let i = 1; i < a.length; i++) expect(a[i]!.startMs).toBeGreaterThanOrEqual(a[i - 1]!.startMs);
  });
  it("ignores inserted ASR words", () => {
    const asr = ["امروز", "اوم", "می‌خواهیم", "آکوردهای", "پایه", "را", "با", "دست", "چپ", "بنوازیم"].map((w, i) => ({ word: w, start: i * 400, end: i * 400 + 350 }));
    const a = alignSequences(script, asr);
    expect(a.filter((x) => x.matched).length).toBe(script.length);
    expect(a[1]!.asrIndex).toBe(2);
  });
  it("similarity basics", () => {
    expect(similarity("می‌خواهیم", "میخواهیم")).toBe(1);
    expect(similarity("كتاب", "کتاب")).toBe(1);
    expect(similarity("پیانو", "گیتار")).toBeLessThan(0.5);
  });
  it("drift stats", () => {
    const s = driftStats([{ startMs: 0 }, { startMs: 100 }, { startMs: 200 }], [{ startMs: 10 }, { startMs: 130 }, { startMs: 190 }]);
    expect(s.max).toBe(30);
  });
});
