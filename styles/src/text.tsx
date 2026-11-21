import React, { useMemo } from "react";
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { measureText } from "@remotion/layout-utils";
import { UNITS, type MotionStyle } from "@amf/pipeline/core";
import { bez, clamp } from "./util";

export type TextPreset = MotionStyle["textPresets"][number];

const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
export const isRtlText = (s: string) => {
  const w = s.split(/\s+/).filter(Boolean);
  return w.filter((x) => RTL.test(x)).length >= w.length / 2;
};

/** Glue number + unit with NBSP so they never break apart. */
export function glueUnits(words: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const next = words[i + 1];
    if (next && /^[\d۰-۹٠-٩]+([.,٫][\d۰-۹]+)?%?$/.test(w) && UNITS.has(next.replace(/[،؛؟!.:»]+$/, ""))) {
      out.push(`${w}\u00A0${next}`);
      i++;
    } else out.push(w);
  }
  return out;
}

const LATIN_WORD = /^[("'«]?[A-Za-z0-9][\x20-\x7E\u00A0]*$/;
export const isLatinWord = (w: string) => LATIN_WORD.test(w) && /[A-Za-z0-9]/.test(w);

/**
 * Words are animated as inline-blocks, which the bidi algorithm treats as neutral
 * objects. A run of Latin words inside an RTL line would therefore be reversed.
 * We merge consecutive Latin words into one LTR-isolated token (animated together).
 */
export function mergeLatinRuns(words: string[], rtl: boolean): string[] {
  if (!rtl) return words;
  const out: string[] = [];
  for (const w of words) {
    const prev = out[out.length - 1];
    if (prev != null && isLatinWord(prev) && isLatinWord(w)) out[out.length - 1] = `${prev} ${w}`;
    else out.push(w);
  }
  return out;
}

export interface LaidOutText {
  lines: string[][];
  fontSize: number;
  lineHeightPx: number;
  width: number;
  height: number;
}

/**
 * Measure-based layout: picks the largest font size in [minSize,maxSize] such that
 * the words fit in `maxWidth` with at most `maxLines` balanced lines.
 */
export function layoutText(opts: {
  text: string;
  fontFamily: string;
  fontWeight: number;
  maxWidth: number;
  maxLines: number;
  minSize: number;
  maxSize: number;
  lineHeight: number;
}): LaidOutText {
  const words = mergeLatinRuns(glueUnits(opts.text.split(/\s+/).filter(Boolean)), isRtlText(opts.text));
  const measure = (s: string, size: number) =>
    measureText({ text: s, fontFamily: opts.fontFamily, fontSize: size, fontWeight: String(opts.fontWeight), letterSpacing: "0px", validateFontIsLoaded: true }).width;
  for (let size = opts.maxSize; size >= opts.minSize; size -= 2) {
    const space = measure(" ", size);
    const widths = words.map((w) => measure(w, size));
    const lines = balanceLines(widths, space, opts.maxWidth, opts.maxLines);
    if (lines) {
      const ls = lines.map((idx) => idx.map((i) => words[i]!));
      const lw = lines.map((idx) => idx.reduce((a, i, k) => a + widths[i]! + (k ? space : 0), 0));
      return { lines: ls, fontSize: size, lineHeightPx: size * opts.lineHeight, width: Math.max(...lw), height: ls.length * size * opts.lineHeight };
    }
  }
  // Fall back to min size, greedy (the collision QA will flag overflow).
  const size = opts.minSize;
  return { lines: [words], fontSize: size, lineHeightPx: size * opts.lineHeight, width: opts.maxWidth, height: size * opts.lineHeight };
}

function balanceLines(widths: number[], space: number, maxW: number, maxLines: number): number[][] | null {
  const n = widths.length;
  if (widths.some((w) => w > maxW)) return null;
  const total = widths.reduce((a, b) => a + b, 0) + space * (n - 1);
  if (total <= maxW) return [widths.map((_, i) => i)];
  for (let L = 2; L <= maxLines; L++) {
    // minimal raggedness DP for exactly L lines
    const target = total / L;
    let best: { cost: number; breaks: number[] } | null = null;
    const rec = (start: number, linesLeft: number, acc: number[], cost: number) => {
      if (best && cost >= best.cost) return;
      if (linesLeft === 1) {
        let w = 0;
        for (let i = start; i < n; i++) w += widths[i]! + (i > start ? space : 0);
        if (w > maxW) return;
        const c = cost + (w - target) ** 2;
        if (!best || c < best.cost) best = { cost: c, breaks: [...acc] };
        return;
      }
      let w = 0;
      for (let end = start; end < n - (linesLeft - 1); end++) {
        w += widths[end]! + (end > start ? space : 0);
        if (w > maxW) break;
        rec(end + 1, linesLeft - 1, [...acc, end + 1], cost + (w - target) ** 2);
      }
    };
    rec(0, L, [], 0);
    if (best) {
      const b = (best as { breaks: number[] }).breaks;
      const out: number[][] = [];
      let s = 0;
      for (const e of [...b, n]) {
        out.push(new Array(e - s).fill(0).map((_, k) => s + k));
        s = e;
      }
      return out;
    }
  }
  return null;
}

export interface KineticTextProps {
  id: string;
  text: string;
  preset: TextPreset;
  /** Local frame at which the text starts entering. */
  startFrame: number;
  /** Optional local frames at which each word is spoken (for punches synced to voice). */
  wordFrames?: (number | null)[];
  fontFamily: string;
  fontWeight: number;
  color: string;
  accent: string;
  maxWidth: number;
  maxLines: number;
  minSize: number;
  maxSize: number;
  lineHeight: number;
  align?: "start" | "center" | "end";
  springConfig: { damping: number; stiffness: number; mass: number };
  easing?: readonly [number, number, number, number];
  stagger?: number;
  layer?: "typography" | "lowerThird" | "logo";
  shadow?: string;
  gradient?: string;
  emphasis?: string[];
  exitFrame?: number;
  style?: React.CSSProperties;
}

/**
 * Word-level kinetic text. Persian words are never split into letters,
 * letter-spacing is always 0, direction is decided from the words.
 */
export const KineticText: React.FC<KineticTextProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rtl = isRtlText(p.text);
  const layout = useMemo(
    () =>
      layoutText({
        text: p.text,
        fontFamily: p.fontFamily,
        fontWeight: p.fontWeight,
        maxWidth: p.maxWidth,
        maxLines: p.maxLines,
        minSize: p.minSize,
        maxSize: p.maxSize,
        lineHeight: p.lineHeight,
      }),
    [p.text, p.fontFamily, p.fontWeight, p.maxWidth, p.maxLines, p.minSize, p.maxSize, p.lineHeight],
  );
  const stagger = p.stagger ?? Math.max(2, Math.round(fps * 0.08));
  const ease = bez(p.easing ?? [0.16, 1, 0.3, 1]);
  const emph = new Set((p.emphasis ?? []).map((e) => e.replace(/[«»،؛؟!.:]/g, "")));
  let wi = -1;
  const exitT = p.exitFrame != null ? interpolate(frame, [p.exitFrame, p.exitFrame + 8], [0, 1], clamp) : 0;

  const lineReveal = (li: number) => interpolate(frame, [p.startFrame + li * 5, p.startFrame + li * 5 + 16], [0, 1], { ...clamp, easing: ease });

  return (
    <div
      data-amf-layer={p.layer ?? "typography"}
      data-amf-id={p.id}
      data-amf-text={p.text}
      dir={rtl ? "rtl" : "ltr"}
      lang={rtl ? "fa" : "en"}
      style={{
        fontFamily: `"${p.fontFamily}", "Vazirmatn", "NotoNaskhArabic"`,
        fontWeight: p.fontWeight,
        fontSize: layout.fontSize,
        lineHeight: `${layout.lineHeightPx}px`,
        letterSpacing: 0,
        color: p.color,
        textAlign: p.align === "center" ? "center" : rtl ? (p.align === "end" ? "left" : "right") : p.align === "end" ? "right" : "left",
        whiteSpace: "pre",
        textShadow: p.shadow,
        opacity: 1 - exitT,
        transform: exitT ? `translateY(${-exitT * 20}px)` : undefined,
        ...p.style,
      }}
    >
      {layout.lines.map((line, li) => {
        const lr = lineReveal(li);
        const lineStyle: React.CSSProperties = { display: "block" };
        if (p.preset === "lineMaskRtl") {
          // reveal from the reading start: right edge for RTL
          lineStyle.clipPath = rtl ? `inset(-20% 0 -20% ${(1 - lr) * 100}%)` : `inset(-20% ${(1 - lr) * 100}% -20% 0)`;
          lineStyle.transform = `translateX(${(rtl ? -1 : 1) * (1 - lr) * -30}px)`;
        }
        return (
          <span key={li} style={lineStyle}>
            {line.map((word, k) => {
              wi++;
              const idx = wi;
              const delay = p.startFrame + idx * stagger;
              const s = spring({ frame: frame - delay, fps, config: p.springConfig, durationRestThreshold: 0.001 });
              const t = interpolate(frame, [delay, delay + 14], [0, 1], { ...clamp, easing: ease });
              const spoken = p.wordFrames?.[idx];
              const isEmph = emph.has(word.replace(/[«»،؛؟!.:]/g, ""));
              const ws: React.CSSProperties = { display: "inline-block", whiteSpace: "pre" };
              switch (p.preset) {
                case "wordSpring":
                  ws.opacity = interpolate(s, [0, 0.4], [0, 1], clamp);
                  ws.transform = `translateY(${(1 - s) * 60}px) scale(${0.85 + 0.15 * s})`;
                  break;
                case "weightMorph": {
                  const wght = interpolate(t, [0, 1], [300, p.fontWeight]);
                  ws.opacity = interpolate(t, [0, 0.3], [0, 1], clamp);
                  ws.fontVariationSettings = `"wght" ${Math.round(wght)}`;
                  ws.fontWeight = Math.round(wght);
                  ws.transform = `translateY(${(1 - s) * 30}px)`;
                  break;
                }
                case "scalePunch": {
                  const base = interpolate(s, [0, 1], [0.6, 1]);
                  const pf = spoken ?? delay;
                  const punch = spring({ frame: frame - pf, fps, config: { damping: 9, stiffness: 260, mass: 0.5 } });
                  const bump = frame >= pf ? interpolate(punch, [0, 0.5, 1], [0, 1, 0], clamp) * 0.12 : 0;
                  ws.opacity = interpolate(s, [0, 0.3], [0, 1], clamp);
                  ws.transform = `scale(${base + bump})`;
                  if (frame >= pf && isEmph) ws.color = p.accent;
                  break;
                }
                case "fadeUp":
                  ws.opacity = t;
                  ws.transform = `translateY(${(1 - t) * 28}px)`;
                  break;
                case "blurIn":
                  ws.opacity = t;
                  ws.filter = `blur(${(1 - t) * 14}px)`;
                  ws.transform = `scale(${1.06 - 0.06 * t})`;
                  break;
                case "echo": {
                  ws.opacity = interpolate(s, [0, 0.3], [0, 1], clamp);
                  ws.transform = `translateX(${(rtl ? 1 : -1) * (1 - s) * 120}px)`;
                  ws.textShadow = `${(rtl ? 1 : -1) * (1 - s) * 40}px 0 0 ${p.accent}55, ${(rtl ? 1 : -1) * (1 - s) * 80}px 0 0 ${p.accent}22`;
                  break;
                }
                case "glitchIn": {
                  const on = frame >= delay;
                  const g = on ? Math.max(0, 1 - (frame - delay) / 8) : 1;
                  const jx = (random(`${p.id}-g-${idx}-${frame}`) - 0.5) * 24 * g;
                  ws.opacity = on ? (g > 0.5 && random(`${p.id}-gf-${idx}-${frame}`) > 0.6 ? 0.3 : 1) : 0;
                  ws.transform = `translateX(${jx}px)`;
                  ws.textShadow = g > 0 ? `${3 * g}px 0 0 #ff2e63, ${-3 * g}px 0 0 #08f7fe` : undefined;
                  break;
                }
                case "cutIn":
                  ws.opacity = frame >= p.startFrame ? 1 : 0;
                  break;
                case "counter":
                  ws.opacity = t;
                  break;
                case "lineMaskRtl":
                  break;
              }
              if (isEmph && p.preset !== "scalePunch") ws.color = p.accent;
              if (p.gradient && !ws.color) {
                ws.backgroundImage = p.gradient;
                ws.backgroundClip = "text";
                ws.WebkitBackgroundClip = "text";
                ws.color = "transparent";
              }
              return (
                <React.Fragment key={k}>
                  {k > 0 ? " " : null}
                  <span style={ws} dir={rtl && isLatinWord(word) ? "ltr" : undefined}>{p.preset === "counter" ? <Counter word={word} t={t} /> : word}</span>
                </React.Fragment>
              );
            })}
          </span>
        );
      })}
    </div>
  );
};

/** Animated number with tabular Persian digits. Non-numeric words pass through. */
export const Counter: React.FC<{ word: string; t: number }> = ({ word, t }) => {
  const m = word.match(/^([^\d۰-۹]*)([\d۰-۹]+)(.*)$/);
  if (!m) return <>{word}</>;
  const fa = /[۰-۹]/.test(m[2]!);
  const target = Number(m[2]!.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
  const v = Math.round(target * t);
  const s = fa ? String(v).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!) : String(v);
  const padded = s.padStart(m[2]!.length, "\u2007");
  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      {m[1]}
      {t >= 1 ? m[2] : padded}
      {m[3]}
    </span>
  );
};
