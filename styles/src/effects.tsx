import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { noise2D } from "@remotion/noise";
import type { BrandTheme, MotionStyle } from "@amf/pipeline/core";
import { hexA } from "./backgrounds";

/** Film grain: seeded SVG turbulence, re-seeded per frame (deterministic). */
export const Grain: React.FC<{ amount: number }> = ({ amount }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  if (amount <= 0) return null;
  const id = `grain-${f % 12}`;
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity: amount * 0.55, pointerEvents: "none" }}>
      <svg width={width} height={height}>
        <filter id={id}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={(f % 12) + 1} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width={width} height={height} filter={`url(#${id})`} />
      </svg>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{ amount: number }> = ({ amount }) =>
  amount <= 0 ? null : (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background: `radial-gradient(ellipse 75% 70% at 50% 50%, transparent 55%, rgba(0,0,0,${0.35 + amount * 0.5}) 100%)`,
      }}
    />
  );

/** Diagonal gold light sweep crossing the frame once per `period` frames. */
export const LightSweep: React.FC<{ color: string; period?: number; offset?: number; strength?: number }> = ({
  color,
  period = 150,
  offset = 0,
  strength = 0.22,
}) => {
  const f = useCurrentFrame();
  const { width } = useVideoConfig();
  const t = ((f + offset) % period) / period;
  const x = interpolate(t, [0, 0.45, 1], [-0.6, 1.6, 1.6]) * width;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: x - 500,
          top: "-30%",
          width: 360,
          height: "160%",
          transform: "rotate(18deg)",
          background: `linear-gradient(90deg, transparent, ${hexA(color, strength)}, ${hexA("#ffffff", strength * 0.6)}, ${hexA(color, strength)}, transparent)`,
        }}
      />
    </AbsoluteFill>
  );
};

export const AnamorphicFlare: React.FC<{ color: string; seed: string }> = ({ color, seed }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const y = height * (0.3 + noise2D(seed, f / 300, 0) * 0.08);
  const x = width * (0.65 + noise2D(seed + "x", 0, f / 300) * 0.1);
  const pulse = 0.65 + 0.35 * Math.sin(f / 45);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: y - 2, height: 4, background: `linear-gradient(90deg, transparent, ${hexA(color, 0.35 * pulse)} 35%, ${hexA("#fff4dc", 0.55 * pulse)} ${(x / width) * 100}%, ${hexA(color, 0.3 * pulse)} 70%, transparent)` }} />
      <div style={{ position: "absolute", left: x - 90, top: y - 90, width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle, ${hexA("#fff4dc", 0.45 * pulse)}, transparent 65%)` }} />
    </AbsoluteFill>
  );
};

/** Organic warm light leaks (CSS, deterministic, cheap). */
export const LightLeak: React.FC<{ seed: string; color?: string; strength?: number }> = ({ seed, color = "#ff9a3c", strength = 0.5 }) => {
  const f = useCurrentFrame();
  const a = (noise2D(seed, f / 90, 0) + 1) / 2;
  const b = (noise2D(seed + "b", 0, f / 110) + 1) / 2;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", opacity: strength }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 45% 70% at ${-5 + a * 25}% ${20 + b * 50}%, ${hexA(color, 0.55 * a)}, transparent 70%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 35% 55% at ${85 + b * 15}% ${70 - a * 40}%, ${hexA("#ffd27a", 0.35 * b)}, transparent 70%)` }} />
    </AbsoluteFill>
  );
};

export const Scanlines: React.FC<{ opacity?: number }> = ({ opacity = 0.07 }) => (
  <AbsoluteFill style={{ pointerEvents: "none", background: `repeating-linear-gradient(0deg, rgba(0,0,0,${opacity}) 0px, rgba(0,0,0,${opacity}) 1px, transparent 2px, transparent 4px)` }} />
);

export const Dust: React.FC<{ seed: string }> = ({ seed }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const n = 14;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {new Array(n).fill(0).map((_, i) => {
        const vis = random(`${seed}-dv-${i}-${Math.floor(f / 3)}`) > 0.6;
        if (!vis) return null;
        const x = random(`${seed}-dx-${i}-${f}`) * width;
        const y = random(`${seed}-dy-${i}-${f}`) * height;
        const s = 1 + random(`${seed}-ds-${i}-${f}`) * 3;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: s, height: s * (1 + random(`${seed}-dl-${i}-${f}`) * 6), borderRadius: s, background: "rgba(255,245,225,0.35)" }} />;
      })}
    </AbsoluteFill>
  );
};

export const SpeedLines: React.FC<{ color: string; seed: string }> = ({ color, seed }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.5 }}>
      {new Array(10).fill(0).map((_, i) => {
        const y = random(`${seed}-sy-${i}`) * height;
        const x = width - ((f * 45 + random(`${seed}-sx-${i}`) * width) % (width * 1.5));
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: 240, height: 2, background: `linear-gradient(90deg, ${hexA(color, 0.6)}, transparent)` }} />;
      })}
    </AbsoluteFill>
  );
};

/** Gate weave: tiny seeded drift of the whole picture like a 16 mm projector. */
export const useGateWeave = (seed: string, enabled: boolean) => {
  const f = useCurrentFrame();
  if (!enabled) return "none";
  const x = noise2D(seed + "gw", f / 6, 0) * 1.6;
  const y = noise2D(seed + "gh", 0, f / 7) * 1.2;
  return `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
};

/** Seeded stop-motion jitter for paper collage (changes every 3 frames). */
export const useJitter = (seed: string, enabled: boolean, amount = 2) => {
  const f = useCurrentFrame();
  if (!enabled) return "none";
  const s = Math.floor(f / 3);
  const x = (random(`${seed}-jx-${s}`) - 0.5) * amount * 2;
  const y = (random(`${seed}-jy-${s}`) - 0.5) * amount * 2;
  const r = (random(`${seed}-jr-${s}`) - 0.5) * amount * 0.4;
  return `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${r.toFixed(2)}deg)`;
};

export const EffectsOverlay: React.FC<{ style: MotionStyle; theme: BrandTheme; seed: string }> = ({ style, theme, seed }) => {
  const e = new Set(style.effects);
  const p = theme.palette;
  return (
    <>
      {e.has("lightSweep") && <LightSweep color={p.accent} period={210} offset={40} />}
      {e.has("anamorphicFlare") && <AnamorphicFlare color={p.accent} seed={seed} />}
      {e.has("lightLeak") && <LightLeak seed={seed} />}
      {e.has("dust") && <Dust seed={seed} />}
      {e.has("speedLines") && <SpeedLines color={p.accent} seed={seed} />}
      {e.has("scanlines") && <Scanlines />}
      {e.has("vignette") && <Vignette amount={style.grade.vignette} />}
      {e.has("grain") && <Grain amount={style.grade.grain} />}
      {style.grade.tint && (
        <AbsoluteFill style={{ pointerEvents: "none", background: style.grade.tint, mixBlendMode: "soft-light", opacity: 0.18 }} />
      )}
    </>
  );
};

/** CSS filter string for the style's color grade (applied to the scene, never to text layers). */
export const gradeFilter = (style: MotionStyle) =>
  `contrast(${style.grade.contrast}) saturate(${style.grade.saturation}) brightness(${style.grade.brightness ?? 1})`;
