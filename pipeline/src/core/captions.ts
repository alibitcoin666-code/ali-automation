import { CAPTION_RULES, type Caption } from "./schemas";
import { breakLines, fitsCaption, UNITS, visualLength } from "./persian/linebreak";
import { stripForCompare } from "./schemas";

/** One spoken script word with measured timing (from forced alignment). */
export interface TimedWord {
  text: string; // exact script word (never from ASR)
  scriptWordIndex: number;
  startMs: number;
  endMs: number;
  /** Hard page break after this word (scene boundary). */
  breakAfter?: boolean;
}

export interface BuildCaptionOptions {
  fps: number;
  maxLineChars?: number;
  maxLines?: number;
  combineTokensWithinMilliseconds?: number;
  breakOnSilenceAfterMilliseconds?: number;
  leadMs?: number;
  tailMs?: number;
  /** On-screen typography strings with their visible ms span, used to suppress duplicates. */
  onScreen?: { text: string; fromMs: number; toMs: number }[];
}

interface Group {
  words: TimedWord[];
}

const msToFrame = (ms: number, fps: number) => Math.round((ms * fps) / 1000);
const frameToMs = (f: number, fps: number) => (f * 1000) / fps;

/**
 * Build caption pages from script words with aligned timing.
 * Uses createTikTokStyleCaptions for the initial grouping, then enforces:
 *  - max 2 lines × 42 chars (balanced, Persian-aware line breaks)
 *  - min 0.9 s visibility (merges short pages)
 *  - lead-in 0–80 ms before first word, tail ≤ 150 ms after last word
 *  - no overlapping pages, frame-rounded timings
 */
export function buildCaptions(words: TimedWord[], opts: BuildCaptionOptions): Caption[] {
  const fps = opts.fps;
  const maxChars = opts.maxLineChars ?? CAPTION_RULES.maxLineChars;
  const maxLines = opts.maxLines ?? CAPTION_RULES.maxLines;
  const lead = opts.leadMs ?? 40;
  const tail = opts.tailMs ?? 120;
  if (words.length === 0) return [];

  // 1+2) Persian-aware page segmentation (dynamic programming over break points).
  let groups: Group[] = segmentPages(words, {
    maxChars,
    maxLines,
    silenceMs: opts.breakOnSilenceAfterMilliseconds ?? 400,
  }).map((w) => ({ words: w }));
  if (groups.reduce((n, g) => n + g.words.length, 0) !== words.length) throw new Error("caption grouping lost words");

  // 3) Merge pages whose spoken span is too short to be visible for 0.9 s.
  groups = mergeShort(groups, maxChars, maxLines, lead, tail);

  // 4) Timing with lead/tail constraints, no overlaps, frame-rounded.
  const out: Caption[] = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!;
    const first = g.words[0]!;
    const last = g.words[g.words.length - 1]!;
    const prevLast = i > 0 ? groups[i - 1]!.words.at(-1)!.endMs : -Infinity;
    const gapBefore = first.startMs - prevLast;
    const myLead = Math.max(0, Math.min(lead, gapBefore / 2));
    let startF = msToFrame(first.startMs - myLead, fps);
    // never start after the word, never more than 80 ms before it
    while (frameToMs(startF, fps) > first.startMs) startF--;
    while (first.startMs - frameToMs(startF, fps) > CAPTION_RULES.leadMaxMs) startF++;
    startF = Math.max(0, startF);
    if (out.length) {
      // never overlap: when words are back-to-back, the previous page yields (ends on this page's start frame)
      const prev = out[out.length - 1]!;
      const s0 = frameToMs(startF, fps);
      if (prev.endMs > s0) prev.endMs = s0;
    }

    const next = groups[i + 1];
    const nextStartLimit = next ? next.words[0]!.startMs - Math.max(0, Math.min(lead, (next.words[0]!.startMs - last.endMs) / 2)) : Infinity;
    let endMs = Math.min(last.endMs + tail, nextStartLimit);
    // extend to the minimum visibility when the tail budget allows
    const minEnd = frameToMs(startF, fps) + CAPTION_RULES.minPageMs;
    if (endMs < minEnd) endMs = Math.min(Math.max(endMs, minEnd), last.endMs + CAPTION_RULES.tailMaxMs, nextStartLimit);
    let endF = Math.floor((endMs * fps) / 1000);
    while (frameToMs(endF, fps) < last.endMs) endF++;
    while (frameToMs(endF, fps) - last.endMs > CAPTION_RULES.tailMaxMs) endF--;

    const br = breakLines(
      g.words.map((w) => w.text),
      maxChars,
      maxLines,
    );
    out.push({
      pageIndex: i,
      text: g.words.map((w) => w.text).join(" "),
      lines: br.lines,
      startMs: frameToMs(startF, fps),
      endMs: frameToMs(endF, fps),
      tokens: g.words.map((w) => ({
        text: w.text,
        scriptWordIndex: w.scriptWordIndex,
        fromMs: w.startMs,
        toMs: w.endMs,
        fromFrame: msToFrame(w.startMs, fps),
        toFrame: msToFrame(w.endMs, fps),
      })),
      hidden: false,
    });
  }

  // 5) Duplicate suppression against on-screen typography.
  if (opts.onScreen?.length) {
    for (const c of out) {
      const ct = stripForCompare(c.text);
      for (const o of opts.onScreen) {
        if (o.toMs <= c.startMs || o.fromMs >= c.endMs) continue;
        const ot = stripForCompare(o.text);
        if (ot.length >= 8 && ct.length >= 4 && (ct === ot || (ct.includes(ot) && ot.length / ct.length > 0.6) || ot.includes(ct))) {
          c.hidden = true;
        }
      }
    }
  }
  return out;
}

