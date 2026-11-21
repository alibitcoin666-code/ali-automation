import React, { useMemo } from "react";
import { Player } from "@remotion/player";
import { MotionVideo } from "../../../engine/src/compositions/Video";
import { gated } from "../../../engine/src/lib/FontGate";
import type { RenderPlan } from "@amf/pipeline/core";
import { DEMO } from "./data";

const GVideo = gated(MotionVideo);

/** Live Remotion preview of the exact render plan (same composition the renderer uses). */
export default function PlayerView({ plan, audio }: { plan: RenderPlan; audio?: string }) {
  const p = useMemo<RenderPlan>(
    () => ({ ...plan, audioSrc: audio ?? plan.audioSrc, musicSrc: audio ?? null, qaProbe: false } as RenderPlan),
    [plan, audio],
  );
  const vertical = p.height > p.width;
  return (
    <div className={vertical ? "player player--v" : "player"}>
      <Player
        component={GVideo as unknown as React.FC<Record<string, unknown>>}
        inputProps={{ plan: p }}
        durationInFrames={p.durationInFrames}
        fps={p.fps}
        compositionWidth={p.width}
        compositionHeight={p.height}
        controls
        allowFullscreen={!DEMO}
        acknowledgeRemotionLicense
        style={{ width: "100%", aspectRatio: `${p.width} / ${p.height}`, borderRadius: 10, overflow: "hidden", background: "#000" }}
        errorFallback={({ error }) => <div className="player-error">خطای پیش‌نمایش: {error.message}</div>}
      />
    </div>
  );
}
