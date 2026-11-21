import { Template, type Channel, type Format } from "@amf/pipeline/core";
import { getLayout } from "./zones";

const KINDS = ["intro", "outro", "lowerThird", "chapter", "cta", "quote", "episode", "short", "thumbnail", "series", "caption", "progress", "watermark"] as const;

const durations = (fps: number): Partial<Record<(typeof KINDS)[number], number>> => ({
  intro: 4 * fps,
  outro: 20 * fps,
  chapter: Math.round(2.2 * fps),
  series: 3 * fps,
});

/** Machine-readable template specs; zones are validated (subtitle never overlaps other layers). */
export function templatesFor(channel: Channel, fps: 30 | 60 = 30): Template[] {
  const out: Template[] = [];
  for (const kind of KINDS) {
    const formats: (Format | "thumb_1280x720" | "thumb_1080x1920")[] =
      kind === "thumbnail" ? ["thumb_1280x720", "thumb_1080x1920"] : kind === "episode" ? ["landscape_16x9"] : kind === "short" ? ["shorts_9x16"] : ["landscape_16x9", "shorts_9x16"];
    for (const format of formats) {
      const L = getLayout(format === "thumb_1080x1920" || format === "shorts_9x16" ? "shorts_9x16" : "landscape_16x9");
      const isThumb = format.startsWith("thumb");
      const d = durations(fps)[kind];
      const outroFrames = kind === "outro" && format === "shorts_9x16" ? 3 * fps : d;
      out.push(
        Template.parse({
          id: `${channel}.${kind}.${format}`,
          channel,
          kind,
          format,
          width: format === "thumb_1280x720" ? 1280 : L.width,
          height: format === "thumb_1280x720" ? 720 : L.height,
          fps,
          durationFrames: isThumb ? undefined : outroFrames,
          zones: L.zones,
          safeArea: { top: L.safe.y, left: L.safe.x, right: L.width - L.safe.x - L.safe.w, bottom: L.height - L.safe.y - L.safe.h },
          slots: kind === "episode" || kind === "short" ? [{ id: "broll", accepts: ["image", "video", "lottie"] }, { id: "title", accepts: ["text"] }] : [{ id: "text", accepts: ["text"] }],
          goldenFrames: outroFrames ? [Math.round(outroFrames * 0.25), Math.round(outroFrames * 0.75)] : [0],
        }),
      );
    }
  }
  return out;
}
