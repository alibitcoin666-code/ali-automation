import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { BrandTheme, SourceRef } from "@amf/pipeline/core";
import { toPersianDigits } from "@amf/pipeline/core";
import { bez, clamp, Grain, hexA, LightSweep, Vignette, KineticText } from "@amf/styles";
import { Wordmark, goldFill } from "./wordmark";
import { getLayout, YT_END_SCREEN_16x9 } from "./zones";

const fa = (extra: React.CSSProperties = {}): React.CSSProperties => ({ direction: "rtl", letterSpacing: 0, whiteSpace: "pre", ...extra });
const easeOut = bez([0.16, 1, 0.3, 1]);

/* ------------------------------------------------------------------ */
/* Lower third                                                         */
/* ------------------------------------------------------------------ */
export const LowerThird: React.FC<{ theme: BrandTheme; title: string; subtitle?: string; x: number; y: number; w: number; h: number; inFrame?: number; outFrame?: number }> = ({ theme, title, subtitle, x, y, w, h, inFrame = 0, outFrame }) => {
  const f = useCurrentFrame();
  const p = theme.palette;
  const t = interpolate(f, [inFrame, inFrame + 16], [0, 1], { ...clamp, easing: easeOut });
  const o = outFrame != null ? interpolate(f, [outFrame - 10, outFrame], [1, 0], clamp) : 1;
  const bar = interpolate(f, [inFrame, inFrame + 12], [0, 1], { ...clamp, easing: easeOut });
  return (
    <div data-amf-layer="lowerThird" data-amf-text={subtitle ? `${title} ${subtitle}` : title} dir="rtl" lang="fa" style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: o, display: "flex", flexDirection: "row", alignItems: "stretch" }}>
      <div style={{ width: 6, background: goldFill(p.accent), transform: `scaleY(${bar})`, borderRadius: 3 }} />
      <div style={{ flex: "0 1 auto", minWidth: w * 0.45, clipPath: `inset(0 0 0 ${(1 - t) * 100}%)`, background: `linear-gradient(270deg, ${hexA(p.bg, 0.88)}, ${hexA(p.bgAlt, 0.55)} 85%, transparent)`, padding: `0 ${h * 0.28}px`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={fa({ fontFamily: theme.fonts.headingFa, fontWeight: 700, fontSize: h * 0.4, lineHeight: 1.3, color: p.text })}>{title}</div>
        {subtitle && <div style={fa({ fontFamily: theme.fonts.bodyFa, fontWeight: 500, fontSize: h * 0.26, lineHeight: 1.35, color: p.accent })}>{subtitle}</div>}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Chapter card                                                        */
/* ------------------------------------------------------------------ */
export const ChapterCard: React.FC<{ theme: BrandTheme; index: number; title: string; durationInFrames: number }> = ({ theme, index, title, durationInFrames }) => {
  const f = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const p = theme.palette;
  const L = getLayout(height > width ? "shorts_9x16" : "landscape_16x9");
  const num = spring({ frame: f, fps, config: { damping: 200, stiffness: 90 } });
  const line = interpolate(f, [6, 26], [0, 1], { ...clamp, easing: bez([0.65, 0, 0.35, 1]) });
  const out = interpolate(f, [durationInFrames - 10, durationInFrames], [1, 0], clamp);
  const label = `بخش ${toPersianDigits(String(index))}`;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 60% at 50% 45%, ${p.bgAlt}, ${p.bg})`, opacity: out, alignItems: "center", justifyContent: "center" }}>
      <div data-amf-layer="typography" data-amf-text={label} dir="rtl" lang="fa" style={fa({ fontFamily: theme.fonts.headingFa, fontWeight: 800, fontSize: L.title.max * 1.15, lineHeight: 1.2, opacity: num, transform: `translateY(${(1 - num) * 40}px)`, backgroundImage: goldFill(p.accent), backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent" })}>
        {label}
      </div>
      <div style={{ width: L.width * 0.3 * line, height: 3, background: p.accent, margin: "28px 0" }} />
      <KineticText id="chapter-title" text={title} preset="fadeUp" startFrame={10} fontFamily={theme.fonts.headingFa} fontWeight={700} color={p.text} accent={p.accent} maxWidth={L.safe.w} maxLines={2} minSize={L.body.size} maxSize={L.title.min * 0.7} lineHeight={1.4} align="center" springConfig={{ damping: 200, stiffness: 80, mass: 1 }} />
      <LightSweep color={p.accent} period={Math.max(durationInFrames, 60)} offset={0} strength={0.18} />
      <Vignette amount={0.5} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* CTA (subscribe pill + bell)                                         */
/* ------------------------------------------------------------------ */
export const CtaBadge: React.FC<{ theme: BrandTheme; text: string; x: number; y: number; scale?: number; inFrame?: number }> = ({ theme, text, x, y, scale = 1, inFrame = 0 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = theme.palette;
  const s = spring({ frame: f - inFrame, fps, config: { damping: 12, stiffness: 160, mass: 0.7 } });
  const press = spring({ frame: f - inFrame - 30, fps, config: { damping: 10, stiffness: 300, mass: 0.4 } });
  const pressed = f > inFrame + 30;
  const bell = pressed ? Math.sin((f - inFrame - 30) / 2.2) * 18 * Math.exp(-(f - inFrame - 30) / 14) : 0;
  return (
    <div data-amf-layer="typography" data-amf-text={text} dir="rtl" lang="fa" style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${scale * s * (1 - 0.06 * interpolate(press, [0, 0.5, 1], [0, 1, 0]))})`, display: "flex", alignItems: "center", gap: 22 * scale }}>
      <div style={fa({ padding: `${16 * scale}px ${40 * scale}px`, borderRadius: 999, background: pressed ? "#2a2a2a" : "#E62117", color: "#fff", fontFamily: theme.fonts.headingFa, fontWeight: 800, fontSize: 44 * scale, lineHeight: 1.35, boxShadow: `0 10px 30px rgba(0,0,0,0.45), 0 0 0 2px ${hexA(p.accent, 0.5)}` })}>{text}</div>
      <svg width={64 * scale} height={64 * scale} viewBox="0 0 24 24" style={{ transform: `rotate(${bell}deg)`, transformOrigin: "50% 10%" }}>
        <path fill={p.accent} d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z" />
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Quote card                                                          */
/* ------------------------------------------------------------------ */
export const QuoteCard: React.FC<{ theme: BrandTheme; quote: string; author?: string; startFrame?: number }> = ({ theme, quote, author, startFrame = 0 }) => {
  const { width, height } = useVideoConfig();
  const f = useCurrentFrame();
  const p = theme.palette;
  const L = getLayout(height > width ? "shorts_9x16" : "landscape_16x9");
  const z = L.zones.title!.rect;
  const a = interpolate(f, [startFrame + 20, startFrame + 40], [0, 1], { ...clamp, easing: easeOut });
  return (
    <div style={{ position: "absolute", left: z.x, top: z.y, width: z.w, height: z.h + (L.zones.body?.rect.h ?? 0), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "PlayfairDisplay", fontSize: 180, lineHeight: 0.6, height: 80, color: hexA(p.accent, 0.7) }}>“</div>
      <KineticText id="quote" text={quote} preset="blurIn" startFrame={startFrame} fontFamily={theme.fonts.displayFa ?? theme.fonts.headingFa} fontWeight={600} color={p.text} accent={p.accent} maxWidth={z.w * 0.92} maxLines={3} minSize={L.body.size} maxSize={L.title.min * 0.62} lineHeight={1.5} align="center" springConfig={{ damping: 200, stiffness: 70, mass: 1 }} stagger={3} />
      {author && (
        <div data-amf-layer="typography" data-amf-text={author} dir="rtl" lang="fa" style={fa({ marginTop: 24, opacity: a, fontFamily: theme.fonts.bodyFa, fontWeight: 500, fontSize: L.body.size * 0.8, color: p.accent })}>
          {author}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Progress bar (fills right-to-left for Persian)                     */
/* ------------------------------------------------------------------ */
export const ProgressBar: React.FC<{ theme: BrandTheme; x: number; y: number; w: number; h: number; from: number; to: number; marks?: number[] }> = ({ theme, x, y, w, h, from, to, marks = [] }) => {
  const f = useCurrentFrame();
  const p = theme.palette;
  const t = interpolate(f, [from, to], [0, 1], clamp);
  return (
    <div data-amf-layer="logo" style={{ position: "absolute", left: x, top: y, width: w, height: h, background: hexA(p.text, 0.12) }}>
      <div style={{ position: "absolute", right: 0, top: 0, height: h, width: w * t, background: goldFill(p.accent), boxShadow: `0 0 12px ${hexA(p.accent, 0.6)}` }} />
      {marks.map((m, i) => (
        <div key={i} style={{ position: "absolute", right: w * interpolate(m, [from, to], [0, 1], clamp) - 1, top: 0, width: 2, height: h, background: p.bg }} />
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Source badge (NEWS facts)                                           */
/* ------------------------------------------------------------------ */
export const SourceBadge: React.FC<{ theme: BrandTheme; sources: SourceRef[]; x: number; y: number; maxW: number; inFrame?: number }> = ({ theme, sources, x, y, maxW, inFrame = 8 }) => {
  const f = useCurrentFrame();
  const p = theme.palette;
  const t = interpolate(f, [inFrame, inFrame + 12], [0, 1], { ...clamp, easing: easeOut });
  if (!sources.length) return null;
  const label = `منبع: ${sources.map((s) => s.label).join("، ")}`;
  return (
    <div data-amf-layer="typography" data-amf-text={label} dir="rtl" lang="fa" style={{ position: "absolute", right: x, top: y, maxWidth: maxW, opacity: t, transform: `translateY(${(1 - t) * 10}px)`, display: "flex", alignItems: "center", gap: 12, padding: "8px 18px", borderRadius: 10, background: hexA(p.bg, 0.75), border: `1px solid ${hexA(p.accent, 0.5)}` }}>
      <svg width="26" height="26" viewBox="0 0 24 24"><path fill={p.accent} d="M10.6 13.4a1 1 0 0 0 1.4 1.4l4.6-4.6a3 3 0 0 0-4.2-4.2l-2 2a1 1 0 0 0 1.4 1.4l2-2a1 1 0 0 1 1.4 1.4l-4.6 4.6Zm2.8-2.8a1 1 0 0 0-1.4-1.4l-4.6 4.6a3 3 0 0 0 4.2 4.2l2-2a1 1 0 0 0-1.4-1.4l-2 2a1 1 0 0 1-1.4-1.4l4.6-4.6Z" /></svg>
      <div style={fa({ fontFamily: theme.fonts.bodyFa, fontWeight: 600, fontSize: 30, lineHeight: 1.4, color: p.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" })}>{label}</div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Series card                                                         */
/* ------------------------------------------------------------------ */
export const SeriesCard: React.FC<{ theme: BrandTheme; series: string; episode: number; title: string; durationInFrames: number }> = ({ theme, series, episode, title, durationInFrames }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = theme.palette;
  const L = getLayout(height > width ? "shorts_9x16" : "landscape_16x9");
  const t = interpolate(f, [0, 18], [0, 1], { ...clamp, easing: easeOut });
  const out = interpolate(f, [durationInFrames - 10, durationInFrames], [1, 0], clamp);
  const ep = `قسمت ${toPersianDigits(String(episode))}`;
  return (
    <AbsoluteFill style={{ background: p.bg, opacity: out, alignItems: "center", justifyContent: "center", gap: 18 }}>
      <div data-amf-layer="typography" data-amf-text={series} dir="rtl" lang="fa" style={fa({ fontFamily: theme.fonts.bodyFa, fontWeight: 600, fontSize: L.body.size, color: p.textMuted, opacity: t })}>{series}</div>
      <div data-amf-layer="typography" data-amf-text={ep} dir="rtl" lang="fa" style={fa({ fontFamily: theme.fonts.headingFa, fontWeight: 900, fontSize: L.title.max, lineHeight: 1.25, backgroundImage: goldFill(p.accent), backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent", transform: `scale(${0.9 + 0.1 * t})` })}>{ep}</div>
      <KineticText id="series-title" text={title} preset="fadeUp" startFrame={12} fontFamily={theme.fonts.headingFa} fontWeight={700} color={p.text} accent={p.accent} maxWidth={L.safe.w} maxLines={2} minSize={L.body.size} maxSize={L.title.min * 0.6} lineHeight={1.4} align="center" springConfig={{ damping: 200, stiffness: 80, mass: 1 }} />
      <Grain amount={0.2} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Outro / end screen (20 s, 16:9) with empty YouTube end-screen zones */
/* ------------------------------------------------------------------ */
export const Outro: React.FC<{ theme: BrandTheme; durationInFrames: number; thanks: string; cta: string }> = ({ theme, durationInFrames, thanks, cta }) => {
  const f = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const p = theme.palette;
  const portrait = height > width;
  const inT = spring({ frame: f, fps, config: { damping: 200, stiffness: 70 } });
  const out = interpolate(f, [durationInFrames - 15, durationInFrames], [1, 0], clamp);
  const breathe = 0.5 + 0.5 * Math.sin(f / 40);
  if (portrait) {
    const L = getLayout("shorts_9x16");
    return (
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${p.bgAlt}, ${p.bg})`, opacity: out }}>
        <div style={{ position: "absolute", left: L.safe.x, top: L.safe.y + 40, width: L.safe.w, display: "flex", flexDirection: "column", alignItems: "center", gap: 50, transform: `translateY(${(1 - inT) * 30}px)`, opacity: inT }}>
          <Wordmark theme={theme} size={96} shimmer={(f % 90) / 90} />
          <KineticText id="outro-thanks" text={thanks} preset="fadeUp" startFrame={8} fontFamily={theme.fonts.headingFa} fontWeight={700} color={p.text} accent={p.accent} maxWidth={L.safe.w} maxLines={2} minSize={46} maxSize={72} lineHeight={1.45} align="center" springConfig={{ damping: 200, stiffness: 80, mass: 1 }} />
        </div>
        <CtaBadge theme={theme} text={cta} x={L.safe.x + L.safe.w / 2} y={L.safe.y + L.safe.h - 120} scale={1.05} inFrame={14} />
        <Grain amount={0.2} />
      </AbsoluteFill>
    );
  }
  const Z = YT_END_SCREEN_16x9;
  const frame = (r: { x: number; y: number; w: number; h: number }, round = false, delay = 0) => {
    const a = interpolate(f, [delay, delay + 20], [0, 1], { ...clamp, easing: easeOut });
    return (
      <div data-amf-layer="endScreen" style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: round ? "50%" : 18, border: `2px solid ${hexA(p.accent, 0.35 + 0.25 * breathe)}`, background: hexA(p.bg, 0.35), transform: `scale(${0.96 + 0.04 * a})`, opacity: a, boxShadow: `0 0 40px ${hexA(p.accent, 0.12)}` }} />
    );
  };
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 70% at 50% 40%, ${p.bgAlt}, ${p.bg})`, opacity: out }}>
      <LightSweep color={p.accent} period={240} offset={30} strength={0.12} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 96, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: inT, transform: `translateY(${(1 - inT) * 24}px)` }}>
        <Wordmark theme={theme} size={74} showSecondary={false} shimmer={(f % 150) / 150} />
        <KineticText id="outro-thanks" text={thanks} preset="fadeUp" startFrame={8} fontFamily={theme.fonts.headingFa} fontWeight={700} color={p.text} accent={p.accent} maxWidth={1400} maxLines={1} minSize={40} maxSize={60} lineHeight={1.45} align="center" springConfig={{ damping: 200, stiffness: 80, mass: 1 }} />
      </div>
      {frame(Z.video1, false, 10)}
      {frame(Z.video2, false, 16)}
      {frame(Z.subscribe, true, 22)}
      <Vignette amount={0.5} />
      <Grain amount={0.2} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Thumbnail (still)                                                   */
/* ------------------------------------------------------------------ */
export const Thumbnail: React.FC<{ theme: BrandTheme; title: string; kicker?: string; imageSrc?: string }> = ({ theme, title, kicker, imageSrc }) => {
  const { width, height } = useVideoConfig();
  const p = theme.palette;
  const portrait = height > width;
  const pad = portrait ? 70 : 64;
  return (
    <AbsoluteFill style={{ background: p.bg }}>
      {imageSrc ? (
        <Img src={/^(https?:|data:|blob:)/.test(imageSrc) ? imageSrc : staticFile(imageSrc.replace(/^\/+/, ""))} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.55) contrast(1.1)" }} />
      ) : (
        <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 80% at 25% 40%, ${hexA(p.accent, 0.35)}, transparent 60%), radial-gradient(ellipse 60% 60% at 80% 80%, ${p.bgAlt}, ${p.bg})` }} />
      )}
      <AbsoluteFill style={{ background: `linear-gradient(270deg, ${hexA(p.bg, 0.92)} 0%, ${hexA(p.bg, 0.55)} 55%, transparent 100%)` }} />
      <div style={{ position: "absolute", right: pad, top: portrait ? 340 : pad, width: (portrait ? width : width * 0.66) - pad * 2, height: portrait ? height - 340 - 700 : height - pad * 2, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end", gap: 20 }}>
        {kicker && (
          <div data-amf-layer="typography" data-amf-text={kicker} dir="rtl" lang="fa" style={fa({ padding: "6px 22px", borderRadius: 10, background: p.accent, color: p.bg, fontFamily: theme.fonts.headingFa, fontWeight: 800, fontSize: portrait ? 56 : 44, lineHeight: 1.4 })}>{kicker}</div>
        )}
        <KineticText id="thumb-title" text={title} preset="cutIn" startFrame={0} fontFamily={theme.fonts.displayFa && theme.id !== "pianova" ? theme.fonts.headingFa : theme.fonts.headingFa} fontWeight={900} color={p.text} accent={p.accent} maxWidth={(portrait ? width : width * 0.66) - pad * 2} maxLines={3} minSize={portrait ? 90 : 72} maxSize={portrait ? 150 : 118} lineHeight={1.3} align="start" springConfig={{ damping: 200, stiffness: 100, mass: 1 }} shadow="0 6px 24px rgba(0,0,0,0.8)" />
      </div>
      <div style={{ position: "absolute", left: pad, bottom: portrait ? 720 : pad * 0.8 }}>
        <Wordmark theme={theme} size={portrait ? 64 : 46} showSecondary={false} align="left" />
      </div>
      <Vignette amount={0.4} />
    </AbsoluteFill>
  );
};
