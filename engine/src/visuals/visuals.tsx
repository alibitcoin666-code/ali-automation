import { resolveSrc } from "../lib/src";
import React from "react";
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath } from "@remotion/paths";
import type { BrandTheme, ChartData, MotionStyle } from "@amf/pipeline/core";
import { toPersianDigits } from "@amf/pipeline/core";
import { bez, clamp, hexA } from "@amf/styles";
import { PianoKeys, goldFill } from "@amf/templates";

const easeOut = bez([0.16, 1, 0.3, 1]);

/* ------------------------------------------------------------------ */
/* Icons (24x24 stroke icons, original drawings)                       */
/* ------------------------------------------------------------------ */
const ICONS: Record<string, string> = {
  piano: "M3 5h18v14H3z M7 5v8 M11 5v8 M15 5v8 M5.5 13h3 M9.5 13h3 M13.5 13h3 M7 13v6 M11 13v6 M15 13v6 M19 5v14",
  music: "M9 18V5l12-2v13 M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  hand: "M7 11V6a1.5 1.5 0 0 1 3 0v4 M10 10V4.5a1.5 1.5 0 0 1 3 0V10 M13 10V5.5a1.5 1.5 0 0 1 3 0V11 M16 11V8a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L3.5 14a1.5 1.5 0 0 1 2.4-1.8L7 13.5",
  check: "M4 12.5l5 5L20 6.5",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  bulb: "M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2",
  chart: "M4 20V4 M4 20h16 M8 16v-4 M12 16V8 M16 16v-6",
  heart: "M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z",
  mic: "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z M5 11a7 7 0 0 0 14 0 M12 18v3",
  play: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M10 8.5l6 3.5-6 3.5z",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 19V5 M8 7h7",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z",
  news: "M4 5h13v14H6a2 2 0 0 1-2-2z M17 9h3v8a2 2 0 0 1-2 2 M7 9h7 M7 13h7 M7 17h4",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0z M8 6H5a3 3 0 0 0 3 4 M16 6h3a3 3 0 0 1-3 4 M12 13v4 M9 21h6 M10 17h4v4h-4z",
  rocket: "M5 15c-1 1-1.5 3.5-1.5 4.5 1 0 3.5-.5 4.5-1.5 M9 15l-2-2 M14.5 3.5C18 3 21 6 20.5 9.5L13 17l-6-6z M15 9a1 1 0 1 0 0-.01",
  headphones: "M4 15v-3a8 8 0 0 1 16 0v3 M4 15a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2z M20 15a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2z",
};
export const ICON_NAMES = Object.keys(ICONS);

export const Icon: React.FC<{ name: string; size: number; color: string; delay?: number; stroke?: number }> = ({ name, size, color, delay = 0, stroke = 1.6 }) => {
  const f = useCurrentFrame();
  const d = ICONS[name] ?? ICONS.star!;
  const t = interpolate(f, [delay, delay + 24], [0, 1], { ...clamp, easing: easeOut });
  const parts = d.split(/ (?=M)/);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {parts.map((pd, i) => {
        let ev: { strokeDasharray: string; strokeDashoffset: number } | null = null;
        try {
          ev = evolvePath(t, pd);
        } catch {
          ev = null;
        }
        return <path key={i} d={pd} strokeDasharray={ev?.strokeDasharray} strokeDashoffset={ev?.strokeDashoffset} />;
      })}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Image frame with Ken Burns (flux b-roll, never contains text)       */
/* ------------------------------------------------------------------ */
export const ImageFrame: React.FC<{ src: string; w: number; h: number; theme: BrandTheme; durationInFrames: number; radius?: number; seed: string; full?: boolean }> = ({ src, w, h, theme, durationInFrames, radius = 22, seed, full }) => {
  const f = useCurrentFrame();
  const t = interpolate(f, [0, durationInFrames], [0, 1], { ...clamp, easing: bez([0.45, 0, 0.55, 1]) });
  const dir = seed.length % 2 ? 1 : -1;
  const inT = interpolate(f, [0, 18], [0, 1], { ...clamp, easing: easeOut });
  return (
    <div style={{ width: w, height: h, borderRadius: full ? 0 : radius, overflow: "hidden", position: "relative", boxShadow: full ? undefined : `0 30px 80px rgba(0,0,0,0.55), 0 0 0 1.5px ${hexA(theme.palette.accent, 0.55)}`, opacity: full ? 1 : inT, transform: full ? undefined : `scale(${0.96 + 0.04 * inT})` }}>
      <Img src={resolveSrc(src)!} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.06 + 0.08 * t}) translateX(${dir * (t - 0.5) * 2.5}%)` }} />
      {!full && <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, transparent 60%, ${hexA(theme.palette.bg, 0.45)})` }} />}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Piano visual: keyboard with highlighted notes (proposed addition)   */
