/** Data access for the panel. Live mode talks to the Worker API; demo mode reads bundled sample jobs. */
declare const __AMF_DEMO__: boolean;
export const DEMO = __AMF_DEMO__;

export interface JobRow {
  id: string;
  channel: string;
  type: string;
  format: string;
  topic: string;
  status: string;
  stage: string;
  error: string | null;
  created_at: number;
  updated_at: number;
}
export interface JobEvent {
  at: number;
  stage: string;
  status: string;
  data: string | null;
}
export interface JobDetail {
  job: JobRow;
  events: JobEvent[];
  files: Record<string, string>;
}
export interface Me {
  owner: number;
  enabled: boolean;
  today: number;
  cap: number;
}

const base = new URL(".", location.href);
const abs = (u: string) => new URL(u, DEMO ? base : location.origin).href;

async function get<T>(path: string): Promise<T> {
  const r = await fetch(DEMO ? new URL(`demo/${path}`, base) : path, { credentials: "same-origin" });
  if (r.status === 401) throw new AuthError();
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

export class AuthError extends Error {
  constructor() {
    super("unauthorized");
  }
}

export const loadMe = () => (DEMO ? Promise.resolve<Me>({ owner: 0, enabled: true, today: 5, cap: 6 }) : get<Me>("/api/me"));
export const loadJobs = () => get<JobRow[]>(DEMO ? "index.json" : "/api/jobs");
export async function loadJob(id: string): Promise<JobDetail> {
  const d = await get<JobDetail>(DEMO ? `${id}/job.json` : `/api/jobs/${id}`);
  const files: Record<string, string> = {};
  for (const [k, v] of Object.entries(d.files)) files[k] = DEMO ? new URL(`demo/${id}/${v}`, base).href : abs(v);
  return { ...d, files };
}
export async function loadFileJson<T>(url: string | undefined): Promise<T | null> {
  if (!url) return null;
  const r = await fetch(url);
  return r.ok ? ((await r.json()) as T) : null;
}

async function post(path: string, body: unknown) {
  if (DEMO) throw new Error("در نسخه‌ی نمایشی، ساخت و تأیید غیرفعال است.");
  const r = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { message?: string; reason?: string; error?: string; id?: string; ok?: boolean };
  if (!r.ok) throw new Error(j.reason ?? j.error ?? `HTTP ${r.status}`);
  return j;
}
export const createJob = (req: unknown) => post("/api/jobs", req);
export const jobAction = (id: string, action: "approve" | "reject" | "cancel" | "edit", body: Record<string, unknown> = {}) => post(`/api/jobs/${id}/${action}`, body);
