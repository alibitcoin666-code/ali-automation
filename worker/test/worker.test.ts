import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { verifyCallback, signMedia, verifyMedia, safeEqual } from "../src/crypto";
import { guardRequest } from "../src/jobs";
import { tehranDay, newJobId } from "../src/db";
import type { Env } from "../src/env";

const env = { FACTORY_ENABLED: "true" } as unknown as Env;
const base = { channel: "pianova", type: "EDUCATIONAL", format: "landscape_16x9", topic: "آکورد مینور", durationSec: 60, fps: 30 };

describe("callback signature (matches scripts/callback.mjs)", () => {
  it("accepts a valid HMAC and rejects tampering / replay", async () => {
    const body = JSON.stringify({ jobId: "20261121-abc123", stage: "script", status: "ok" });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = crypto.createHmac("sha256", "s3cret").update(`${ts}.${body}`).digest("hex");
    expect(await verifyCallback("s3cret", ts, sig, body)).toBe(true);
    expect(await verifyCallback("s3cret", ts, sig, body.replace("ok", "failed"))).toBe(false);
    expect(await verifyCallback("other", ts, sig, body)).toBe(false);
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    const sigOld = crypto.createHmac("sha256", "s3cret").update(`${old}.${body}`).digest("hex");
    expect(await verifyCallback("s3cret", old, sigOld, body)).toBe(false);
  });
});

describe("signed media links", () => {
  it("round-trips and rejects other keys", async () => {
    const link = await signMedia("k", "jobs/20261121-abc123/out/final.mp4");
    const u = new URL(link, "https://x.dev");
    const key = decodeURIComponent(u.pathname.slice(3));
    expect(await verifyMedia("k", key, u.searchParams.get("e"), u.searchParams.get("s"))).toBe(true);
    expect(await verifyMedia("k", "jobs/other/out/final.mp4", u.searchParams.get("e"), u.searchParams.get("s"))).toBe(false);
    expect(safeEqual("abc", "abd")).toBe(false);
  });
});

describe("worker guard", () => {
  it("accepts a normal request", () => expect(guardRequest(env, base).ok).toBe(true));
  it("blocks the protected channel", () => {
    for (const target of ["https://www.youtube.com/@Alibaghbani1hand", "youtube.com/@ALIBAGHBANI1HAND/"]) expect(guardRequest(env, { ...base, target }).ok).toBe(false);
    expect(guardRequest(env, { ...base, topic: "ویدیو برای youtube.com/@alibaghbani1hand" }).ok).toBe(false);
  });
  it("honours the kill switch", () => expect(guardRequest({ FACTORY_ENABLED: "false" } as unknown as Env, base).ok).toBe(false));
  it("never mixes brands", () => expect(guardRequest(env, { ...base, channel: "onehandonedream", style: "neonGlow" }).ok).toBe(false));
  it("requires sources for NEWS", () => expect(guardRequest(env, { ...base, channel: "neutral", type: "NEWS" }).ok).toBe(false));
});

describe("ids", () => {
  it("job ids match the workflow input pattern", () => {
    for (let i = 0; i < 50; i++) expect(newJobId()).toMatch(/^[0-9]{8}-[0-9a-z]{6}$/);
    expect(tehranDay(Date.UTC(2026, 2, 20, 21, 0))).toBe("2026-03-21"); // 00:30 Tehran
  });
});
