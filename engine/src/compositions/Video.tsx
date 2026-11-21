import React, { useMemo } from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio, Video as MediaVideo } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { useWindowedAudioData, visualizeAudio } from "@remotion/media-utils";
import type { RenderPlan } from "@amf/pipeline/core";
import { getStyle, presentationFor, bez } from "@amf/styles";
import { Intro, Outro, ProgressBar, Watermark, getLayout, COPY } from "@amf/templates";
import { getTheme } from "../lib/brands";
import { SceneView } from "../scenes/SceneView";
import { SubtitleLayer } from "../layers/SubtitleLayer";
import { QaProbe } from "../layers/QaProbe";
import "../lib/fonts";
import { resolveSrc } from "../lib/src";

export type VideoProps = { plan: RenderPlan };

/** Transition length in frames for the cut into scene `i` (0 for hard cuts). */
export const transitionFramesFor = (plan: RenderPlan, i: number) => {
  const s = plan.scenes[i];
  if (!s) return 0;
  if (s.scene.transitionIn === "hardCut") return 0;
  const base = getStyle(s.scene.style).transitionFrames;
  return Math.round((base * plan.fps) / 30);
};

/**
 * Timeline:
 *   [intro][scene 1]...[scene n][outro]
 * Each item k starts at S_k on the absolute timeline (where its voice starts).
 * Item k is extended by the incoming transition T of item k+1, so the next item's
 * presentation starts exactly at S_{k+1}:   d_k = S_{k+1} + T_{k+1} - S_k.
 * Captions are on the absolute timeline, so transitions never shift them.
 */
export const MotionVideo: React.FC<VideoProps> = ({ plan }) => {
  const anyReactive = plan.scenes.some((s) => getStyle(s.scene.style).audioReactive);
  if (anyReactive && plan.musicSrc) return <WithSpectrum plan={plan} src={resolveSrc(plan.musicSrc)!} />;
  return <VideoInner plan={plan} />;
};

/** Audio-reactive analysis on the music stem only (never voice). Frame is taken once, at the top. */
const WithSpectrum: React.FC<{ plan: RenderPlan; src: string }> = ({ plan, src }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { audioData, dataOffsetInSeconds } = useWindowedAudioData({ src, frame, fps, windowInSeconds: 10 });
  const raw = audioData ? visualizeAudio({ fps, frame, audioData, numberOfSamples: 256, optimizeFor: "speed", dataOffsetInSeconds }) : undefined;
  const spectrum = raw ? toDisplaySpectrum(raw, 48) : undefined;
  const energy = raw ? Math.min(1, dbScale(raw.slice(0, 6).reduce((a, b) => a + b, 0) / 6)) : undefined;
  return <VideoInner plan={plan} spectrum={spectrum} energy={energy} />;
};