function spanMs(g: Group, lead: number, tail: number) {
  return g.words.at(-1)!.endMs + tail - (g.words[0]!.startMs - lead);
}

function mergeShort(groups: Group[], maxChars: number, maxLines: number, lead: number, tail: number): Group[] {
  const gs = groups.map((g) => ({ words: [...g.words] }));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < gs.length; i++) {
      const g = gs[i]!;
      if (spanMs(g, lead, tail) >= CAPTION_RULES.minPageMs) continue;
      const hardBefore = i > 0 && gs[i - 1]!.words.at(-1)!.breakAfter;
      const hardAfter = g.words.at(-1)!.breakAfter;
      const candidates: number[] = [];
      if (i + 1 < gs.length && !hardAfter) candidates.push(i + 1);
      if (i > 0 && !hardBefore) candidates.push(i - 1);
      // fall back to crossing a scene boundary rather than flashing a page
      if (!candidates.length) {
        if (i + 1 < gs.length) candidates.push(i + 1);
        if (i > 0) candidates.push(i - 1);
      }
      for (const j of candidates) {
        const merged = j > i ? [...g.words, ...gs[j]!.words] : [...gs[j]!.words, ...g.words];
        if (fitsCaption(merged.map((w) => w.text), maxChars, maxLines)) {
          const lo = Math.min(i, j);
          gs.splice(lo, 2, { words: merged });
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  return gs;
}

/** Validate pages against the sync rules; returns human-readable violations. */
export function validateCaptions(pages: Caption[], fps: number): string[] {
  const errs: string[] = [];
  const oneFrame = 1000 / fps;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]!;
    const first = p.tokens[0]!.fromMs;
    const last = p.tokens.at(-1)!.toMs;
    const lead = first - p.startMs;
    if (lead < -0.5 || lead > CAPTION_RULES.leadMaxMs + 0.5) errs.push(`page ${i}: lead ${lead.toFixed(0)}ms`);
    if (p.endMs - last > CAPTION_RULES.tailMaxMs + 0.5) errs.push(`page ${i}: tail ${(p.endMs - last).toFixed(0)}ms`);
    if (p.endMs - p.startMs < CAPTION_RULES.minPageMs - oneFrame) errs.push(`page ${i}: visible ${(p.endMs - p.startMs).toFixed(0)}ms`);
    if (p.lines.length > CAPTION_RULES.maxLines) errs.push(`page ${i}: ${p.lines.length} lines`);
    for (const l of p.lines) if (l.replace(/\u200C/g, "").length > CAPTION_RULES.maxLineChars) errs.push(`page ${i}: line too long`);
    if (i > 0 && p.startMs < pages[i - 1]!.endMs - 0.5) errs.push(`page ${i}: overlaps previous`);
  }
  return errs;
}