/* ------------------------------------------------------------------ */
export const PianoVisual: React.FC<{ w: number; h: number; theme: BrandTheme; notes?: number[] }> = ({ w, h, theme, notes }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seq = notes && notes.length ? notes : [7, 9, 11, 12, 14, 11, 9, 7];
  const step = Math.round(fps * 0.5);
  const i = Math.floor(f / step) % seq.length;
  const t = interpolate(f, [0, 30], [0, 1], { ...clamp, easing: easeOut });
  const glow = 0.5 + 0.5 * Math.sin(f / 10);
  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 24, background: `radial-gradient(ellipse 70% 60% at 50% 60%, ${hexA(theme.palette.accent, 0.12 + 0.05 * glow)}, transparent 70%)` }} />
      <div style={{ transform: `perspective(1200px) rotateX(38deg)`, transformOrigin: "50% 100%" }}>
        <PianoKeys width={w * 0.94} height={h * 0.55} accent={theme.palette.accent} progress={t} lit={[seq[i]!]} ivory={theme.palette.primary} />
      </div>
      {/* note particles rising from the lit key */}
      {new Array(6).fill(0).map((_, k) => {
        const life = ((f + k * 7) % 42) / 42;
        const x = ((seq[i]! + 0.5) / 21) * w * 0.94 + w * 0.03 + Math.sin(k * 2.1 + f / 9) * 18;
        return <div key={k} style={{ position: "absolute", left: x, top: h * 0.3 - life * h * 0.25, width: 8, height: 8, borderRadius: 8, background: theme.palette.accent, opacity: (1 - life) * 0.8, boxShadow: `0 0 12px ${theme.palette.accent}` }} />;
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Data visualisation (bars / counter / progress / timeline)           */
/* ------------------------------------------------------------------ */
export const DataViz: React.FC<{ chart: ChartData; w: number; h: number; theme: BrandTheme; style: MotionStyle; font: string }> = ({ chart, w, h, theme, style, font }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = theme.palette;
  const max = Math.max(...chart.series.map((s) => s.value), 1);
  const fmt = (v: number) => toPersianDigits(Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", "٫"));
  const unit = chart.unit ? `\u00A0${chart.unit}` : "";
  const label: React.CSSProperties = { direction: "rtl", letterSpacing: 0, whiteSpace: "pre", fontFamily: font, color: p.text };
  if (chart.kind === "counter" || chart.kind === "progress") {
    const s = chart.series[0]!;
    const t = interpolate(f, [6, 6 + fps * 1.2], [0, 1], { ...clamp, easing: bez([0.22, 1, 0.36, 1]) });
    const v = Math.round(s.value * t);
    const R = Math.min(w, h) * 0.4;
    const C = 2 * Math.PI * R;
    const pct = chart.kind === "progress" ? Math.min(1, s.value / 100) : 1;
    return (
      <div data-amf-layer="typography" data-amf-id="chart" data-amf-text={`${fmt(s.value)}${unit} ${s.label}`} style={{ width: w, height: h, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
          <circle cx={w / 2} cy={h / 2} r={R} fill="none" stroke={hexA(p.text, 0.1)} strokeWidth={16} />
          <circle cx={w / 2} cy={h / 2} r={R} fill="none" stroke={p.accent} strokeWidth={16} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct * t)} transform={`rotate(-90 ${w / 2} ${h / 2}) scale(-1 1) translate(${-w} 0)`} />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ ...label, fontWeight: 900, fontSize: R * 0.55, lineHeight: 1.1, fontVariantNumeric: "tabular-nums", backgroundImage: goldFill(p.accent), backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent" }}>{fmt(v)}{unit}</span>
          <span style={{ ...label, fontWeight: 600, fontSize: Math.max(34, R * 0.16), color: p.textMuted }}>{s.label}</span>
        </div>
      </div>
    );
  }
  // bars (also used for line/pie/timeline in v1 as horizontal RTL bars)
  const n = chart.series.length;
  const rowH = Math.min(96, (h - 20) / n);
  const labelW = w * 0.32;
  return (
    <div data-amf-layer="typography" data-amf-id="chart" data-amf-text={chart.series.map((s) => `${s.label} ${fmt(s.value)}`).join(" ")} dir="rtl" style={{ width: w, height: h, display: "flex", flexDirection: "column", justifyContent: "center", gap: rowH * 0.25 }}>
      {chart.series.map((s, i) => {
        const g = spring({ frame: f - 8 - i * 5, fps, config: style.spring });
        const bw = (w - labelW - 150) * (s.value / max) * g;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", height: rowH * 0.75, gap: 18 }}>
            <span style={{ ...label, width: labelW, textAlign: "right", fontWeight: 600, fontSize: Math.min(40, rowH * 0.42), overflow: "hidden" }}>{s.label}</span>
            <div style={{ width: bw, height: rowH * 0.5, borderRadius: 8, background: i === 0 ? goldFill(p.accent) : `linear-gradient(270deg, ${p.accent}, ${hexA(p.accent, 0.55)})`, boxShadow: `0 0 20px ${hexA(p.accent, 0.3)}` }} />
            <span style={{ ...label, fontWeight: 800, fontSize: Math.min(40, rowH * 0.42), fontVariantNumeric: "tabular-nums", opacity: g }}>{fmt(Math.round(s.value * g * 10) / 10)}{unit}</span>
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Audio spectrum (audio-reactive visual)                              */
/* ------------------------------------------------------------------ */
export const SpectrumBars: React.FC<{ w: number; h: number; bins: number[]; theme: BrandTheme; mirrored?: boolean }> = ({ w, h, bins, theme, mirrored = true }) => {
  const p = theme.palette;
  const all = mirrored ? [...bins.slice().reverse(), ...bins] : bins;
  const bw = w / all.length;
  return (
    <svg width={w} height={h}>
      <defs>
        <linearGradient id="spg" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={p.accent2 ?? p.accent} />
          <stop offset="1" stopColor={p.accent} />
        </linearGradient>
      </defs>
      {all.map((v, i) => {
        const bh = Math.max(4, v * h * 0.95);
        return <rect key={i} x={i * bw + bw * 0.18} y={(h - bh) / 2} width={bw * 0.64} height={bh} rx={bw * 0.3} fill="url(#spg)" opacity={0.55 + 0.45 * v} />;
      })}
    </svg>
  );
};
