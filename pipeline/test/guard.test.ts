import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Storyboard } from "../src/core/schemas";
import { guard, guardStoryboard } from "../src/stages/guard";

describe("guard", () => {
  const base = { channel: "pianova", type: "EDUCATIONAL", format: "landscape_16x9", topic: "آکورد", fps: 30, durationSec: 60 };
  it("passes a valid request", () => expect(guard(base).reasons).toEqual([]));
  it("blocks the protected channel in any form", () => {
    for (const t of ["https://www.youtube.com/@Alibaghbani1hand", "youtube.com/@ALIBAGHBANI1HAND/", "m.youtube.com/@alibaghbani1hand"])
      expect(guard({ ...base, target: t }).ok).toBe(false);
  });
  it("honours the kill switch", () => {
    expect(guard(base, { FACTORY_ENABLED: "false" } as NodeJS.ProcessEnv).ok).toBe(false);
  });
  it("blocks other-brand styles", () => {
    expect(guard({ ...base, channel: "onehandonedream", style: "neonGlow" }).ok).toBe(false);
  });
});

describe("guardStoryboard", () => {
  const load = (f: string) => Storyboard.parse(JSON.parse(readFileSync(`../samples/${f}.json`, "utf8")));
  it("passes all sample storyboards", () => {
    for (const f of ["pianova-lesson", "pianova-short", "mr69-promo", "ohod-story", "neutral-news"]) expect(guardStoryboard(load(f)).reasons).toEqual([]);
  });
  it("rejects right-hand content on ONE HAND, ONE DREAM", () => {
    const sb = load("ohod-story");
    sb.scenes[2]!.voiceText = "با دست راست نت پایه را بزن.";
    expect(guardStoryboard(sb).ok).toBe(false);
  });
  it("rejects styles from another brand", () => {
    const sb = load("ohod-story");
    sb.scenes[0]!.style = "neonGlow";
    expect(guardStoryboard(sb).ok).toBe(false);
  });
});
