import { Bot, InlineKeyboard, type Context } from "grammy";
import type { Env } from "./env";
import { enabled, ownerId } from "./env";
import { getDraft, setDraft, listJobs, latestActive, getJob, todayCount } from "./db";
import { startJob, approve, reject, cancel, edit, THEMES, type ChannelId } from "./jobs";
import { createMagic } from "./auth";
import { T, CHANNEL_FA, TYPE_FA, FORMAT_FA, STATUS_FA, STYLE_FA, faDigits } from "./fa";

const URL_RE = /https?:\/\/[^\s<>«»]+/g;

export function makeBot(env: Env) {
  const bot = new Bot(env.BOT_TOKEN, env.BOT_INFO ? { botInfo: JSON.parse(env.BOT_INFO) } : undefined);

  // Owner-only: every other user gets one short refusal and nothing else.
  bot.use(async (ctx, next) => {
    if (!ctx.from || ctx.from.id !== ownerId(env) || ownerId(env) === 0) {
      if (ctx.chat?.type === "private") await ctx.reply(T.notOwner).catch(() => undefined);
      return;
    }
    await next();
  });

  bot.command("start", (ctx) => ctx.reply(T.start));

  bot.command("new", async (ctx) => {
    if (!enabled(env)) return ctx.reply(T.killSwitch);
    await setDraft(env, ctx.chat.id, { step: "channel" });
    const kb = new InlineKeyboard();
    (Object.keys(THEMES) as ChannelId[]).forEach((c, i) => (kb.text(CHANNEL_FA[c]!, `w:ch:${c}`), i % 2 === 1 && kb.row()));
    await ctx.reply(T.pickChannel, { reply_markup: kb });
  });

  bot.command("status", async (ctx) => {
    const j = (await latestActive(env, ctx.chat.id)) ?? (await listJobs(env, 1))[0];
    if (!j) return ctx.reply(T.noJobs);
    await ctx.reply(`کار ${j.id}\n${CHANNEL_FA[j.channel]} · ${TYPE_FA[j.type]} · ${FORMAT_FA[j.format]}\nوضعیت: ${STATUS_FA[j.status] ?? j.status}${j.error ? `\nخطا: ${j.error.slice(0, 500)}` : ""}`);
  });

  bot.command("jobs", async (ctx) => {
    const js = await listJobs(env, 10);
    if (!js.length) return ctx.reply(T.noJobs);
    await ctx.reply(js.map((j) => `${j.id} · ${CHANNEL_FA[j.channel]} · ${STATUS_FA[j.status] ?? j.status}\n  ${j.topic.slice(0, 60)}`).join("\n"));
  });

  bot.command("cancel", async (ctx) => {
    await setDraft(env, ctx.chat.id, null);
    const j = await latestActive(env, ctx.chat.id);
    await ctx.reply(j ? await cancel(env, j.id) : T.nothingToCancel);
  });

  bot.command("quota", async (ctx) => {
    const n = await todayCount(env);
    const cap = Number(env.DAILY_CAP || 6);
    await ctx.reply(`امروز: ${faDigits(n)} از ${faDigits(cap)} ویدیو\nکارخانه: ${enabled(env) ? "روشن" : "خاموش"}\nرندر روی GitHub Actions (مخزن عمومی، رایگان).`);
  });

  bot.command("templates", async (ctx) => {
    const lines = (Object.keys(THEMES) as ChannelId[]).map((c) => {
      const t = THEMES[c];
      return `• ${CHANNEL_FA[c]} — ${faDigits(t.allowedFps.join("/"))} فریم${t.allow4k ? "، 4K" : ""}\n  سبک‌ها: ${t.allowedStyles.map((s) => STYLE_FA[s] ?? s).join("، ")}`;
    });
    await ctx.reply(`قالب‌ها و سبک‌های هر کانال (هرگز با هم ترکیب نمی‌شوند):\n\n${lines.join("\n\n")}`);
  });

  bot.command("panel", async (ctx) => {
    const t = await createMagic(env);
    await ctx.reply(`${T.panelLink}\n${env.PUBLIC_URL.replace(/\/+$/, "")}/auth?t=${t}`, { link_preview_options: { is_disabled: true } });
  });

  /* wizard + review buttons */
  bot.on("callback_query:data", async (ctx) => {
    const d = ctx.callbackQuery.data;
    const chatId = ctx.chat?.id ?? ctx.from.id;
    try {
      if (d.startsWith("w:")) return await wizardStep(env, ctx, chatId, d);
      const [act, stage, id] = d.split(":") as ["a" | "e" | "r", "s" | "p", string];
      if (!id || !(await getJob(env, id))) return void (await ctx.answerCallbackQuery({ text: "کار پیدا نشد" }));
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
      if (act === "a") await ctx.reply(await approve(env, id, stage));
      if (act === "r") await ctx.reply(await reject(env, id));
      if (act === "e") (await setDraft(env, chatId, { step: "edit", editJobId: id }), await ctx.reply(T.askEdit));
      await ctx.answerCallbackQuery();
    } catch (e) {
      await ctx.answerCallbackQuery({ text: "خطا" }).catch(() => undefined);
      await ctx.reply(`خطا: ${(e as Error).message.slice(0, 300)}`);
    }
  });

  bot.on("message:text", async (ctx) => {
    const draft = await getDraft(env, ctx.chat.id);
    if (!draft) return ctx.reply(T.unknown);
    const text = ctx.message.text.trim();
    if (draft.step === "edit" && draft.editJobId) {
      await setDraft(env, ctx.chat.id, null);
      return ctx.reply(await edit(env, draft.editJobId, text));
    }
    if (draft.step !== "topic") return ctx.reply(T.unknown);
    const urls = [...text.matchAll(URL_RE)].map((m) => m[0]);
    const topic = text.replace(URL_RE, "").replace(/\s+\n/g, "\n").trim();
    if (draft.type === "NEWS" && urls.length === 0) return ctx.reply(T.newsNeedsSources);
    const lines = topic.split("\n").map((l) => l.trim()).filter(Boolean);
    const r = await startJob(env, ctx.chat.id, {
      channel: draft.channel,
      type: draft.type,
      format: draft.format,
      durationSec: draft.durationSec ?? 60,
      topic: lines[0] ?? topic,
      points: lines.slice(1),
      sources: urls.map((u) => ({ label: new URL(u).hostname, url: u })),
      fps: draft.channel === "musicradio69" ? 60 : 30,
    });
    await setDraft(env, ctx.chat.id, null);
    await ctx.reply(r.ok ? T.queued(r.id) : T.guardFailed(r.reason));
  });

  return bot;
}

