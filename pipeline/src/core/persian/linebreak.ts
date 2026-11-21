import { ZWNJ } from "./normalize";

/** Units that must never be separated from the number before them. */
export const UNITS = new Set([
  "دقیقه",
  "ثانیه",
  "ساعت",
  "روز",
  "هفته",
  "ماه",
  "سال",
  "درصد",
  "تومان",
  "دلار",
  "یورو",
  "نفر",
  "بار",
  "مرحله",
  "قدم",
  "نت",
  "آکورد",
  "متر",
  "کیلومتر",
  "کیلو",
  "گرم",
  "میلیون",
  "میلیارد",
  "هزار",
  "قسمت",
  "تمرین",
  "BPM",
  "bpm",
  "%",
]);

/** Words that look bad at the end of a line (they belong to the next phrase). */
const BAD_LINE_END = new Set(["و", "به", "از", "در", "با", "که", "تا", "برای", "این", "آن", "یک", "هر", "بر", "اگر"]);
/** Words that look bad at the start of a line (they belong to the previous phrase). */
const BAD_LINE_START = new Set(["را", "هم", "است", "هست", "شد", "بود", "دارد", "دارند", "داریم", "کرد", "کند", "کنید", "کن", "شود", "شده", "می‌شود", "می‌کند"]);

/** Prepositions/conjunctions that start a new phrase — good places to begin a line. */
const GOOD_LINE_START = new Set(["روی", "به", "از", "در", "با", "تا", "برای", "که", "و", "اما", "ولی", "زیر", "کنار", "بدون", "نه"]);

const isNumber = (w: string) => /^[\d۰-۹٠-٩]+([.,٫][\d۰-۹]+)?%?$/.test(w);
const isLatinStart = (w: string) => /^[«(]?[A-Za-z0-9]/.test(w);

/** Visual length; ZWNJ and bidi marks take no width. */
export const visualLength = (s: string) => s.replace(/[\u200C\u200E\u200F]/g, "").length;

export interface BreakResult {
  lines: string[];
  /** Word index (within the given words) where each line starts. */
  lineStarts: number[];
  penalty: number;
  fits: boolean;
}

function joinLen(words: string[], a: number, b: number) {
  let n = 0;
  for (let i = a; i < b; i++) n += visualLength(words[i]!) + (i > a ? 1 : 0);
  return n;
}

function splitPenalty(words: string[], at: number): number {
  // `at` = index of first word of the new line
  const prev = words[at - 1]!.replace(/[،؛؟!.:»]+$/, "");
  const next = words[at]!;
  let p = 0;
  if (isNumber(prev) && UNITS.has(next.replace(/[،؛؟!.:»]+$/, ""))) p += 1000; // number + unit
  if (BAD_LINE_END.has(prev)) p += 40;
  if (BAD_LINE_START.has(next.replace(/[،؛؟!.:»]+$/, ""))) p += 40;
  if (isLatinStart(next)) p += 60; // no line starting with Latin
  if (/[،؛.!؟:]$/.test(words[at - 1]!)) p -= 25; // prefer breaking after punctuation
  else if (GOOD_LINE_START.has(next)) p -= 8; // or before a new prepositional phrase
  return p;
}

/**
 * Break words into at most `maxLines` lines of at most `maxChars`.
 * Balanced, punctuation-aware, never separates number+unit if avoidable.
 */
export function breakLines(words: string[], maxChars = 42, maxLines = 2): BreakResult {
  const total = joinLen(words, 0, words.length);
  if (total <= maxChars || words.length === 1) {
    return { lines: [words.join(" ")], lineStarts: [0], penalty: 0, fits: total <= maxChars };
  }
  if (maxLines < 2) return { lines: [words.join(" ")], lineStarts: [0], penalty: 0, fits: false };
  let best: BreakResult | null = null;
  for (let at = 1; at < words.length; at++) {
    const a = joinLen(words, 0, at);
    const b = joinLen(words, at, words.length);
    const fits = a <= maxChars && b <= maxChars;
    // Prefer the top line slightly shorter or equal (pyramid reads well for captions).
    const balance = Math.abs(a - b) + (a > b ? 2 : 0);
    // an orphan line (e.g. a lone "دو:" label) reads badly even after punctuation
    const orphan = Math.min(a, b) < 0.34 * Math.max(a, b) ? 30 : 0;
    const penalty = balance + orphan + splitPenalty(words, at) + (fits ? 0 : 10000);
    if (!best || penalty < best.penalty) {
      best = {
        lines: [words.slice(0, at).join(" "), words.slice(at).join(" ")],
        lineStarts: [0, at],
        penalty,
        fits,
      };
    }
  }
  return best!;
}

/** Whether a group of words fits in the caption box. */
export const fitsCaption = (words: string[], maxChars = 42, maxLines = 2) =>
  breakLines(words, maxChars, maxLines).fits;

export { ZWNJ };
