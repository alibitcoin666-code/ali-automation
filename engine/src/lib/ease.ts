import { Easing, interpolate, spring, type SpringConfig } from "remotion";

export type Bezier = readonly [number, number, number, number];
export const bez = (b: Bezier) => Easing.bezier(b[0], b[1], b[2], b[3]);

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Eased 0→1 progress over [from, from+dur]. */
export const prog = (frame: number, from: number, dur: number, b: Bezier = [0.16, 1, 0.3, 1]) =>
  interpolate(frame, [from, from + Math.max(1, dur)], [0, 1], { ...clamp, easing: bez(b) });

export const springIn = (frame: number, fps: number, delay: number, config: Partial<SpringConfig>) =>
  spring({ frame: frame - delay, fps, config, durationRestThreshold: 0.001 });

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
