import { describe, expect, it } from "vitest";
import { buildCaptions, validateCaptions, toSrt, Caption, type TimedWord } from "../src/core";

function synth(text: string, startMs = 0, wpm = 150, gapEvery = 0, gapMs = 0): TimedWord[] {
  const words = text.split(" ");
  const per = 60000 / wpm;
  let t = startMs;
  return words.map((w, i) => {
    if (gapEvery && i > 0 && i % gapEvery === 0) t += gapMs;
    const s = t;
    t += per;
    return { text: w, scriptWordIndex: i, startMs: s, endMs: t - 40 };
  });
}

const TEXT = "امروز می‌خواهیم با هم یاد بگیریم که چطور با دست چپ آکوردهای پایه را بنوازیم. اول آرام شروع کنید، بعد کم‌کم سرعت را بالا ببرید. هر روز فقط ۱۵ دقیقه تمرین کافی است.";

describe("buildCaptions", () => {
  for (const fps of [30, 60]) {
    it(`satisfies sync rules @${fps}fps`, () => {
      const pages = buildCaptions(synth(TEXT, 500), { fps });
      expect(validateCaptions(pages, fps)).toEqual([]);
      for (const p of pages) expect(() => Caption.parse(p)).not.toThrow();
    });
  }
  it("keeps every script word exactly once, in order", () => {
    const words = synth(TEXT, 0);
    const pages = buildCaptions(words, { fps: 30 });
    const flat = pages.flatMap((p) => p.tokens.map((t) => t.text));
    expect(flat).toEqual(words.map((w) => w.text));
    expect(pages.map((p) => p.text).join(" ")).toBe(TEXT);
  });
  it("breaks on silence > 400ms", () => {
    const words = synth(TEXT, 0, 150, 6, 700);
    const pages = buildCaptions(words, { fps: 30 });
    for (const p of pages) {
      for (let i = 1; i < p.tokens.length; i++) expect(p.tokens[i]!.fromMs - p.tokens[i - 1]!.toMs).toBeLessThan(700);
    }
    expect(validateCaptions(pages, 30)).toEqual([]);
  });
  it("respects hard breaks at scene boundaries", () => {
    const words = synth(TEXT, 0);
    words[9]!.breakAfter = true;
    const pages = buildCaptions(words, { fps: 30 });
    expect(pages.some((p) => p.tokens.at(-1)!.scriptWordIndex === 9)).toBe(true);
  });
  it("merges short isolated pages to >= 0.9s", () => {
    const words: TimedWord[] = [
      { text: "سلام!", scriptWordIndex: 0, startMs: 0, endMs: 350 },
      { text: "امروز", scriptWordIndex: 1, startMs: 1000, endMs: 1300 },
      { text: "شروع", scriptWordIndex: 2, startMs: 1320, endMs: 1600 },
      { text: "می‌کنیم.", scriptWordIndex: 3, startMs: 1620, endMs: 2100 },
    ];
    const pages = buildCaptions(words, { fps: 30 });
    expect(validateCaptions(pages, 30)).toEqual([]);
  });
  it("fast speech still fits 2 lines x 42", () => {
    const pages = buildCaptions(synth(TEXT + " " + TEXT, 0, 210), { fps: 30 });
    for (const p of pages) {
      expect(p.lines.length).toBeLessThanOrEqual(2);
      for (const l of p.lines) expect(l.replace(/\u200C/g, "").length).toBeLessThanOrEqual(42);
    }
    expect(validateCaptions(pages, 30)).toEqual([]);
  });
  it("hides subtitle when typography repeats the spoken sentence", () => {
    const words = synth("هر روز فقط ۱۵ دقیقه تمرین کافی است", 0);
    const pages = buildCaptions(words, { fps: 30, onScreen: [{ text: "هر روز فقط ۱۵ دقیقه تمرین کافی است", fromMs: 0, toMs: 5000 }] });
    expect(pages.every((p) => p.hidden)).toBe(true);
  });
  it("frame-rounded highlight frames", () => {
    const pages = buildCaptions(synth(TEXT, 123), { fps: 30 });
    for (const p of pages) for (const t of p.tokens) expect(t.fromFrame).toBe(Math.round((t.fromMs * 30) / 1000));
  });
});

describe("toSrt", () => {
  it("formats timestamps and RTL marks", () => {
    const pages = buildCaptions(synth("به کانال Pianova خوش آمدید", 1000), { fps: 30 });
    const srt = toSrt(pages);
    expect(srt).toMatch(/^1\n00:00:00,9\d\d --> 00:00:0\d,\d{3}\n\u200F/);
    expect(srt).toContain("\u200EPianova\u200E");
  });
});

describe("Persian page segmentation", () => {
  const sent = "اگر همیشه فکر می‌کردید نواختن آکورد پیانو سخت است، این ویدیو برای شماست. امروز در کمتر از دو دقیقه، اولین آکورد واقعی‌تان را می‌نوازید.";
  const pages = buildCaptions(synth(sent, 0, 160), { fps: 30 });
  it("never ends a page on a preposition / number before unit, never starts with «را»", () => {
    for (const p of pages.slice(0, -1)) {
      const last = p.tokens.at(-1)!.text;
      expect(["از", "در", "به", "با", "برای", "دو", "این", "و"]).not.toContain(last);
    }
    for (const p of pages) expect(p.tokens[0]!.text).not.toBe("را");
  });
  it("breaks at sentence ends", () => {
    expect(pages.some((p) => p.tokens.at(-1)!.text === "شماست.")).toBe(true);
  });
});

describe("breakLines orphan guard", () => {
  it("does not leave a lone label word on the first line", async () => {
    const { breakLines } = await import("../src/core/persian/linebreak");
    const r = breakLines("دو: انگشت میانی روی نت می.".split(" "), 24, 2);
    expect(r.lines[0]).not.toBe("دو:");
    expect(r.fits).toBe(true);
  });
});

describe("breakLines phrase start", () => {
  it("keeps noun + adjective together and breaks before the preposition", async () => {
    const { breakLines } = await import("../src/core/persian/linebreak");
    expect(breakLines("دو: انگشت میانی روی نت می.".split(" "), 24, 2).lines).toEqual(["دو: انگشت میانی", "روی نت می."]);
  });
});
