import React from "react";
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { BrandTheme } from "@amf/pipeline/core";
import { bez, clamp, Grain, hexA, LightLeak, Vignette } from "@amf/styles";
import { Wordmark } from "./wordmark";

/**
 * Channel intros (3-5 s). Every intro ends on a clean frame so the first scene can
 * cut or transition from it. All motion uses eased curves (no linear hero moves).
 */
export const Intro: React.FC<{ theme: BrandTheme; durationInFrames: number }> = (p) => {
  switch (p.theme.id) {
    case "pianova":
      return <PianovaIntro {...p} />;
    case "musicradio69":
      return <MR69Intro {...p} />;
    case "onehandonedream":
      return <OhodIntro {...p} />;
    default:
      return <NeutralIntro {...p} />;
  }
};

const outFade = (f: number, d: number) => interpolate(f, [d - 10, d], [1, 0], { ...clamp, easing: bez([0.7, 0, 0.84, 0]) });

/** Perspective ivory/black piano keys, drawn in SVG. `lit` = indices of keys glowing. */
export const PianoKeys: React.FC<{ width: number; height: number; accent: string; progress: number; lit?: number[]; ivory?: string }> = ({ width, height, accent, progress, lit = [], ivory = "#F3EBDD" }) => {
  const n = 21;
  const kw = width / n;
  const blacks = [0, 1, 3, 4, 5];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="ivory" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ivory} />
          <stop offset="0.85" stopColor="#D8CDB8" />
          <stop offset="1" stopColor="#9C917E" />
        </linearGradient>
        <linearGradient id="ebony" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2A2A30" />
          <stop offset="1" stopColor="#050507" />
        </linearGradient>
      </defs>
      {new Array(n).fill(0).map((_, i) => {
        const appear = interpolate(progress, [i / n / 1.6, i / n / 1.6 + 0.35], [0, 1], clamp);
        const isLit = lit.includes(i);
        return (
          <g key={i} opacity={appear} transform={`translate(0 ${(1 - appear) * 40})`}>
            <rect x={i * kw + 1.5} y={0} width={kw - 3} height={height} rx={kw * 0.08} fill="url(#ivory)" />
            {isLit && <rect x={i * kw + 1.5} y={0} width={kw - 3} height={height} rx={kw * 0.08} fill={hexA(accent, 0.55)} />}
          </g>
        );
      })}
      {new Array(n - 1).fill(0).map((_, i) => {
        if (!blacks.includes(i % 7)) return null;
        const appear = interpolate(progress, [i / n / 1.6 + 0.1, i / n / 1.6 + 0.45], [0, 1], clamp);
        return <rect key={`b${i}`} opacity={appear} x={(i + 1) * kw - kw * 0.3} y={0} width={kw * 0.6} height={height * 0.62} rx={kw * 0.06} fill="url(#ebony)" />;
      })}
    </svg>
  );
};

const PianovaIntro: React.FC<{ theme: BrandTheme; durationInFrames: number }> = ({ theme, durationInFrames: d }) => {
  const f = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const p = theme.palette;
  const keysT = interpolate(f, [0, 50], [0, 1], { ...clamp, easing: bez([0.16, 1, 0.3, 1]) });
  const logo = spring({ frame: f - 28, fps, config: { damping: 200, stiffness: 60, mass: 1.2 } });
  const shimmer = interpolate(f, [50, 95], [0, 1], { ...clamp, easing: bez([0.45, 0, 0.55, 1]) });
  const lineW = interpolate(f, [14, 60], [0, 1], { ...clamp, easing: bez([0.65, 0, 0.35, 1]) });
  const portrait = height > width;
  const keyW = portrait ? width * 1.4 : width * 0.9;
  const lit = [Math.floor(interpolate(f, [30, 90], [0, 20], clamp))];
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 70% at 50% 40%, ${p.bgAlt}, ${p.bg} 70%)`, opacity: outFade(f, d) }}>
      <AbsoluteFill style={{ perspective: 1400 }}>
        <div style={{ position: "absolute", left: (width - keyW) / 2, top: height * (portrait ? 0.66 : 0.7), transform: `rotateX(58deg) scale(${1 + 0.04 * keysT})`, transformOrigin: "50% 0%" }}>
          <PianoKeys width={keyW} height={height * 0.36} accent={p.accent} progress={keysT} lit={lit} ivory={p.primary} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, transparent 55%, ${p.bg} 100%)` }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `translateY(${-height * 0.08 + (1 - logo) * 30}px) scale(${0.94 + logo * 0.06})` }}>
        <Wordmark theme={theme} size={portrait ? 118 : 150} reveal={logo} shimmer={shimmer} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: width / 2 - (width * 0.32 * lineW) / 2, top: height * 0.62, width: width * 0.32 * lineW, height: 2, background: `linear-gradient(90deg, transparent, ${p.accent}, transparent)` }} />
      <LightLeak seed="pianova-intro" color="#ffcf87" strength={0.35} />
      <Vignette amount={0.6} />
      <Grain amount={0.3} />
    </AbsoluteFill>
  );
};

