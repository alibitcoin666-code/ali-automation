import { JobRequest, type Channel, type Storyboard } from "../core/schemas";
import { loadBrand } from "../lib/brand";

/** Hard-coded protected targets. Never uploaded to, edited, or called with write APIs. */
export const PROTECTED_TARGETS = ["youtube.com/@alibaghbani1hand"];

const norm = (s: string) => s.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\.|^m\./, "").replace(/\/+$/, "");

export interface GuardResult {
  ok: boolean;
  reasons: string[];
}

/**
 * Guard stage: runs first for every job. Fails when
 *  - the factory kill switch is off
 *  - the request targets a protected channel (in target, topic or sources)
 *  - the requested style is not allowed for the channel (brands are never mixed)
 *  - fps / 4K not allowed for the channel
 */
export function guard(reqRaw: unknown, env: NodeJS.ProcessEnv = process.env): GuardResult {
  const reasons: string[] = [];
  if ((env.FACTORY_ENABLED ?? "true").toLowerCase() !== "true") reasons.push("FACTORY_ENABLED is off (kill switch)");
  const parsed = JobRequest.safeParse(reqRaw);
  if (!parsed.success) return { ok: false, reasons: [...reasons, `invalid request: ${parsed.error.message}`] };
  const req = parsed.data;
  const blob = norm([req.target ?? "", req.topic, ...req.points, ...req.sources.map((s) => s.url)].join(" "));
  const brand = loadBrand(req.channel as Channel);
  const blocked = new Set([...PROTECTED_TARGETS, ...brand.theme.blockedTargets.map(norm)]);
  for (const b of blocked) if (blob.includes(norm(b))) reasons.push(`targets protected channel ${b}`);
  if (req.style && !brand.theme.allowedStyles.includes(req.style)) reasons.push(`style ${req.style} not allowed for ${req.channel}`);
  if (!brand.theme.allowedFps.includes(req.fps)) reasons.push(`${req.fps} fps not allowed for ${req.channel}`);
  if (req.quality === "4k" && !brand.theme.allow4k) reasons.push(`4K not allowed for ${req.channel}`);
  return { ok: reasons.length === 0, reasons };
}

/** Storyboard-level brand rules (run after the script is written and before rendering). */
export function guardStoryboard(sb: Storyboard): GuardResult {
  const reasons: string[] = [];
  const brand = loadBrand(sb.channel as Channel);
  for (const s of sb.scenes) {
    if (!brand.theme.allowedStyles.includes(s.style)) reasons.push(`scene ${s.id}: style ${s.style} not allowed for ${sb.channel}`);
    const text = [s.voiceText, ...s.onScreenText, s.lowerThird?.title ?? "", s.lowerThird?.subtitle ?? ""].join(" ");
    if (sb.channel === "onehandonedream" && /دست\s*راست|هر\s*دو\s*دست|با\s*دو\s*دست|right\s*hand|both\s*hands/i.test(text))
      reasons.push(`scene ${s.id}: ONE HAND, ONE DREAM is left-hand only`);
    const blob = norm([text, ...s.sources.map((x) => x.url)].join(" "));
    for (const b of [...PROTECTED_TARGETS, ...brand.theme.blockedTargets.map(norm)]) if (blob.includes(norm(b))) reasons.push(`scene ${s.id}: references protected target ${b}`);
  }
  if (sb.type === "NEWS" && !sb.factCheckConfirmed) reasons.push("NEWS requires factCheckConfirmed=true");
  return { ok: reasons.length === 0, reasons };
}
