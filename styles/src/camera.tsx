import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { noise2D } from "@remotion/noise";
import type { MotionStyle } from "@amf/pipeline/core";
import { bez, clamp } from "./util";

/** Applies the style's camera move to its children over the scene duration. */
export const Camera: React.FC<{ style: MotionStyle; seed: string; durationInFrames: number; children: React.ReactNode; strength?: number }> = ({
  style,
  seed,
  durationInFrames,
  children,
  strength = 1,
}) => {
  const f = useCurrentFrame();
  const { width } = useVideoConfig();
  const moves = new Set(style.camera);
  const t = interpolate(f, [0, durationInFrames], [0, 1], { ...clamp, easing: bez(style.easing.push ?? style.easing.heroIn ?? [0.45, 0, 0.55, 1]) });
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let rot = 0;
  if (moves.has("pushIn")) scale *= 1 + 0.06 * t * strength;
  if (moves.has("dolly")) tx += (t - 0.5) * width * 0.03 * strength;
  if (moves.has("orbit")) rot += (t - 0.5) * 2 * strength;
  if (moves.has("drift")) {
    tx += noise2D(seed + "cx", f / 160, 0) * 10 * strength;
    ty += noise2D(seed + "cy", 0, f / 160) * 7 * strength;
  }
  return (
    <AbsoluteFill style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale}) rotate(${rot}deg)`, transformOrigin: "50% 45%" }}>
      {children}
    </AbsoluteFill>
  );
};

/** Parallax helper: offset proportional to depth (0 = background, 1 = foreground). */
export const useParallax = (depth: number, durationInFrames: number) => {
  const f = useCurrentFrame();
  const { width } = useVideoConfig();
  const t = interpolate(f, [0, durationInFrames], [-0.5, 0.5], clamp);
  return t * width * 0.02 * depth;
};
