import { Api, InlineKeyboard } from "grammy";
import { JobRequest } from "@amf/pipeline/core";
import type { Env } from "./env";
import { enabled, ownerId } from "./env";
import { createJob, getJob, newJobId, setStatus, todayCount, event, type JobRow } from "./db";
import { dispatch } from "./github";
import { signMedia } from "./crypto";
import { T, faDigits, CHANNEL_FA, TYPE_FA, FORMAT_FA } from "./fa";
import pianova from "../../brands/pianova/theme.json";
import musicradio69 from "../../brands/musicradio69/theme.json";
import onehandonedream from "../../brands/onehandonedream/theme.json";
import neutral from "../../brands/neutral/theme.json";

export const THEMES = { pianova, musicradio69, onehandonedream, neutral } as const;
export type ChannelId = keyof typeof THEMES;

/** Hard-coded protected targets (mirrors pipeline/src/stages/guard.ts — the Actions guard runs again). */
export const PROTECTED_TARGETS = ["youtube.com/@alibaghbani1hand"];
const norm = (s: string) => s.toLowerCase().replace(/https?:\/\//g, "").replace(/(^|\s)(www\.|m\.)/g, "$1").replace(/\/+(\s|$)/g, "$1");

export function guardRequest(env: Env, raw: unknown): { ok: true; req: JobRequest } | { ok: false; reason: string } {
  if (!enabled(env)) return { ok: false, reason: "FACTORY_ENABLED=false" };
  const p = JobRequest.safeParse(raw);
  if (!p.success) return { ok: false, reason: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const req = p.data;
  const theme = THEMES[req.channel as ChannelId];
  const blob = norm([req.target ?? "", req.topic, ...req.points, ...req.sources.map((s) => s.url)].join(" "));
  for (const b of [...PROTECTED_TARGETS, ...theme.blockedTargets]) if (blob.includes(norm(b))) return { ok: false, reason: `protected target ${b}` };
  if (req.style && !(theme.allowedStyles as string[]).includes(req.style)) return { ok: false, reason: `style ${req.style} not allowed for ${req.channel}` };
  if (!(theme.allowedFps as number[]).includes(req.fps)) return { ok: false, reason: `${req.fps} fps not allowed for ${req.channel}` };
  if (req.quality === "4k" && !theme.allow4k) return { ok: false, reason: `4K not allowed for ${req.channel}` };
  if (req.type === "NEWS" && req.sources.length === 0) return { ok: false, reason: "NEWS needs sources" };
  return { ok: true, req };
}

/** Telegram client; a no-op stand-in when the bot is not configured (panel / e2e still work). */
export const api = (env: Env): Pick<Api, "sendMessage" | "sendPhoto" | "sendVideo"> => {
  if (env.BOT_TOKEN && ownerId(env) > 0) return new Api(env.BOT_TOKEN);
  const skip = async () => (console.log("telegram not configured — message skipped"), undefined as never);
  return { sendMessage: skip, sendPhoto: skip, sendVideo: skip };
};

export const reviewKeyboard = (id: string, stage: "s" | "p") =>
  new InlineKeyboard().text(T.btnApprove, `a:${stage}:${id}`).text(T.btnEdit, `e:${stage}:${id}`).text(T.btnReject, `r:${stage}:${id}`);

/** Creates a job, stores its request in R2 and dispatches the script stage. */
export async function startJob(env: Env, chatId: number, raw: unknown): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const g = guardRequest(env, raw);
  if (!g.ok) return g;
  const cap = Number(env.DAILY_CAP || 6);
  if ((await todayCount(env)) >= cap) return { ok: false, reason: T.quotaFull(cap) };
  const id = newJobId();
  const req = { ...g.req, fps: g.req.channel === "musicradio69" ? 60 : g.req.fps };
  await env.MEDIA.put(`jobs/${id}/request.json`, JSON.stringify({ ...req, chatId }, null, 2), { httpMetadata: { contentType: "application/json" } });
  await createJob(env, { id, chat_id: chatId, channel: req.channel, type: req.type, format: req.format, topic: req.topic, status: "scripting", request_json: JSON.stringify(req) });
  await setStatus(env, id, "scripting", "script");
  await dispatch(env, id, "script");
  return { ok: true, id };
}

export async function approve(env: Env, id: string, stage: "s" | "p") {
  const j = await getJob(env, id);
  if (!j) throw new Error("job not found");
  if (stage === "s" && j.status === "script_review") {
    await setStatus(env, id, "preview_rendering", "preview");
    await dispatch(env, id, "preview");
    return T.approvedScript;
  }
  if (stage === "p" && j.status === "preview_review") {
    await setStatus(env, id, "final_rendering", "final");
    await dispatch(env, id, "final");
    return T.approvedPreview;
  }
  return `وضعیت فعلی: ${j.status}`;
}

export async function reject(env: Env, id: string) {
  await setStatus(env, id, "rejected");
  return T.rejected;
}

export async function cancel(env: Env, id: string) {
  await setStatus(env, id, "cancelled");
  return T.cancelled(id);
}

/** Edit at any review point: store the note and re-run the script stage with it. */
export async function edit(env: Env, id: string, note: string) {
  const j = await getJob(env, id);
  if (!j) throw new Error("job not found");
  const obj = await env.MEDIA.get(`jobs/${id}/edits.json`);
  const notes = [...(obj ? await obj.json<string[]>() : []), note.slice(0, 1000)];
  await env.MEDIA.put(`jobs/${id}/edits.json`, JSON.stringify(notes));
  await setStatus(env, id, "scripting", "script", { edit_note: note.slice(0, 1000) });
  await dispatch(env, id, "script");
  return T.editQueued;
}

/* ------------------------------------------------------------------ */
/* Callbacks from GitHub Actions                                        */
/* ------------------------------------------------------------------ */

export interface CallbackPayload {
  jobId: string;
  stage: "script" | "preview" | "final";
  status: "ok" | "failed" | "running";
  error?: string;
  /** Short human-readable QA summary lines (final stage). */
  qa?: { pass: boolean; lines: string[] };
  /** Optional Drive web link of the final folder. */
  driveUrl?: string;
}

const scriptMessage = (j: JobRow, sb: { title: string; scenes: { id: string; sceneType: string; voiceText: string; onScreenText: string[]; sources?: { url: string }[] }[] }) => {
  const head = `«${sb.title}»\n${CHANNEL_FA[j.channel]} · ${TYPE_FA[j.type]} · ${FORMAT_FA[j.format]}\nکار ${j.id}\n`;
  const body = sb.scenes.map((s, i) => `${faDigits(i + 1)}. [${s.sceneType}] ${s.voiceText}${s.onScreenText.length ? `\n   متن روی تصویر: ${s.onScreenText.join(" | ")}` : ""}${s.sources?.length ? `\n   منبع: ${s.sources.map((x) => x.url).join(" ")}` : ""}`).join("\n\n");
  const news = j.type === "NEWS" ? "\n\nتوجه: تأیید این متن یعنی منابع و صحت خبر را هم بررسی و تأیید کرده‌اید." : "";
  const msg = `${head}\n${body}${news}`;
  return msg.length > 4000 ? msg.slice(0, 3990) + "…" : msg;
};

export async function onCallback(env: Env, p: CallbackPayload) {
  const j = await getJob(env, p.jobId);
  if (!j) throw new Error("unknown job");
  if (j.status === "cancelled" || j.status === "rejected") return;
  const tg = api(env);
  const base = env.PUBLIC_URL.replace(/\/+$/, "");
  await event(env, j.id, p.stage, p.status, p);
  if (p.status === "running") return;
  if (p.status === "failed") {
    await setStatus(env, j.id, "failed", p.stage, { error: (p.error ?? "unknown").slice(0, 2000) });
    await tg.sendMessage(j.chat_id, `کار ${j.id} در مرحله‌ی ${p.stage} شکست خورد:\n${(p.error ?? "").slice(0, 1500)}`);
    return;
  }
  if (p.stage === "script") {
    const sb = await (await env.MEDIA.get(`jobs/${j.id}/storyboard.json`))?.json<Parameters<typeof scriptMessage>[1]>();
    if (!sb) throw new Error("storyboard missing in R2");
    await setStatus(env, j.id, "script_review", "script");
    await tg.sendMessage(j.chat_id, scriptMessage(j, sb), { reply_markup: reviewKeyboard(j.id, "s") });
    return;
  }
  if (p.stage === "preview") {
    await setStatus(env, j.id, "preview_review", "preview");
    const vKey = `jobs/${j.id}/out/preview-720p.mp4`;
    const head = await env.MEDIA.head(vKey);
    const proof = `jobs/${j.id}/qa/proof-sheet.png`;
    if (await env.MEDIA.head(proof)) await tg.sendPhoto(j.chat_id, base + (await signMedia(env.SESSION_SECRET, proof)), { caption: `برگه‌ی اثبات زیرنویس — ${j.id}` }).catch(() => undefined);
    const link = base + (await signMedia(env.SESSION_SECRET, vKey));
    // Bot API: files sent by URL are limited to 20 MB for non-photo types.
    if (head && head.size < 20 * 1024 * 1024) {
      await tg.sendVideo(j.chat_id, link, { caption: `پیش‌نمایش ۷۲۰p — ${j.id}`, supports_streaming: true, reply_markup: reviewKeyboard(j.id, "p") });
    } else {
      await tg.sendMessage(j.chat_id, `پیش‌نمایش ۷۲۰p — ${j.id}\n${link}`, { reply_markup: reviewKeyboard(j.id, "p") });
    }
    return;
  }
  if (p.stage === "final") {
    const pass = p.qa?.pass ?? false;
    await setStatus(env, j.id, pass ? "delivered" : "failed", "deliver", pass ? {} : { error: "QA failed" });
    const lines: string[] = [];
    const listed = await env.MEDIA.list({ prefix: `jobs/${j.id}/out/`, limit: 50 });
    for (const o of listed.objects) {
      if (/preview-720p|manifest/.test(o.key)) continue;
      lines.push(`${o.key.split("/").pop()}: ${base}${await signMedia(env.SESSION_SECRET, o.key)}`);
    }
    const rep = `jobs/${j.id}/qa/report.json`;
    if (await env.MEDIA.head(rep)) lines.push(`report.json: ${base}${await signMedia(env.SESSION_SECRET, rep)}`);
    const qa = (p.qa?.lines ?? []).slice(0, 20).join("\n");
    await tg.sendMessage(
      j.chat_id,
      `${pass ? "نسخه‌ی نهایی آماده است" : "کنترل کیفیت رد شد؛ خروجی تحویل نهایی نیست"} — ${j.id}\n\n${qa}\n\n${lines.join("\n")}${p.driveUrl ? `\n\nGoogle Drive: ${p.driveUrl}` : ""}`,
      { link_preview_options: { is_disabled: true } },
    );
  }
}
