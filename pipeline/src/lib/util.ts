import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const PY = process.env.AMF_PYTHON ?? "python3";

/** Redacts anything that looks like a secret before it reaches a log. */
const SECRET_ENV = ["GEMINI_API_KEY", "CF_API_TOKEN", "TELEGRAM_BOT_TOKEN", "R2_SECRET_ACCESS_KEY", "R2_ACCESS_KEY_ID", "GDRIVE_REFRESH_TOKEN", "GDRIVE_CLIENT_SECRET", "AMF_CALLBACK_SECRET", "GH_DISPATCH_TOKEN"];
export function redact(s: string): string {
  let out = s;
  for (const k of SECRET_ENV) {
    const v = process.env[k];
    if (v && v.length > 6) out = out.split(v).join(`[${k}]`);
  }
  return out.replace(/bot\d{6,}:[A-Za-z0-9_-]{30,}/g, "bot[REDACTED]").replace(/key=[A-Za-z0-9_-]{20,}/g, "key=[REDACTED]");
}
export const log = (...a: unknown[]) => console.log(redact(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ")));

export function run(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv; quiet?: boolean; input?: string } = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: opts.cwd, env: { ...process.env, ...opts.env }, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => {
      stderr += d;
      if (!opts.quiet) process.stderr.write(redact(String(d)));
    });
    if (opts.input) p.stdin.end(opts.input);
    else p.stdin.end();
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${cmd} exited ${code}: ${redact(stderr.slice(-2000))}`))));
  });
}

export const sha256 = (s: string | Buffer) => crypto.createHash("sha256").update(s).digest("hex");
export const readJson = <T = unknown>(p: string): T => JSON.parse(fs.readFileSync(p, "utf8")) as T;
export const writeJson = (p: string, v: unknown) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2));
};
export const ensureDir = (p: string) => (fs.mkdirSync(p, { recursive: true }), p);

export async function withRetry<T>(label: string, fn: (attempt: number) => Promise<T>, tries = 3, baseMs = 1500): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn(i);
    } catch (e) {
      last = e;
      log(`[retry] ${label} attempt ${i}/${tries} failed: ${(e as Error).message?.slice(0, 300)}`);
      if (i < tries) await new Promise((r) => setTimeout(r, baseMs * 2 ** (i - 1)));
    }
  }
  throw last;
}

/** Job workspace on disk; mirrored to R2 jobs/<id>/ by the runner. */
export class JobDir {
  constructor(public id: string, public base = path.join(process.env.AMF_WORK ?? path.join(ROOT, ".work"), "jobs", id)) {
    ensureDir(base);
  }
  p(...parts: string[]) {
    const f = path.join(this.base, ...parts);
    ensureDir(path.dirname(f));
    return f;
  }
  has(...parts: string[]) {
    return fs.existsSync(path.join(this.base, ...parts));
  }
}