const MR69Intro: React.FC<{ theme: BrandTheme; durationInFrames: number }> = ({ theme, durationInFrames: d }) => {
  const f = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const p = theme.palette;
  const bars = 48;
  const beat = (fr: number) => Math.max(0, Math.sin((fr / fps) * Math.PI * 2 * 2)) ** 6; // 120 bpm pulse
  const slam = spring({ frame: f - 24, fps, config: { damping: 11, stiffness: 180, mass: 0.7 } });
  const ring = interpolate(f, [24, 60], [0, 1], { ...clamp, easing: bez([0.16, 1, 0.3, 1]) });
  const shimmer = interpolate(f, [40, 80], [0, 1], { ...clamp, easing: bez([0.45, 0, 0.55, 1]) });
  const portrait = height > width;
  return (
    <AbsoluteFill style={{ background: p.bg, opacity: outFade(f, d) }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: width / bars / 3.2, height: height * 0.5 }}>
          {new Array(bars).fill(0).map((_, i) => {
            const c = Math.abs(i - bars / 2) / (bars / 2);
            const v = (0.15 + 0.85 * (1 - c) ** 1.6) * (0.35 + 0.65 * beat(f + i * 0.4)) * (0.6 + 0.4 * random(`mr-${i}-${Math.floor(f / 2)}`));
            const intro = interpolate(f, [i * 0.3, i * 0.3 + 14], [0, 1], clamp);
            return <div key={i} style={{ width: (width / bars) * 0.68, height: height * 0.42 * v * intro + 4, borderRadius: 3, background: i % 2 ? hexA(p.accent, 0.85) : chrome, opacity: 0.35 + 0.4 * (1 - c) }} />;
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", width: 520 * ring, height: 520 * ring, borderRadius: "50%", border: `3px solid ${hexA(p.accent, 1 - ring)}`, boxShadow: `0 0 60px ${hexA(p.accent, 0.4 * (1 - ring))}` }} />
        <div style={{ transform: `scale(${interpolate(slam, [0, 1], [1.6, 1])})`, opacity: interpolate(slam, [0, 0.2], [0, 1], clamp) }}>
          <Wordmark theme={theme} size={portrait ? 120 : 150} shimmer={shimmer} />
        </div>
      </AbsoluteFill>
      <Vignette amount={0.6} />
      <Grain amount={0.15} />
    </AbsoluteFill>
  );
};
const chrome = "linear-gradient(180deg, #F2F4F7, #6B7079 50%, #C9CED6)";

const OhodIntro: React.FC<{ theme: BrandTheme; durationInFrames: number }> = ({ theme, durationInFrames: d }) => {
  const f = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const p = theme.palette;
  const ember = interpolate(f, [0, 34], [0, 1], { ...clamp, easing: bez([0.16, 1, 0.3, 1]) });
  const line = interpolate(f, [20, 62], [0, 1], { ...clamp, easing: bez([0.65, 0, 0.35, 1]) });
  const logo = spring({ frame: f - 40, fps, config: { damping: 200, stiffness: 55, mass: 1.3 } });
  const shimmer = interpolate(f, [62, 105], [0, 1], { ...clamp, easing: bez([0.45, 0, 0.55, 1]) });
  const portrait = height > width;
  const cx = width / 2;
  const cy = height * (portrait ? 0.44 : 0.46);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 60% at 50% 45%, ${p.bgAlt}, ${p.bg} 75%)`, opacity: outFade(f, d) }}>
      <div style={{ position: "absolute", left: cx - 300 * ember, top: cy - 300 * ember, width: 600 * ember, height: 600 * ember, borderRadius: "50%", background: `radial-gradient(circle, ${hexA(p.accent2 ?? p.accent, 0.5 * (1 - line * 0.6))}, transparent 65%)` }} />
      <div style={{ position: "absolute", left: cx - (width * 0.4 * line) / 2, top: cy + (portrait ? 150 : 120), width: width * 0.4 * line, height: 2, background: `linear-gradient(90deg, transparent, ${p.accent}, ${p.accent2}, ${p.accent}, transparent)` }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", top: cy - height / 2 }}>
        <div style={{ transform: `translateY(${(1 - logo) * 24}px)`, width: portrait ? width * 0.86 : undefined }}>
          <Wordmark theme={theme} size={portrait ? 92 : 138} reveal={logo} shimmer={shimmer} />
        </div>
      </AbsoluteFill>
      <LightLeak seed="ohod-intro" color={p.accent2 ?? "#c2551f"} strength={0.45} />
      <Vignette amount={0.7} />
      <Grain amount={0.35} />
    </AbsoluteFill>
  );
};

const NeutralIntro: React.FC<{ theme: BrandTheme; durationInFrames: number }> = ({ theme, durationInFrames: d }) => {
  const f = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const p = theme.palette;
  const s = spring({ frame: f - 6, fps, config: { damping: 14, stiffness: 140, mass: 0.8 } });
  const logo = spring({ frame: f - 30, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: p.bg, opacity: outFade(f, d) }}>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + f / 60;
        const r = interpolate(s, [0, 1], [width, 220 + i * 40]);
        return <div key={i} style={{ position: "absolute", left: width / 2 + Math.cos(a) * r - 40, top: height / 2 + Math.sin(a) * r * 0.5 - 40, width: 80, height: 80, borderRadius: i % 2 ? "50%" : 18, background: i % 2 ? p.accent : p.accent2, opacity: 0.85 * (1 - logo * 0.5) }} />;
      })}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Wordmark theme={theme} size={height > width ? 110 : 140} reveal={logo} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
