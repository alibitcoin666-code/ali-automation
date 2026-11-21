import React from "react";
import { AbsoluteFill, Series, useVideoConfig } from "remotion";
import type { Channel, Format, MotionStyleId } from "@amf/pipeline/core";
import { buildCaptions } from "@amf/pipeline/core";
import { getStyle } from "@amf/styles";
import { ChapterCard, CtaBadge, Intro, LowerThird, Outro, ProgressBar, QuoteCard, SeriesCard, Watermark, getLayout, COPY, Thumbnail } from "@amf/templates";
import { getTheme } from "../lib/brands";
import { SceneView } from "../scenes/SceneView";
import { SubtitleLayer } from "../layers/SubtitleLayer";
import { SAMPLE, planned, sampleScene } from "../fixtures/samples";
import "../lib/fonts";

export interface GalleryProps {
  channel: Channel;
  format: Format;
}

const Label: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: "absolute", left: 16, bottom: 12, fontFamily: "Inter", fontSize: 20, color: "#ffffff88", direction: "ltr" }}>{text}</div>
);

/** Synthetic evenly-timed caption page for gallery previews only. */
const demoCaptions = (text: string, fps: number, fromMs: number) => {
  const words = text.split(" ");
  return buildCaptions(
    words.map((w, i) => ({ text: w, scriptWordIndex: i, startMs: fromMs + i * 380, endMs: fromMs + i * 380 + 330 })),
    { fps },
  );
};

export const galleryDuration = (channel: Channel, fps: number) => {
  const t = getTheme(channel);
  return Math.round(fps * (4 + 3 + 2.2 + 3 + 4 + 3 + 3 + 6 + t.allowedStyles.length * 3));
};

export const TemplateGallery: React.FC<GalleryProps> = ({ channel, format }) => {
  const { fps } = useVideoConfig();
  const theme = getTheme(channel);
  const s = SAMPLE[channel];
  const L = getLayout(format);
  const lt = L.zones.lowerThird!.rect;
  const wm = L.zones.watermark!.rect;
  const sec = (x: number) => Math.round(x * fps);
  const bg = (style: MotionStyleId, id: string) => (
    <SceneView ps={planned(sampleScene(id, style, "context", []), sec(3))} theme={theme} style={getStyle(style)} format={format} durationInFrames={sec(3)} bgOnly />
  );
  const capText = "این زیرنویس همگام با صدا کلمه به کلمه روشن می‌شود";
  return (
    <Series>
      <Series.Sequence durationInFrames={sec(4)} name="intro">
        <Intro theme={theme} durationInFrames={sec(4)} />
        <Label text="intro" />
      </Series.Sequence>
      <Series.Sequence durationInFrames={sec(3)} name="lowerThird+caption">
        {bg(theme.allowedStyles[0]!, "g-lt")}
        <LowerThird theme={theme} title={s.lt[0]} subtitle={s.lt[1]} x={lt.x} y={lt.y} w={lt.w} h={lt.h} inFrame={4} />
        <Watermark theme={theme} x={wm.x} y={wm.y} h={wm.h} />
        <SubtitleLayer captions={demoCaptions(capText, fps, 300)} theme={theme} format={format} />
        <Label text="lower-third + caption style + watermark" />
      </Series.Sequence>
      <Series.Sequence durationInFrames={sec(2.2)} name="chapter">
        <ChapterCard theme={theme} index={2} title={s.step} durationInFrames={sec(2.2)} />
        <Label text="chapter card" />
      </Series.Sequence>
      <Series.Sequence durationInFrames={sec(3)} name="cta">
        {bg(theme.allowedStyles[0]!, "g-cta")}
        <CtaBadge theme={theme} text={COPY[channel].subscribe} x={L.width / 2} y={L.height * (format === "shorts_9x16" ? 0.4 : 0.42)} scale={1.2} inFrame={4} />
        <Label text="CTA" />
      </Series.Sequence>
      <Series.Sequence durationInFrames={sec(4)} name="quote">
        {bg(theme.allowedStyles[0]!, "g-q")}
        <QuoteCard theme={theme} quote={s.quote[0]} author={s.quote[1]} />
        <Label text="quote card" />
      </Series.Sequence>
      <Series.Sequence durationInFrames={sec(3)} name="series">
        <SeriesCard theme={theme} series={s.series} episode={3} title={s.title} durationInFrames={sec(3)} />
        <Label text="series card" />
      </Series.Sequence>
      <Series.Sequence durationInFrames={sec(3)} name="progress">
        {bg(theme.allowedStyles[0]!, "g-p")}
        <ProgressBar theme={theme} x={L.zones.progress!.rect.x} y={L.zones.progress!.rect.y} w={L.zones.progress!.rect.w} h={L.zones.progress!.rect.h * 1.5} from={0} to={sec(3)} marks={[sec(1), sec(2)]} />
        <Label text="progress bar (RTL fill)" />
      </Series.Sequence>
      <Series.Sequence durationInFrames={sec(6)} name="outro">
        <Outro theme={theme} durationInFrames={sec(6)} thanks={COPY[channel].thanks} cta={COPY[channel].subscribe} />
        <Label text="outro / end screen (20 s in episodes)" />
      </Series.Sequence>
      {theme.allowedStyles.map((st, i) => {
        const scene =
          i % 3 === 0
            ? sampleScene(`g-${st}`, st, "hook", [s.title, s.sub], { emphasis: [s.title.split(" ").at(-1)!] })
            : i % 3 === 1
              ? sampleScene(`g-${st}`, st, "step", [s.step, s.sub])
              : sampleScene(`g-${st}`, st, "benefit", [s.title, s.sub, s.series], { icons: ["music", "star", "target"] });
        return (
          <Series.Sequence key={st} durationInFrames={sec(3)} name={`style:${st}`}>
            <SceneView ps={planned(scene, sec(3))} theme={theme} style={getStyle(st)} format={format} durationInFrames={sec(3)} stepNumber={2} />
            <Label text={`style: ${getStyle(st).label}`} />
          </Series.Sequence>
        );
      })}
    </Series>
  );
};

export const ThumbnailStill: React.FC<{ channel: Channel; title: string; kicker?: string; imageSrc?: string }> = (p) => (
  <AbsoluteFill>
    <Thumbnail theme={getTheme(p.channel)} title={p.title} kicker={p.kicker} imageSrc={p.imageSrc} />
  </AbsoluteFill>
);
