import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { BrandTheme, Format, MotionStyle, PlannedScene } from "@amf/pipeline/core";
import { toPersianDigits } from "@amf/pipeline/core";
import { Camera, EffectsOverlay, KineticText, StyleBackground, bez, clamp, gradeFilter, hexA, isRtlText, useGateWeave, useJitter, type TextPreset } from "@amf/styles";
import { CtaBadge, LowerThird, QuoteCard, SourceBadge, getLayout, goldFill, COPY } from "@amf/templates";
import { DataViz, Icon, ImageFrame, PianoVisual, SpectrumBars } from "../visuals/visuals";

export interface SceneViewProps {
  ps: PlannedScene;
  theme: BrandTheme;
  style: MotionStyle;
  format: Format;
  /** Frames this scene is on screen (incl. outgoing transition tail). */
  durationInFrames: number;
  stepNumber?: number;
  spectrum?: number[];
  energy?: number;
  /** Background + effects only (template previews). */
  bgOnly?: boolean;
}

const easeOut = bez([0.16, 1, 0.3, 1]);

/** Title/body text props shared by all layouts. */
function useTextKit(theme: BrandTheme, style: MotionStyle, format: Format) {
  const L = getLayout(format);
  const p = theme.palette;
  const luxe = style.id === "cinematicLuxury" || style.id === "lightLeakFilm" || style.id === "parallaxDepth";
  const font = (t: string) => (isRtlText(t) ? theme.fonts.headingFa : theme.fonts.titleLatin);
  const bodyFont = (t: string) => (isRtlText(t) ? theme.fonts.bodyFa : theme.fonts.bodyLatin);
  const preset = (i: number): TextPreset => style.textPresets[Math.min(i, style.textPresets.length - 1)]!;
  return { L, p, luxe, font, bodyFont, preset };
}