async function wizardStep(env: Env, ctx: Context, chatId: number, d: string) {
  const [, key, val] = d.split(":") as [string, string, string];
  const draft = (await getDraft(env, chatId)) ?? { step: "channel" as const };
  await ctx.answerCallbackQuery();
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
  if (key === "ch") {
    await setDraft(env, chatId, { ...draft, channel: val, step: "type" });
    const kb = new InlineKeyboard();
    for (const t of ["EDUCATIONAL", "PROMO", "NEWS"]) kb.text(TYPE_FA[t]!, `w:ty:${t}`);
    return void (await ctx.reply(`${CHANNEL_FA[val]} ✓\n${T.pickType}`, { reply_markup: kb }));
  }
  if (key === "ty") {
    await setDraft(env, chatId, { ...draft, type: val, step: "format" });
    const kb = new InlineKeyboard().text(FORMAT_FA.landscape_16x9!, "w:fo:landscape_16x9").text(FORMAT_FA.shorts_9x16!, "w:fo:shorts_9x16");
    return void (await ctx.reply(`${TYPE_FA[val]} ✓\n${T.pickFormat}`, { reply_markup: kb }));
  }
  if (key === "fo") {
    await setDraft(env, chatId, { ...draft, format: val, step: "length" });
    const opts = val === "shorts_9x16" ? [20, 30, 45, 58] : [30, 60, 90, 120];
    const kb = new InlineKeyboard();
    for (const s of opts) kb.text(`${faDigits(s)} ثانیه`, `w:le:${s}`);
    return void (await ctx.reply(`${FORMAT_FA[val]} ✓\n${T.pickLength}`, { reply_markup: kb }));
  }
  if (key === "le") {
    await setDraft(env, chatId, { ...draft, durationSec: Number(val), step: "topic" });
    return void (await ctx.reply(T.askTopic));
  }
}
