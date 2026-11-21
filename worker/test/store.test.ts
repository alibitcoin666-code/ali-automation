import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { Store, d1Shim, mediaShim, positional } from "../src/store";

/** Fake DurableObjectState backed by node:sqlite, mimicking ctx.storage.sql.exec cursors. */
function fakeCtx() {
  const db = new DatabaseSync(":memory:");
  const sql = {
    exec(q: string, ...b: unknown[]) {
      const stmts = q.split(";").map((x) => x.trim()).filter(Boolean);
      let rows: Record<string, unknown>[] = [];
      let written = 0;
      stmts.forEach((st, i) => {
        const p = db.prepare(st);
        const args = (i === stmts.length - 1 ? b.map((v) => (Object.prototype.toString.call(v) === "[object ArrayBuffer]" ? new Uint8Array(v as ArrayBuffer) : v === undefined ? null : v)) : []) as never[];
        if (/^\s*(select|with)/i.test(st) || /returning/i.test(st)) rows = (p.all(...args) as Record<string, unknown>[]).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Uint8Array ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : v])));
        else written += Number(p.run(...args).changes);
      });
      return { toArray: () => rows, rowsWritten: written };
    },
  };
  return {
    storage: { sql, transactionSync: <T>(f: () => T) => f() },
    blockConcurrencyWhile: async (f: () => Promise<void>) => f(),
  };
}

describe("Store (Durable Object SQLite) shims", () => {
  const store = new Store(fakeCtx() as never, undefined as never);
  const stub = store as never;
  const DB = d1Shim(stub);
  const MEDIA = mediaShim(stub);

  it("expands D1 ?N placeholders to positional bindings", () => {
    expect(positional("UPDATE t SET a = ?2, b = ?3 WHERE id = ?1 AND c = ?2", [1, "x", "y"])).toEqual({ sql: "UPDATE t SET a = ?, b = ? WHERE id = ? AND c = ?", params: ["x", "y", 1, "x"] });
  });

  it("runs the D1-style job queries", async () => {
    await DB.prepare(`INSERT INTO jobs (id, chat_id, channel, type, format, topic, status, stage, request_json, day, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'guard', ?8, ?9, ?10, ?10)`)
      .bind("20261121-abc123", 7, "pianova", "EDUCATIONAL", "landscape_16x9", "t", "scripting", "{}", "2026-11-21", 1)
      .run();
    const r = await DB.prepare(`UPDATE jobs SET status = ?2 WHERE id = ?1`).bind("20261121-abc123", "script_review").run();
    expect(r.meta.changes).toBe(1);
    expect((await DB.prepare(`SELECT status FROM jobs WHERE id = ?1`).bind("20261121-abc123").first<{ status: string }>())?.status).toBe("script_review");
    expect((await DB.prepare(`SELECT * FROM jobs`).all()).results).toHaveLength(1);
  });

  it("stores blobs and links, lists by prefix", async () => {
    await MEDIA.put("jobs/20261121-abc123/request.json", JSON.stringify({ a: 1 }), { httpMetadata: { contentType: "application/json" } });
    await MEDIA.putLink("jobs/20261121-abc123/out/final.mp4", "https://github.com/o/r/releases/download/job-x/out__final.mp4", 1234, "video/mp4");
    expect(await (await MEDIA.get("jobs/20261121-abc123/request.json"))!.json()).toEqual({ a: 1 });
    expect(MEDIA.head("jobs/20261121-abc123/out/final.mp4")).toMatchObject({ size: 1234 });
    expect((await MEDIA.list({ prefix: "jobs/20261121-abc123/out/" })).objects.map((o) => o.key)).toEqual(["jobs/20261121-abc123/out/final.mp4"]);
  });

  it("queue claims each entry once; owner is set once", () => {
    store.enqueue("20261121-abc123", "script");
    expect(store.claim()).toEqual([{ jobId: "20261121-abc123", stage: "script" }]);
    expect(store.claim()).toEqual([]);
    expect(store.setSettingOnce("owner_id", "42")).toBe("42");
    expect(store.setSettingOnce("owner_id", "99")).toBe("42");
  });
});