/** SRT with the exact script text, RTL-safe (RLM + LRM around Latin runs). */
export function toSrt(pages: Caption[], offsetMs = 0): string {
  const ts = (ms: number) => {
    const t = Math.max(0, Math.round(ms + offsetMs));
    const h = Math.floor(t / 3600000);
    const m = Math.floor((t % 3600000) / 60000);
    const s = Math.floor((t % 60000) / 1000);
    const x = t % 1000;
    const p = (n: number, l = 2) => String(n).padStart(l, "0");
    return `${p(h)}:${p(m)}:${p(s)},${p(x, 3)}`;
  };
  return (
    pages
      .map((p, i) => {
        const lines = p.lines.map((l) => "\u200F" + l.replace(/[A-Za-z][A-Za-z0-9 .'&+\-]*[A-Za-z0-9]|[A-Za-z]/g, (m) => `\u200E${m}\u200E`));
        return `${i + 1}\n${ts(p.startMs)} --> ${ts(p.endMs)}\n${lines.join("\n")}\n`;
      })
      .join("\n") + "\n"
  );
}

/* ------------------------------------------------------------------ */
/* Page segmentation                                                    */
/* ------------------------------------------------------------------ */

const SENT_END = /[.!?؟…]["»)]*$/;
const CLAUSE_END = /[،؛:,]["»)]*$/;
/** A page should never end on these (they open the next phrase). */
const OPENERS = new Set(["و", "از", "در", "به", "با", "برای", "روی", "بین", "مثل", "بدون", "تا", "که", "اگر", "این", "آن", "یک", "هر", "همین", "همان", "چند", "بر", "زیر", "کنار", "پیش", "بعد", "قبل", "یعنی", "نه", "خیلی", "بسیار", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه", "ده"]);
/** A page should never start with these (they close the previous phrase). */
const CLOSERS = new Set(["را", "هم", "است", "است.", "هست", "بود", "شد", "می‌شود", "کرد", "کنید", "کنید.", "دهید", "دهید."]);
const CONJ = new Set(["و", "که", "تا", "اما", "ولی", "اگر", "چون", "زیرا", "یا", "پس", "سپس", "حالا", "وقتی", "در"]);
const bare = (w: string) => w.replace(/^[«("“]+|[»)"”.,،؛:!?؟…]+$/g, "");
const isNum = (w: string) => /^[0-9۰-۹]+([.,٫][0-9۰-۹]+)?%?$/.test(bare(w));

/** Cost of breaking the page after word i (between words[i] and words[i+1]). */
function breakCost(words: TimedWord[], i: number, silenceMs: number): number {
  const w = words[i]!.text;
  const nx = words[i + 1]?.text ?? "";
  if (words[i]!.breakAfter) return -5;
  if (SENT_END.test(w)) return 0;
  let c = 9;
  if (CLAUSE_END.test(w)) c = 2;
  const pause = (words[i + 1]?.startMs ?? Infinity) - words[i]!.endMs;
  if (pause >= silenceMs) c = Math.min(c, 1);
  else if (pause >= 220) c = Math.min(c, 4);
  if (c > 2 && CONJ.has(bare(nx))) c = Math.min(c, 4);
  if (!CLAUSE_END.test(w)) {
    if (OPENERS.has(bare(w))) c += 40;
    if (isNum(w) && UNITS.has(bare(nx))) c += 60;
  }
  if (CLOSERS.has(nx) || CLOSERS.has(bare(nx))) c += 40;
  return c;
}

/**
 * Split words into caption pages: never across a scene boundary, prefer sentence and clause ends,
 * never strand prepositions / «را», keep pages 0.9–5 s and comfortably inside 2 × maxChars.
 */
export function segmentPages(words: TimedWord[], o: { maxChars: number; maxLines: number; silenceMs: number }): TimedWord[][] {
  const n = words.length;
  const ideal = Math.min(o.maxChars * 1.05, o.maxChars * o.maxLines * 0.62);
  const best = new Array<number>(n + 1).fill(Infinity);
  const prev = new Array<number>(n + 1).fill(-1);
  best[0] = 0;
  for (let j = 1; j <= n; j++) {
    for (let i = j - 1; i >= 0; i--) {
      // a page may not contain a hard break (scene end) except at its last word
      // extending the page leftwards to word i: it may not swallow a scene end or a long pause
      if (i < j - 1 && (words[i]!.breakAfter || words[i + 1]!.startMs - words[i]!.endMs >= Math.max(600, o.silenceMs))) break;
      const slice = words.slice(i, j);
      const texts = slice.map((w) => w.text);
      const chars = visualLength(texts.join(" "));
      if (chars > o.maxChars * o.maxLines + 2) break;
      if (!fitsCaption(texts, o.maxChars, o.maxLines)) continue;
      const dur = slice[slice.length - 1]!.endMs - slice[0]!.startMs;
      if (dur > 6500 && slice.length > 1) break;
      let c = ((chars - ideal) / ideal) ** 2 * 12;
      if (dur < 900) c += 18 * ((900 - dur) / 900);
      if (dur > 4500) c += (dur - 4500) / 150;
      // sentence ends inside a page are allowed only for very short sentences
      for (let k = 0; k < slice.length - 1; k++) if (SENT_END.test(slice[k]!.text)) c += 14;
      if (j < n) c += breakCost(words, j - 1, o.silenceMs);
      const total = best[i]! + c;
      if (total < best[j]!) {
        best[j] = total;
        prev[j] = i;
      }
    }
    if (best[j] === Infinity) {
      // single overlong word: give it its own page
      best[j] = best[j - 1]! + 50;
      prev[j] = j - 1;
    }
  }
  const pages: TimedWord[][] = [];
  for (let j = n; j > 0; j = prev[j]!) pages.unshift(words.slice(prev[j]!, j));
  return pages;
}
