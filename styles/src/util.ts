import { Easing } from "remotion";
export type Bezier = readonly [number, number, number, number];
export const bez = (b: Bezier) => Easing.bezier(b[0], b[1], b[2], b[3]);
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
