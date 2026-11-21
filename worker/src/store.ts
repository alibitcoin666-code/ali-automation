import { DurableObject } from "cloudflare:workers";
import { SCHEMA } from "./schema";

/**
 * Storage backend that needs no extra Cloudflare products or token permissions:
 * one SQLite-backed Durable Object (available on Workers Free, 5 GB per account, 8 MB per BLOB —
 * https://developers.cloudflare.com/durable-objects/platform/limits/).
 *
 * - `DB`    — a small D1-compatible shim (prepare/bind/run/first/all/batch) over ctx.storage.sql.
 * - `MEDIA` — an R2-like shim: small blobs (JSON, PNG, SRT) are stored in SQLite; large media
 *             (MP4 / M4A) live as GitHub Release assets and are stored here as links, then streamed
 *             through the Worker with Range support.
 */

const EXTRA_SCHEMA = `
CREATE TABLE IF NOT EXISTS blobs (key TEXT PRIMARY KEY, data BLOB, url TEXT, size INTEGER NOT NULL, ctype TEXT, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS queue (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL, stage TEXT NOT NULL, created_at INTEGER NOT NULL, claimed_at INTEGER);
CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL);
`;

type Mode = "run" | "first" | "all";
export interface Q {
  sql: string;
  params: unknown[];
  mode: Mode;
}

/** D1 uses ?NNN placeholders; DO SQL uses positional `?`. Expand numbered params into a positional list. */
export function positional(sql: string, params: unknown[]): { sql: string; params: unknown[] } {
  const out: unknown[] = [];
  const s = sql.replace(/\?(\d+)/g, (_m, n: string) => (out.push(params[Number(n) - 1] ?? null), "?"));
  return { sql: s, params: /\?\d/.test(sql) ? out : params };
}

export class Store extends DurableObject {
  constructor(ctx: DurableObjectState, env: never) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(SCHEMA);
      ctx.storage.sql.exec(EXTRA_SCHEMA);
    });
  }

  private one(q: Q) {
    const { sql, params } = positional(q.sql, q.params);
    const cur = this.ctx.storage.sql.exec(sql, ...(params as SqlStorageValue[]));
    const rows = cur.toArray();
    return { rows, changes: cur.rowsWritten };
  }

  query(q: Q) {
    const r = this.one(q);
    if (q.mode === "first") return { row: r.rows[0] ?? null, changes: r.changes };
    if (q.mode === "all") return { rows: r.rows, changes: r.changes };
    return { changes: r.changes };
  }

  batch(qs: Q[]) {
    return this.ctx.storage.transactionSync(() => qs.map((q) => this.query(q)));
  }

  putBlob(key: string, data: ArrayBuffer | null, url: string | null, size: number, ctype: string) {
    this.ctx.storage.sql.exec(
      `INSERT INTO blobs (key, data, url, size, ctype, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET data = excluded.data, url = excluded.url, size = excluded.size, ctype = excluded.ctype, updated_at = excluded.updated_at`,
      key, data, url, size, ctype, Date.now(),
    );
  }

  getBlob(key: string): { data: ArrayBuffer | null; url: string | null; size: number; ctype: string } | null {
    const r = this.ctx.storage.sql.exec(`SELECT data, url, size, ctype FROM blobs WHERE key = ?`, key).toArray()[0];
    return r ? { data: (r.data as ArrayBuffer | null) ?? null, url: (r.url as string | null) ?? null, size: r.size as number, ctype: (r.ctype as string) ?? "" } : null;
  }

  headBlob(key: string) {
    const r = this.ctx.storage.sql.exec(`SELECT size, ctype, url FROM blobs WHERE key = ?`, key).toArray()[0];
    return r ? { size: r.size as number, ctype: (r.ctype as string) ?? "", url: (r.url as string | null) ?? null } : null;
  }

  listBlobs(prefix: string, limit: number) {
    return this.ctx.storage.sql
      .exec(`SELECT key, size FROM blobs WHERE substr(key, 1, ?) = ? ORDER BY key LIMIT ?`, prefix.length, prefix, limit)
      .toArray() as { key: string; size: number }[];
  }

  /* render queue — the Actions dispatcher claims entries (the Worker holds no GitHub token) */
  enqueue(jobId: string, stage: string) {
    this.ctx.storage.sql.exec(`INSERT INTO queue (job_id, stage, created_at) VALUES (?, ?, ?)`, jobId, stage, Date.now());
  }

  claim(max = 4) {
    return this.ctx.storage.transactionSync(() => {
      const rows = this.ctx.storage.sql.exec(`SELECT id, job_id, stage FROM queue WHERE claimed_at IS NULL ORDER BY id LIMIT ?`, max).toArray();
      for (const r of rows) this.ctx.storage.sql.exec(`UPDATE queue SET claimed_at = ? WHERE id = ?`, Date.now(), r.id as number);
      return rows.map((r) => ({ jobId: r.job_id as string, stage: r.stage as string }));
    });
  }

  getSetting(k: string): string | null {
    return (this.ctx.storage.sql.exec(`SELECT v FROM settings WHERE k = ?`, k).toArray()[0]?.v as string | undefined) ?? null;
  }

  /** Sets a setting only if absent (first-claim semantics). Returns the stored value. */
  setSettingOnce(k: string, v: string): string {
    this.ctx.storage.sql.exec(`INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO NOTHING`, k, v);
    return this.getSetting(k)!;
  }
}