const VideoInner: React.FC<VideoProps & { spectrum?: number[]; energy?: number }> = ({ plan, spectrum, energy }) => {
  const { fps } = useVideoConfig();
  const theme = getTheme(plan.storyboard.channel);
  const format = plan.storyboard.format;
  const L = getLayout(format);
  const outroStart = plan.durationInFrames - plan.outroFrames;

  const items = useMemo(() => {
    const starts = [0, ...plan.scenes.map((s) => s.fromFrame), outroStart];
    const T = [0, ...plan.scenes.map((_, i) => transitionFramesFor(plan, i)), Math.round((12 * plan.fps) / 30)];
    return starts.map((S, k) => {
      const next = starts[k + 1];
      const d = next == null ? plan.durationInFrames - S : next + (T[k + 1] ?? 0) - S;
      return { S, d, Tin: T[k] ?? 0 };
    });
  }, [plan, outroStart]);

  let stepCounter = 0;
  const children: React.ReactNode[] = [];
  items.forEach((it, k) => {
    if (k > 0 && it.Tin > 0) {
      const id = k <= plan.scenes.length ? plan.scenes[k - 1]!.scene.transitionIn : "fade";
      children.push(
        <TransitionSeries.Transition
          key={`t${k}`}
          timing={linearTiming({ durationInFrames: it.Tin, easing: bez([0.65, 0, 0.35, 1]) })}
          presentation={presentationFor(id, { color: theme.palette.accent, width: L.width, height: L.height })}
        />,
      );
    }
    if (k === 0) {
      children.push(
        <TransitionSeries.Sequence key="intro" durationInFrames={Math.max(1, it.d)} name="intro">
          <ExitFade d={it.d} t={items[k + 1]?.Tin ?? 0}>
            <Intro theme={theme} durationInFrames={it.d} />
          </ExitFade>
        </TransitionSeries.Sequence>,
      );
    } else if (k === items.length - 1) {
      children.push(
        <TransitionSeries.Sequence key="outro" durationInFrames={Math.max(1, it.d)} name="outro">
          <Outro theme={theme} durationInFrames={it.d} thanks={COPY[theme.id].thanks} cta={COPY[theme.id].subscribe} />
        </TransitionSeries.Sequence>,
      );
    } else {
      const ps = plan.scenes[k - 1]!;
      const stepNumber = ps.scene.sceneType === "step" ? ++stepCounter : undefined;
      children.push(
        <TransitionSeries.Sequence key={ps.scene.id} durationInFrames={Math.max(1, it.d)} name={`${ps.scene.sceneType}:${ps.scene.id}`} premountFor={fps}>
          <ExitFade d={it.d} t={items[k + 1]?.Tin ?? 0}>
          {ps.imageSrc?.endsWith(".mp4") ? (
            <AbsoluteFill>
              <MediaVideo src={resolveSrc(ps.imageSrc)!} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </AbsoluteFill>
          ) : (
            <SceneView ps={ps} theme={theme} style={getStyle(ps.scene.style)} format={format} durationInFrames={it.d} stepNumber={stepNumber} spectrum={spectrum} energy={energy} />
          )}
          </ExitFade>
        </TransitionSeries.Sequence>,
      );
    }
  });

  const wm = L.zones.watermark!.rect;
  const pr = L.zones.progress!.rect;
  return (
    <AbsoluteFill style={{ background: theme.palette.bg }}>
      <TransitionSeries>{children}</TransitionSeries>
      {/* persistent chrome (scenes only) */}
      <Sequence from={plan.introFrames} durationInFrames={Math.max(1, outroStart - plan.introFrames)} layout="none" name="chrome">
        <Watermark theme={theme} x={wm.x} y={wm.y} h={wm.h} />
      </Sequence>
      {format === "landscape_16x9" && (
        <Sequence from={0} durationInFrames={plan.durationInFrames} layout="none" name="progress">
          <ProgressBarAbs theme={theme} x={pr.x} y={pr.y} w={pr.w} h={pr.h} from={plan.introFrames} to={outroStart} marks={plan.chapters.map((c) => Math.round((c.atMs * fps) / 1000))} />
        </Sequence>
      )}
      {plan.burnCaptions && <SubtitleLayer captions={plan.captions} theme={theme} format={format} boxed={plan.scenes.some((s) => s.scene.style === "broadcastNews")} />}
      {plan.audioSrc && <Audio src={resolveSrc(plan.audioSrc)!} />}
      <QaProbe enabled={plan.qaProbe} />
    </AbsoluteFill>
  );
};

/** Progress bar visible only between intro and outro. */
const ProgressBarAbs: React.FC<React.ComponentProps<typeof ProgressBar>> = (p) => {
  const f = useCurrentFrame();
  if (f < p.from || f >= p.to) return null;
  return <ProgressBar {...p} />;
};

/**
 * Outgoing content fades out during the first ~40% of the transition into the next sequence,
 * so text from two scenes never ghosts on top of each other mid-transition.
 */
const ExitFade: React.FC<{ d: number; t: number; children: React.ReactNode }> = ({ d, t, children }) => {
  const frame = useCurrentFrame();
  if (t <= 0) return <>{children}</>;
  const a = d - t;
  const opacity = interpolate(frame, [a, a + Math.max(2, Math.round(t * 0.4))], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

/** dB scaling as recommended by the visualizeAudio() docs; range tuned for a −14 LUFS master. */
const dbScale = (v: number, minDb = -72, maxDb = -12) => Math.max(0, Math.min(1, (20 * Math.log10(Math.max(v, 1e-6)) - minDb) / (maxDb - minDb)));

/**
 * Linear FFT bins → `n` log-spaced bands (≈ 60 Hz … 16 kHz), dB-scaled, with a gentle
 * high-frequency tilt so the whole bar chart moves, not just the bass end.
 */
function toDisplaySpectrum(lin: number[], n: number): number[] {
  const N = lin.length; // covers 0 … Nyquist (24 kHz at 48 kHz)
  const hz = (i: number) => (i / N) * 24000;
  const lo = 60;
  const hi = 16000;
  const out: number[] = [];
  for (let b = 0; b < n; b++) {
    const f0 = lo * Math.pow(hi / lo, b / n);
    const f1 = lo * Math.pow(hi / lo, (b + 1) / n);
    let a = Math.floor((f0 / 24000) * N);
    let z = Math.max(a + 1, Math.ceil((f1 / 24000) * N));
    a = Math.min(a, N - 1);
    z = Math.min(z, N);
    let m = 0;
    for (let i = a; i < z; i++) m = Math.max(m, lin[i]!);
    const tilt = 1 + 0.9 * (Math.log(Math.max(hz(a), lo) / lo) / Math.log(hi / lo));
    out.push(Math.min(1, dbScale(m * tilt)));
  }
  return out;
}
