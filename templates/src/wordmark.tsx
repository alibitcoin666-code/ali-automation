import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import type { BrandTheme } from "@amf/pipeline/core";
import { bez, clamp, hexA } from "@amf/styles";

/** Brushed-gold bevel fill used by PIANOVA / OHOD / MR69 marks (CSS gradient on text). */
export const goldFill = (accent: string, light = "#FFF1C9", dark = "#7A5A22") =>
  `linear-gradient(180deg, ${light} 0%, ${accent} 38%, ${dark} 52%, ${accent} 64%, ${light} 100%)`;
export const chromeFill = "linear-gradient(180deg, #FFFFFF 0%, #C9CED6 30%, #4A4F57 50%, #A4AAB3 62%, #F2F4F7 100%)";

const textFill = (bg: string): React.CSSProperties => ({
  backgroundImage: bg,
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  color: "transparent",
});

export interface WordmarkProps {
  theme: BrandTheme;
  /** px height of the primary line */
  size: number;
  /** 0..1 reveal progress (1 = static) */
  reveal?: number;
  /** horizontal shimmer position 0..1 */
  shimmer?: number;
  showSecondary?: boolean;
  align?: "center" | "left" | "right";
}

/**
 * Channel wordmarks. Each channel has its own typographic identity; never mix.
 * Latin wordmarks are brand marks, so tracking is allowed here (Persian text never gets letter-spacing).
 */
