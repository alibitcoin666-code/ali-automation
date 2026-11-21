import type { Env } from "./env";

export interface JobRow {
  id: string;
  chat_id: number;
  channel: string;
  type: string;
  format: string;
  topic: string;
  status: string;
  stage: string;
  request_json: string;
  script_hash: string | null;
  edit_note: string | null;
  error: string | null;
  day: string;
  created_at: number;
  updated_at: number;
}

/** Calendar day in the owner's timezone (Asia/Tehran) — the daily cap resets at local midnight. */
export const tehranDay = (t = Date.now()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));

export function newJobId(t = Date.now()): string {
  const d = tehranDay(t).replace(/-/g, "");
  const r = crypto.getRandomValues(new Uint8Array(4));
  return `${d}-${[...r].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 6)}`;
}

export const ACTIVE = ["queued", "scripting", "script_review", "preview_rendering", "preview_review", "final_rendering", "qa"];

export async function createJob(env: Env, j: Omit<JobRow, "created_at" | "updated_at" | "day" | "stage" | "script_hash" | "edit_note" | "error">) {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO jobs (id, chat_id, channel, type, format, topic, status, stage, request_json, day, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'guard', ?8, ?9, ?10, ?10)`,
  )
    .bind(j.id, j.chat_id, j.channel, j.type, j.format, j.topic, j.status, j.request_json, tehranDay(now), now)
    .run();
  await event(env, j.id, "guard", "ok");
}

export async function getJob(env: Env, id: string) {
  return env.DB.prepare(`SELECT * FROM jobs WHERE id = ?1`).bind(id).first<JobRow>();
}

export async function listJobs(env: Env, limit = 20) {
  const r = await env.DB.prepare(`SELECT * FROM jobs ORDER BY updated_at DESC LIMIT ?1`).bind(limit).all<JobRow>();
  return r.results;
}

export async function latestActive(env: Env, chatId: number) {
  return env.DB.prepare(`SELECT * FROM jobs WHERE chat_id = ?1 AND status IN (${ACTIVE.map((s) => `'${s}'`).join(",")}) ORDER BY updated_at DESC LIMIT 1`)
    .bind(chatId)
    .first<JobRow>();
}

export async function setStatus(env: Env, id: string, status: string, stage?: string, extra: Partial<Pick<JobRow, "error" | "script_hash" | "edit_note">> = {}) {
  const sets = ["status = ?2", "updated_at = ?3"];
  const vals: unknown[] = [id, status, Date.now()];
  if (stage) (sets.push(`stage = ?${vals.length + 1}`), vals.push(stage));
  for (const [k, v] of Object.entries(extra)) (sets.push(`${k} = ?${vals.length + 1}`), vals.push(v ?? null));
  await env.DB.prepare(`UPDATE jobs SET ${sets.join(", ")} WHERE id = ?1`).bind(...vals).run();
  await event(env, id, stage ?? status, status);
}

export async function event(env: Env, jobId: string, stage: string, status: string, data?: unknown) {
  await env.DB.prepare(`INSERT INTO events (job_id, at, stage, status, data) VALUES (?1, ?2, ?3, ?4, ?5)`)
    .bind(jobId, Date.now(), stage, status, data === undefined ? null : JSON.stringify(data))
    .run();
}

export async function events(env: Env, jobId: string) {
  return (await env.DB.prepare(`SELECT at, stage, status, data FROM events WHERE job_id = ?1 ORDER BY at`).bind(jobId).all()).results;
}

export async function todayCount(env: Env) {
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM jobs WHERE day = ?1 AND status != 'cancelled'`).bind(tehranDay()).first<{ n: number }>();
  return r?.n ?? 0;
}

/* wizard state */
export interface Draft {
  step: "channel" | "type" | "format" | "length" | "topic" | "edit";
  channel?: string;
  type?: string;
  format?: string;
  durationSec?: number;
  editJobId?: string;
}

export async function getDraft(env: Env, chatId: number): Promise<Draft | null> {
  const r = await env.DB.prepare(`SELECT state FROM drafts WHERE chat_id = ?1`).bind(chatId).first<{ state: string }>();
  return r ? (JSON.parse(r.state) as Draft) : null;
}
export async function setDraft(env: Env, chatId: number, d: Draft | null) {
  if (!d) return void (await env.DB.prepare(`DELETE FROM drafts WHERE chat_id = ?1`).bind(chatId).run());
  await env.DB.prepare(`INSERT INTO drafts (chat_id, state, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(chat_id) DO UPDATE SET state = ?2, updated_at = ?3`)
    .bind(chatId, JSON.stringify(d), Date.now())
    .run();
}