/* ------------------------------------------------------------------ */
/* Shims used by the rest of the Worker                                 */
/* ------------------------------------------------------------------ */

export type StoreStub = DurableObjectStub<Store>;
export const storeStub = (ns: DurableObjectNamespace<Store>): StoreStub => ns.get(ns.idFromName("amf-main"));

class Stmt {
  constructor(private s: StoreStub, public sql: string, public params: unknown[] = []) {}
  bind(...p: unknown[]) {
    return new Stmt(this.s, this.sql, p);
  }
  q(mode: Mode): Q {
    return { sql: this.sql, params: this.params, mode };
  }
  async run() {
    const r = await this.s.query(this.q("run"));
    return { meta: { changes: r.changes ?? 0 } };
  }
  async first<T = Record<string, unknown>>() {
    return ((await this.s.query(this.q("first"))).row ?? null) as T | null;
  }
  async all<T = Record<string, unknown>>() {
    return { results: ((await this.s.query(this.q("all"))).rows ?? []) as T[] };
  }
}

export function d1Shim(s: StoreStub) {
  return {
    prepare: (sql: string) => new Stmt(s, sql),
    batch: async (stmts: Stmt[]) => s.batch(stmts.map((x) => x.q("run"))),
  };
}
export type DbShim = ReturnType<typeof d1Shim>;

export interface MediaObject {
  key: string;
  size: number;
  ctype: string;
  url: string | null;
  data: ArrayBuffer | null;
  json<T>(): Promise<T>;
  text(): Promise<string>;
}

export function mediaShim(s: StoreStub) {
  return {
    async put(key: string, body: string | ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }) {
      const buf = typeof body === "string" ? new TextEncoder().encode(body).buffer : body;
      await s.putBlob(key, buf as ArrayBuffer, null, buf.byteLength, opts?.httpMetadata?.contentType ?? "");
    },
    async putLink(key: string, url: string, size: number, ctype = "") {
      await s.putBlob(key, null, url, size, ctype);
    },
    async get(key: string): Promise<MediaObject | null> {
      const b = await s.getBlob(key);
      if (!b) return null;
      const text = async () => (b.data ? new TextDecoder().decode(b.data) : b.url ? await (await fetch(b.url)).text() : "");
      return { key, ...b, text, json: async <T>() => JSON.parse(await text()) as T };
    },
    head: (key: string) => s.headBlob(key),
    async list(o: { prefix: string; limit?: number }) {
      return { objects: await s.listBlobs(o.prefix, o.limit ?? 1000) };
    },
  };
}
export type MediaShim = ReturnType<typeof mediaShim>;
