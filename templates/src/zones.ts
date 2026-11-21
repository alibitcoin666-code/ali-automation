import type { Format, Rect, ZoneLayer } from "@amf/pipeline/core";

export interface Layout {
  width: number;
  height: number;
  /** Title-safe area (16:9: 10%; 9:16: Shorts UI exclusions). */
  safe: Rect;
  zones: Record<string, { rect: Rect; layer: ZoneLayer }>;
  caption: { fontSize: number; maxLineChars: number; lineHeight: number; weight: number; stroke: number };
  title: { min: number; max: number };
  body: { size: number };
}

/**
 * Reserved zones per format. Subtitle and typography zones never overlap
 * (validated in tests and at render time by the collision QA).
 */
export function getLayout(format: Format): Layout {
  if (format === "landscape_16x9") {
    const W = 1920;
    const H = 1080;
    const safe = { x: 192, y: 108, w: W - 384, h: H - 216 };
    return {
      width: W,
      height: H,
      safe,
      zones: {
        watermark: { rect: { x: 60, y: 44, w: 300, h: 60 }, layer: "logo" },
        ticker: { rect: { x: 192, y: 108, w: 1536, h: 64 }, layer: "typography" },
        title: { rect: { x: 192, y: 190, w: 1536, h: 330 }, layer: "typography" },
        body: { rect: { x: 192, y: 530, w: 1536, h: 150 }, layer: "typography" },
        sideText: { rect: { x: 1000, y: 190, w: 728, h: 490 }, layer: "typography" },
        visual: { rect: { x: 192, y: 190, w: 760, h: 490 }, layer: "visual" },
        lowerThird: { rect: { x: 1048, y: 690, w: 680, h: 92 }, layer: "lowerThird" },
        subtitle: { rect: { x: 240, y: 800, w: 1440, h: 172 }, layer: "subtitle" },
        progress: { rect: { x: 0, y: 1068, w: 1920, h: 12 }, layer: "logo" },
      },
      caption: { fontSize: 58, maxLineChars: 42, lineHeight: 1.45, weight: 650, stroke: 7 },
      title: { min: 110, max: 170 },
      body: { size: 48 },
    };
  }
  // 9:16 Shorts: keep text out of top 288, bottom 672, left 48, right 192.
  const W = 1080;
  const H = 1920;
  const safe = { x: 48, y: 288, w: W - 48 - 192, h: H - 288 - 672 };
  return {
    width: W,
    height: H,
    safe,
    zones: {
      platformTop: { rect: { x: 0, y: 0, w: W, h: 288 }, layer: "platformUi" },
      platformBottom: { rect: { x: 0, y: H - 672, w: W, h: 672 }, layer: "platformUi" },
      platformRight: { rect: { x: W - 192, y: 288, w: 192, h: H - 960 }, layer: "platformUi" },
      watermark: { rect: { x: 48, y: 300, w: 280, h: 56 }, layer: "logo" },
      title: { rect: { x: 48, y: 372, w: 840, h: 330 }, layer: "typography" },
      visual: { rect: { x: 48, y: 712, w: 840, h: 300 }, layer: "visual" },
      body: { rect: { x: 48, y: 712, w: 840, h: 120 }, layer: "typography" },
      lowerThird: { rect: { x: 48, y: 940, w: 840, h: 80 }, layer: "lowerThird" },
      subtitle: { rect: { x: 48, y: 1030, w: 840, h: 218 }, layer: "subtitle" },
      progress: { rect: { x: 0, y: 290, w: 888, h: 8 }, layer: "logo" },
    },
    caption: { fontSize: 70, maxLineChars: 24, lineHeight: 1.45, weight: 700, stroke: 8 },
    title: { min: 92, max: 130 },
    body: { size: 46 },
  };
}

export const YT_END_SCREEN_16x9 = {
  // Empty zones where YouTube end-screen elements are placed by the creator.
  video1: { x: 170, y: 330, w: 760, h: 428 },
  video2: { x: 990, y: 330, w: 760, h: 428 },
  subscribe: { x: 870, y: 800, w: 180, h: 180 },
} as const;
