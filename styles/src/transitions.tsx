import React from "react";
import { AbsoluteFill, interpolate, random } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { none } from "@remotion/transitions/none";
import type { TransitionId } from "@amf/pipeline/core";
import { clamp } from "./util";

type P = { kind: string; color: string; width: number; height: number };
type Props = TransitionPresentationComponentProps<P>;

/** CSS-only presentations: deterministic, no WebGL dependency in headless CI. */
const Custom: React.FC<Props> = ({ children, presentationDirection: dir, presentationProgress: t, passedProps: p }) => {
  const entering = dir === "entering";
  const st: React.CSSProperties = {};
  let overlay: React.ReactNode = null;
  switch (p.kind) {
    case "maskWipeRtl": {
      // new scene revealed from right to left (Persian reading direction)
      if (entering) st.clipPath = `inset(0 0 0 ${(1 - t) * 100}%)`;
      break;
    }
    case "lightSweep": {
      st.opacity = entering ? interpolate(t, [0.35, 0.65], [0, 1], clamp) : interpolate(t, [0.35, 0.65], [1, 0], clamp);
      if (entering) {
        const x = interpolate(t, [0, 1], [-0.4, 1.4]) * p.width;
        overlay = (
          <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none" }}>
            <div style={{ position: "absolute", left: x - 400, top: "-30%", width: 800, height: "160%", transform: "rotate(16deg)", background: `linear-gradient(90deg, transparent, ${p.color}88, #fff8e6cc, ${p.color}88, transparent)`, opacity: Math.sin(t * Math.PI) }} />
          </AbsoluteFill>
        );
      }
      break;
    }
    case "filmBurn": {
      st.opacity = entering ? interpolate(t, [0.4, 0.75], [0, 1], clamp) : 1;
      if (entering) {
        const k = Math.sin(t * Math.PI);
        overlay = (
          <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none", opacity: k }}>
            <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 80% at ${80 - t * 40}% 40%, #ffb347, #ff6a00aa 40%, transparent 75%)` }} />
            <AbsoluteFill style={{ background: `radial-gradient(ellipse 40% 50% at ${20 + t * 30}% 70%, #fff1c1cc, transparent 70%)` }} />
          </AbsoluteFill>
        );
      }
      break;
    }
    case "whipPan": {
      const dx = entering ? (1 - t) * -p.width : t * p.width;
      st.transform = `translateX(${dx}px)`;
      st.filter = `blur(${Math.sin(t * Math.PI) * 24}px)`;
      break;
    }
    case "zoomBlur": {
      const s = entering ? interpolate(t, [0, 1], [1.25, 1]) : interpolate(t, [0, 1], [1, 0.85]);
      st.transform = `scale(${s})`;
      st.filter = `blur(${Math.sin(t * Math.PI) * 18}px)`;
      st.opacity = entering ? interpolate(t, [0, 0.5], [0, 1], clamp) : interpolate(t, [0.5, 1], [1, 0], clamp);
      break;
    }
    case "glitch": {
      const on = entering ? t > 0.5 : t <= 0.5;
      const g = Math.sin(t * Math.PI);
      const step = Math.floor(t * 20);
      st.opacity = on ? 1 : 0;
      st.transform = `translateX(${(random(`gl-${step}-${dir}`) - 0.5) * 60 * g}px)`;
      st.filter = g > 0.2 ? `hue-rotate(${(random(`glh-${step}`) - 0.5) * 90 * g}deg) saturate(${1 + g})` : undefined;
      break;
    }
  }
  return (
    <AbsoluteFill>
      <AbsoluteFill style={st}>{children}</AbsoluteFill>
      {overlay}
    </AbsoluteFill>
  );
};

export const custom = (kind: string, color: string, width: number, height: number): TransitionPresentation<P> => ({
  component: Custom,
  props: { kind, color, width, height },
});

export function presentationFor(
  id: TransitionId,
  opts: { color: string; width: number; height: number },
): TransitionPresentation<Record<string, unknown>> {
  switch (id) {
    case "fade":
      return fade() as never;
    case "slide":
      // RTL: content moves from left to right
      return slide({ direction: "from-left" }) as never;
    case "clockWipe":
      return clockWipe({ width: opts.width, height: opts.height }) as never;
    case "hardCut":
      return none() as never;
    default:
      return custom(id, opts.color, opts.width, opts.height) as never;
  }
}