export const Wordmark: React.FC<WordmarkProps> = ({ theme, size, reveal = 1, shimmer, showSecondary = true, align = "center" }) => {
  const p = theme.palette;
  const id = theme.id;
  const sh = shimmer ?? -1;
  const shimmerLayer = (fill: string) =>
    sh >= 0
      ? `linear-gradient(105deg, transparent ${sh * 140 - 30}%, rgba(255,255,255,0.85) ${sh * 140 - 20}%, transparent ${sh * 140 - 10}%), ${fill}`
      : fill;
  const blurPx = (1 - reveal) * 16;
  const op = interpolate(reveal, [0, 0.6], [0, 1], clamp);
  const common: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : align === "left" ? "flex-start" : "flex-end", opacity: op, filter: blurPx > 0.1 ? `blur(${blurPx}px)` : undefined };

  if (id === "pianova") {
    return (
      <div data-amf-layer="logo" data-amf-text={`${theme.wordmark.primary} ${theme.wordmark.secondary}`} style={common}>
        <div style={{ fontFamily: "Cinzel", fontWeight: 600, fontSize: size, lineHeight: 1, letterSpacing: size * 0.12, paddingLeft: size * 0.12, ...textFill(shimmerLayer(goldFill(p.accent))), filter: `drop-shadow(0 ${size * 0.03}px ${size * 0.02}px rgba(0,0,0,0.6)) drop-shadow(0 0 ${size * 0.25}px ${hexA(p.accent, 0.25)})` }}>
          {theme.wordmark.primary}
        </div>
        {showSecondary && (
          <div style={{ marginTop: size * 0.22, display: "flex", alignItems: "center", gap: size * 0.18 }}>
            <div style={{ width: size * 0.9 * reveal, height: Math.max(1, size * 0.012), background: p.accent, opacity: 0.8 }} />
            <div style={{ fontFamily: "CormorantGaramond", fontWeight: 500, fontSize: size * 0.2, letterSpacing: size * 0.07, paddingLeft: size * 0.07, color: p.primary }}>{theme.wordmark.secondary}</div>
            <div style={{ width: size * 0.9 * reveal, height: Math.max(1, size * 0.012), background: p.accent, opacity: 0.8 }} />
          </div>
        )}
      </div>
    );
  }
  if (id === "musicradio69") {
    const [a, b] = splitLast(theme.wordmark.primary);
    return (
      <div data-amf-layer="logo" data-amf-text={`${theme.wordmark.primary} ${theme.wordmark.secondary}`} style={common}>
        <div style={{ display: "flex", alignItems: "baseline", gap: size * 0.22 }}>
          <span style={{ fontFamily: "Michroma", fontSize: size * 0.62, lineHeight: 1, letterSpacing: size * 0.08, ...textFill(shimmerLayer(chromeFill)), filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.8))" }}>{a}</span>
          <span style={{ fontFamily: "Orbitron", fontWeight: 900, fontSize: size * 1.05, lineHeight: 1, ...textFill(shimmerLayer(goldFill(p.accent, "#FFF4C2", "#6B4E12"))), filter: `drop-shadow(0 0 ${size * 0.2}px ${hexA(p.accent, 0.45)})` }}>{b}</span>
        </div>
        {showSecondary && (
          <div style={{ marginTop: size * 0.16, fontFamily: "Montserrat", fontWeight: 600, fontSize: size * 0.19, letterSpacing: size * 0.12, paddingLeft: size * 0.12, color: p.accent }}>{theme.wordmark.secondary}</div>
        )}
      </div>
    );
  }
  if (id === "onehandonedream") {
    return (
      <div data-amf-layer="logo" data-amf-text={`${theme.wordmark.primary} ${theme.wordmark.secondary}`} style={common}>
        <div style={{ fontFamily: "PlayfairDisplay", fontWeight: 700, fontStyle: "normal", fontSize: size * 0.8, lineHeight: 1.05, letterSpacing: size * 0.02, ...textFill(shimmerLayer(goldFill(p.accent, "#FBE7B5", "#6E4F1C"))), filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.7))" }}>
          {theme.wordmark.primary}
        </div>
        {showSecondary && (
          <div style={{ marginTop: size * 0.2, display: "flex", alignItems: "center", gap: size * 0.16 }}>
            <div style={{ width: size * 0.14, height: size * 0.14, borderRadius: "50%", background: p.accent2 ?? p.accent, boxShadow: `0 0 ${size * 0.2}px ${hexA(p.accent2 ?? p.accent, 0.7)}` }} />
            <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: size * 0.18, letterSpacing: size * 0.14, paddingLeft: size * 0.14, color: p.textMuted }}>{theme.wordmark.secondary}</div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div data-amf-layer="logo" data-amf-text={`${theme.wordmark.primary} ${theme.wordmark.secondary}`} style={common}>
      <div style={{ display: "flex", alignItems: "center", gap: size * 0.2 }}>
        <div style={{ width: size * 0.7, height: size * 0.7, borderRadius: size * 0.18, background: `linear-gradient(135deg, ${p.accent}, ${p.accent2 ?? p.accent})` }} />
        <div style={{ fontFamily: "Inter", fontWeight: 800, fontSize: size * 0.7, lineHeight: 1, color: p.primary }}>{theme.wordmark.primary}</div>
      </div>
      {showSecondary && <div style={{ marginTop: size * 0.12, fontFamily: "Inter", fontWeight: 500, fontSize: size * 0.2, letterSpacing: size * 0.18, paddingLeft: size * 0.18, color: p.textMuted }}>{theme.wordmark.secondary}</div>}
    </div>
  );
};

const splitLast = (s: string): [string, string] => {
  const i = s.lastIndexOf(" ");
  return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + 1)];
};

/** Small corner watermark (logo layer). */
export const Watermark: React.FC<{ theme: BrandTheme; x: number; y: number; h: number; opacity?: number }> = ({ theme, x, y, h, opacity = 0.75 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 10, fps, config: { damping: 200 } });
  return (
    <div style={{ position: "absolute", left: x, top: y, height: h, display: "flex", alignItems: "center", opacity: opacity * s }}>
      <Wordmark theme={theme} size={h * 0.62} showSecondary={false} align="left" />
    </div>
  );
};

export const useReveal = (start: number, dur: number) => {
  const f = useCurrentFrame();
  return interpolate(f, [start, start + dur], [0, 1], { ...clamp, easing: bez([0.16, 1, 0.3, 1]) });
};
