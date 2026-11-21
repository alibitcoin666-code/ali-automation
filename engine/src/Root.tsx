import React from "react";
import { Composition, Still } from "remotion";
import { Channel, RenderPlan } from "@amf/pipeline/core";
import { MotionVideo, type VideoProps } from "./compositions/Video";
import { FontProofAll, BrandProof } from "./compositions/FontProof";
import { TemplateGallery, ThumbnailStill, galleryDuration } from "./compositions/Gallery";
import { demoPlan } from "./fixtures/demoPlan";
import { SAMPLE } from "./fixtures/samples";
import { gated } from "./lib/FontGate";

const GVideo = gated(MotionVideo);
const GFontProof = gated(FontProofAll);
const GBrandProof = gated(BrandProof);
const GGallery = gated(TemplateGallery);
const GThumb = gated(ThumbnailStill);

const CHANNELS = Channel.options;

export const Root: React.FC = () => (
  <>
    <Composition
      id="Video"
      component={GVideo}
      defaultProps={{ plan: demoPlan() } satisfies VideoProps}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={300}
      calculateMetadata={({ props }) => {
        const plan = RenderPlan.parse(props.plan); // hard fail on an invalid plan
        return { durationInFrames: plan.durationInFrames, fps: plan.fps, width: plan.width, height: plan.height, props: { plan } };
      }}
    />
    <Still id="FontProof" component={GFontProof} width={1920} height={1080} />
    {CHANNELS.map((c) => (
      <React.Fragment key={c}>
        <Still id={`BrandProof-${c}`} component={GBrandProof} defaultProps={{ channel: c }} width={1920} height={1080} />
        <Composition id={`Gallery-${c}-16x9`} component={GGallery as unknown as React.FC<Record<string, unknown>>} defaultProps={{ channel: c, format: "landscape_16x9" as const }} width={1920} height={1080} fps={30} durationInFrames={galleryDuration(c, 30)} />
        <Composition id={`Gallery-${c}-9x16`} component={GGallery as unknown as React.FC<Record<string, unknown>>} defaultProps={{ channel: c, format: "shorts_9x16" as const }} width={1080} height={1920} fps={30} durationInFrames={galleryDuration(c, 30)} />
        <Still id={`Thumb-${c}-16x9`} component={GThumb} defaultProps={{ channel: c, title: SAMPLE[c].title, kicker: SAMPLE[c].series }} width={1280} height={720} />
        <Still id={`Thumb-${c}-9x16`} component={GThumb} defaultProps={{ channel: c, title: SAMPLE[c].title, kicker: SAMPLE[c].series }} width={1080} height={1920} />
      </React.Fragment>
    ))}
  </>
);