export const SceneView: React.FC<SceneViewProps> = (props) => {
  const { ps, theme, style, format, durationInFrames, spectrum, energy } = props;
  const seed = ps.scene.id;
  const weave = useGateWeave(seed, style.effects.includes("gateWeave"));
  const jitter = useJitter(seed, style.effects.includes("jitter"));
  const s = ps.scene;
  const kind = s.quote || s.sceneType === "quote" ? "quote" : s.chart ? "chart" : s.sceneType;
  let body: React.ReactNode;
  switch (kind) {
    case "hook":
    case "headline":
    case "intro":
      body = <HeroLayout {...props} />;
      break;
    case "step":
      body = <StepLayout {...props} />;
      break;
    case "recap":
      body = <RecapLayout {...props} />;
      break;
    case "chart":
      body = <ChartLayout {...props} />;
      break;
    case "quote":
      body = <QuoteLayout {...props} />;
      break;
    case "cta":
    case "offer":
      body = <CtaLayout {...props} />;
      break;
    default:
      body = <SplitLayout {...props} />;
  }
  return (
    <AbsoluteFill style={{ transform: weave !== "none" ? weave : jitter !== "none" ? jitter : undefined }}>
      <AbsoluteFill style={{ filter: gradeFilter(style) }}>
        <Camera style={style} seed={seed} durationInFrames={durationInFrames} strength={0.6}>
          <StyleBackground style={style} theme={theme} seed={seed} energy={energy} spectrum={spectrum} />
          {ps.imageSrc && (kind === "hook" || kind === "headline") && (
            <AbsoluteFill style={{ opacity: 0.55 }}>
              <ImageFrame src={ps.imageSrc} w={getLayout(format).width} h={getLayout(format).height} theme={theme} durationInFrames={durationInFrames} seed={seed} full />
              <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 70% at 50% 45%, ${hexA(theme.palette.bg, 0.35)}, ${hexA(theme.palette.bg, 0.92)})` }} />
            </AbsoluteFill>
          )}
        </Camera>
        <EffectsOverlay style={style} theme={theme} seed={seed} />
      </AbsoluteFill>
      {!props.bgOnly && body}
      {!props.bgOnly && s.lowerThird && <LowerThirdSlot {...props} />}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */

const LowerThirdSlot: React.FC<SceneViewProps> = ({ ps, theme, format, durationInFrames }) => {
  const z = getLayout(format).zones.lowerThird!.rect;
  return <LowerThird theme={theme} title={ps.scene.lowerThird!.title} subtitle={ps.scene.lowerThird!.subtitle} x={z.x} y={z.y} w={z.w} h={z.h} inFrame={14} outFrame={Math.min(durationInFrames - 4, 14 + 150)} />;
};

/** Visual slot: flux image > piano > spectrum > icons. */
const VisualSlot: React.FC<SceneViewProps & { w: number; h: number }> = ({ ps, theme, w, h, durationInFrames, spectrum, style }) => {
  const s = ps.scene;
  if (ps.imageSrc) return <ImageFrame src={ps.imageSrc} w={w} h={h} theme={theme} durationInFrames={durationInFrames} seed={s.id} />;
  if (s.pianoNotes || ((theme.id === "pianova" || theme.id === "onehandonedream") && s.icons.length === 0)) return <PianoVisual w={w} h={h} theme={theme} notes={s.pianoNotes} />;
  if (style.audioReactive && spectrum) return <SpectrumBars w={w} h={h * 0.8} bins={spectrum.slice(0, 32)} theme={theme} />;
  const icons = s.icons.length ? s.icons : ["star"];
  return (
    <div style={{ width: w, height: h, display: "flex", alignItems: "center", justifyContent: "center", gap: w * 0.06 }}>
      {icons.slice(0, 3).map((n, i) => (
        <IconBubble key={n + i} name={n} size={Math.min(h * 0.6, w / Math.min(icons.length, 3) - 40)} theme={theme} delay={6 + i * 6} />
      ))}
    </div>
  );
};

const IconBubble: React.FC<{ name: string; size: number; theme: BrandTheme; delay: number }> = ({ name, size, theme, delay }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 13, stiffness: 150, mass: 0.7 } });
  const float = Math.sin((f + delay * 7) / 30) * 6;
  const p = theme.palette;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transform: `translateY(${float}px) scale(${s})`, background: `radial-gradient(circle at 35% 30%, ${hexA(p.accent, 0.28)}, ${hexA(p.bgAlt, 0.9)} 70%)`, boxShadow: `0 20px 60px rgba(0,0,0,0.45), inset 0 0 0 2px ${hexA(p.accent, 0.5)}` }}>
      <Icon name={name} size={size * 0.5} color={p.accent} delay={delay + 4} />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Hero (hook / headline)                                              */
/* ------------------------------------------------------------------ */
const HeroLayout: React.FC<SceneViewProps> = (props) => {
  const { ps, theme, style, format } = props;
  const { L, p, luxe, font, bodyFont, preset } = useTextKit(theme, style, format);
  const [t0, t1, t2] = ps.scene.onScreenText;
  const z = L.zones.title!.rect;
  const b = L.zones.body!.rect;
  const f = useCurrentFrame();
  const line = interpolate(f, [10, 34], [0, 1], { ...clamp, easing: bez([0.65, 0, 0.35, 1]) });
  return (
    <AbsoluteFill>
      {t0 && (
        <div style={{ position: "absolute", left: z.x, top: z.y, width: z.w, height: z.h, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <KineticText id={`${ps.scene.id}-t0`} text={t0} preset={preset(0)} startFrame={4} fontFamily={font(t0)} fontWeight={800} color={p.text} accent={p.accent} maxWidth={z.w} maxLines={2} minSize={L.title.min * 0.8} maxSize={L.title.max} lineHeight={1.3} align="center" springConfig={style.spring} emphasis={ps.scene.emphasis} gradient={luxe ? goldFill(p.accent, "#FFF6DD", p.accent2 ?? "#7A5A22") : undefined} shadow={luxe ? undefined : "0 8px 40px rgba(0,0,0,0.5)"} />
        </div>
      )}
      <div style={{ position: "absolute", left: L.width / 2 - (L.width * 0.18 * line) / 2, top: z.y + z.h + 4, width: L.width * 0.18 * line, height: 3, borderRadius: 2, background: p.accent }} />
      {t1 && (
        <div style={{ position: "absolute", left: b.x, top: b.y + 14, width: b.w, display: "flex", justifyContent: "center" }}>
          <KineticText id={`${ps.scene.id}-t1`} text={t1} preset={preset(1)} startFrame={18} fontFamily={bodyFont(t1)} fontWeight={500} color={p.textMuted} accent={p.accent} maxWidth={b.w} maxLines={2} minSize={L.body.size * 0.85} maxSize={L.body.size} lineHeight={1.45} align="center" springConfig={style.spring} />
        </div>
      )}
      {t2 && format === "landscape_16x9" && (
        <div style={{ position: "absolute", left: b.x, top: b.y + 90, width: b.w, display: "flex", justifyContent: "center" }}>
          <KineticText id={`${ps.scene.id}-t2`} text={t2} preset="fadeUp" startFrame={30} fontFamily={bodyFont(t2)} fontWeight={500} color={p.textMuted} accent={p.accent} maxWidth={b.w} maxLines={1} minSize={34} maxSize={40} lineHeight={1.45} align="center" springConfig={style.spring} />
        </div>
      )}
      {ps.scene.sources.length > 0 && <SourceSlot {...props} />}
    </AbsoluteFill>
  );
};

const SourceSlot: React.FC<SceneViewProps> = ({ ps, theme, format }) => {
  const L = getLayout(format);
  const r = L.zones.lowerThird!.rect;
  // right-anchored inside the safe area, sitting in the lower-third zone
  return <SourceBadge theme={theme} sources={ps.scene.sources} x={L.width - r.x - r.w} y={r.y + 18} maxW={r.w} />;
};

/* ------------------------------------------------------------------ */
/* Split: text on the right (reading start), visual on the left        */
/* ------------------------------------------------------------------ */
const SplitLayout: React.FC<SceneViewProps> = (props) => {
  const { ps, theme, style, format } = props;
  const { L, p, font, bodyFont, preset } = useTextKit(theme, style, format);
  const [t0, ...rest] = ps.scene.onScreenText;
  const portrait = format === "shorts_9x16";
  const tz = portrait ? L.zones.title!.rect : L.zones.sideText!.rect;
  const vz = L.zones.visual!.rect;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: vz.x, top: vz.y, width: vz.w, height: vz.h }}>
        <VisualSlot {...props} w={vz.w} h={vz.h} />
      </div>
      <div dir="rtl" style={{ position: "absolute", left: tz.x, top: tz.y, width: tz.w, height: tz.h, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: portrait ? "center" : "flex-start", gap: 20 }}>
        {t0 && <KineticText id={`${ps.scene.id}-t0`} text={t0} preset={preset(0)} startFrame={6} fontFamily={font(t0)} fontWeight={800} color={p.text} accent={p.accent} maxWidth={tz.w} maxLines={portrait ? 3 : 2} minSize={portrait ? 70 : 72} maxSize={portrait ? 104 : 104} lineHeight={1.35} align={portrait ? "center" : "start"} springConfig={style.spring} emphasis={ps.scene.emphasis} />}
        {!portrait &&
          rest.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, transform: "rotate(45deg)", background: p.accent, flex: "none" }} />
              <KineticText id={`${ps.scene.id}-t${i + 1}`} text={t} preset={preset(1)} startFrame={22 + i * 12} fontFamily={bodyFont(t)} fontWeight={500} color={p.textMuted} accent={p.accent} maxWidth={tz.w - 30} maxLines={2} minSize={40} maxSize={L.body.size} lineHeight={1.45} align="start" springConfig={style.spring} />
            </div>
          ))}
      </div>
      {ps.scene.sources.length > 0 && <SourceSlot {...props} />}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Step: Persian digit badge + title                                   */
/* ------------------------------------------------------------------ */
const StepLayout: React.FC<SceneViewProps> = (props) => {
  const { ps, theme, style, format, stepNumber = 1 } = props;
  const { L, p, font, bodyFont, preset } = useTextKit(theme, style, format);
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = format === "shorts_9x16";
  const [t0, t1] = ps.scene.onScreenText;
  const badge = spring({ frame: f - 2, fps, config: { damping: 12, stiffness: 140, mass: 0.8 } });
  const ring = interpolate(f, [2, 30], [0, 1], { ...clamp, easing: easeOut });
  const tz = portrait ? L.zones.title!.rect : L.zones.sideText!.rect;
  const vz = L.zones.visual!.rect;
  const B = portrait ? 120 : 132;
  const digit = toPersianDigits(String(stepNumber));
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: vz.x, top: vz.y, width: vz.w, height: vz.h }}>
        <VisualSlot {...props} w={vz.w} h={vz.h} />
      </div>
      <div dir="rtl" style={{ position: "absolute", left: tz.x, top: tz.y, width: tz.w, height: tz.h, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: portrait ? "center" : "flex-start", gap: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div data-amf-layer="typography" data-amf-id={`${ps.scene.id}-num`} data-amf-text={digit} style={{ width: B, height: B, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${badge})`, background: `radial-gradient(circle at 35% 30%, ${hexA(p.accent, 0.35)}, ${p.bgAlt})`, boxShadow: `0 0 0 ${3 + 6 * (1 - ring)}px ${hexA(p.accent, ring)}, 0 16px 40px rgba(0,0,0,0.5)` }}>
            <span style={{ fontFamily: theme.fonts.headingFa, fontWeight: 900, fontSize: B * 0.58, lineHeight: 1, marginTop: B * 0.08, fontVariantNumeric: "tabular-nums", backgroundImage: goldFill(p.accent), backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent" }}>{digit}</span>
          </div>
        </div>
        {t0 && <KineticText id={`${ps.scene.id}-t0`} text={t0} preset={preset(0)} startFrame={10} fontFamily={font(t0)} fontWeight={800} color={p.text} accent={p.accent} maxWidth={tz.w} maxLines={2} minSize={portrait ? 66 : 68} maxSize={portrait ? 96 : 96} lineHeight={1.35} align={portrait ? "center" : "start"} springConfig={style.spring} emphasis={ps.scene.emphasis} />}
        {t1 && !portrait && <KineticText id={`${ps.scene.id}-t1`} text={t1} preset={preset(1)} startFrame={24} fontFamily={bodyFont(t1)} fontWeight={500} color={p.textMuted} accent={p.accent} maxWidth={tz.w} maxLines={2} minSize={40} maxSize={L.body.size} lineHeight={1.45} align="start" springConfig={style.spring} />}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Recap: animated checklist                                           */
/* ------------------------------------------------------------------ */
const RecapLayout: React.FC<SceneViewProps> = (props) => {
  const { ps, theme, style, format } = props;
  const { L, p, bodyFont } = useTextKit(theme, style, format);
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = format === "shorts_9x16";
  const z = portrait ? { x: L.safe.x, y: 372, w: L.safe.w, h: 640 } : { x: 360, y: 190, w: 1200, h: 490 };
  const items = ps.scene.onScreenText;
  const gap = Math.round(fps * 0.6);
  return (
    <AbsoluteFill>
      <div dir="rtl" style={{ position: "absolute", left: z.x, top: z.y, width: z.w, height: z.h, display: "flex", flexDirection: "column", justifyContent: "center", gap: portrait ? 34 : 30 }}>
        {items.map((t, i) => {
          const d = 6 + i * gap;
          const s = spring({ frame: f - d, fps, config: style.spring });
          const ck = interpolate(f, [d + 6, d + 18], [0, 1], { ...clamp, easing: easeOut });
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 26, opacity: interpolate(s, [0, 0.3], [0, 1], clamp), transform: `translateX(${(1 - s) * -40}px)`, padding: "14px 28px", borderRadius: 20, background: hexA(p.bgAlt, 0.55), boxShadow: `inset 0 0 0 1.5px ${hexA(p.accent, 0.35)}` }}>
              <svg width={56} height={56} viewBox="0 0 24 24" style={{ flex: "none" }}>
                <circle cx="12" cy="12" r="10.5" fill={hexA(p.accent, 0.18)} stroke={p.accent} strokeWidth="1.4" />
                <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke={p.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="16" strokeDashoffset={16 * (1 - ck)} />
              </svg>
              <KineticText id={`${ps.scene.id}-t${i}`} text={t} preset="cutIn" startFrame={d} fontFamily={bodyFont(t)} fontWeight={700} color={p.text} accent={p.accent} maxWidth={z.w - 140} maxLines={2} minSize={portrait ? 48 : 48} maxSize={portrait ? 60 : 60} lineHeight={1.4} align="start" springConfig={style.spring} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Chart                                                              */
/* ------------------------------------------------------------------ */
const ChartLayout: React.FC<SceneViewProps> = (props) => {
  const { ps, theme, style, format } = props;
  const { L, p, font } = useTextKit(theme, style, format);
  const portrait = format === "shorts_9x16";
  const [t0] = ps.scene.onScreenText;
  const tz = portrait ? L.zones.title!.rect : { x: 192, y: 150, w: 1536, h: 150 };
  const cz = portrait ? { x: L.safe.x, y: 712, w: L.safe.w, h: 300 } : { x: 260, y: 310, w: 1400, h: 400 };
  return (
    <AbsoluteFill>
      {t0 && (
        <div style={{ position: "absolute", left: tz.x, top: tz.y, width: tz.w, height: tz.h, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <KineticText id={`${ps.scene.id}-t0`} text={t0} preset={style.textPresets[0]!} startFrame={4} fontFamily={font(t0)} fontWeight={800} color={p.text} accent={p.accent} maxWidth={tz.w} maxLines={portrait ? 3 : 1} minSize={60} maxSize={portrait ? 96 : 84} lineHeight={1.35} align="center" springConfig={style.spring} emphasis={ps.scene.emphasis} />
        </div>
      )}
      <div style={{ position: "absolute", left: cz.x, top: cz.y, width: cz.w, height: cz.h }}>
        <DataViz chart={ps.scene.chart!} w={cz.w} h={cz.h} theme={theme} style={style} font={theme.fonts.bodyFa} />
      </div>
      {ps.scene.sources.length > 0 && <SourceSlot {...props} />}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
const QuoteLayout: React.FC<SceneViewProps> = ({ ps, theme }) => {
  const q = ps.scene.quote ?? { text: ps.scene.onScreenText[0] ?? "", author: ps.scene.onScreenText[1] };
  return <QuoteCard theme={theme} quote={q.text} author={q.author} startFrame={4} />;
};

const CtaLayout: React.FC<SceneViewProps> = (props) => {
  const { ps, theme, style, format } = props;
  const { L, p, font, bodyFont, preset } = useTextKit(theme, style, format);
  const [t0, t1] = ps.scene.onScreenText;
  const z = L.zones.title!.rect;
  const b = L.zones.body!.rect;
  const portrait = format === "shorts_9x16";
  return (
    <AbsoluteFill>
      {t0 && (
        <div style={{ position: "absolute", left: z.x, top: z.y, width: z.w, height: z.h, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <KineticText id={`${ps.scene.id}-t0`} text={t0} preset={preset(0)} startFrame={4} fontFamily={font(t0)} fontWeight={800} color={p.text} accent={p.accent} maxWidth={z.w} maxLines={2} minSize={portrait ? 70 : 84} maxSize={portrait ? 110 : 130} lineHeight={1.3} align="center" springConfig={style.spring} emphasis={ps.scene.emphasis} />
        </div>
      )}
      {t1 && !portrait && (
        <div style={{ position: "absolute", left: b.x, top: b.y - 10, width: b.w, display: "flex", justifyContent: "center" }}>
          <KineticText id={`${ps.scene.id}-t1`} text={t1} preset={preset(1)} startFrame={16} fontFamily={bodyFont(t1)} fontWeight={500} color={p.textMuted} accent={p.accent} maxWidth={b.w} maxLines={1} minSize={36} maxSize={L.body.size} lineHeight={1.45} align="center" springConfig={style.spring} />
        </div>
      )}
      <CtaBadge theme={theme} text={COPY[theme.id].subscribe} x={L.width / 2} y={portrait ? 870 : b.y + 100} scale={portrait ? 1.1 : 1} inFrame={20} />
    </AbsoluteFill>
  );
};
