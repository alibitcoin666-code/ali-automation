import { BrandTheme, type Channel } from "@amf/pipeline/core";
import pianova from "../../../brands/pianova/theme.json";
import musicradio69 from "../../../brands/musicradio69/theme.json";
import onehandonedream from "../../../brands/onehandonedream/theme.json";
import neutral from "../../../brands/neutral/theme.json";

/** Brand themes, validated at bundle time. A broken theme fails the render. */
export const THEMES: Record<Channel, BrandTheme> = {
  pianova: BrandTheme.parse(pianova),
  musicradio69: BrandTheme.parse(musicradio69),
  onehandonedream: BrandTheme.parse(onehandonedream),
  neutral: BrandTheme.parse(neutral),
};
export const getTheme = (c: Channel) => THEMES[c];
