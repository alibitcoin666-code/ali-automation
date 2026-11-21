#!/usr/bin/env node
// Cloud end-to-end test: creates a real job through the Worker (same guard / cap / queue as the bot),
// waits for each review point and approves it, then waits for delivery and prints the QA lines.
// This is a TEST harness — the bot path still requires the owner's Approve for every real job.
import { rpc } from "./amf-rpc.mjs";

const request = JSON.parse(process.env.E2E_REQUEST);
const wait = async (id, want, minutes) => {
  const end = Date.now() + minutes * 60_000;
  let last = "";
  while (Date.now() < end) {
    const { job } = await rpc({ op: "job", id });
    if (job.status !== last) console.log(`[e2e] ${id}: ${(last = job.status)}`);
    if (want.includes(job.status)) return job;
    if (["failed", "rejected", "cancelled"].includes(job.status)) throw new Error(`job ${id} ${job.status}: ${job.error ?? ""}`);
    await new Promise((r) => setTimeout(r, 20_000));
  }
  throw new Error(`timeout waiting for ${want.join("/")}`);
};

const r = await rpc({ op: "createJob", request });
if (!r.ok) throw new Error(`guard refused: ${r.reason}`);
const id = r.id;
console.log(`[e2e] created ${id}`);
console.log(`::notice::e2e job ${id}`);
await wait(id, ["script_review"], 30);
console.log((await rpc({ op: "approve", id, stage: "s" })).message);
await wait(id, ["preview_review"], 60);
console.log((await rpc({ op: "approve", id, stage: "p" })).message);
await wait(id, ["delivered"], 90);
const { events } = await rpc({ op: "job", id });
const fin = events.filter((e) => e.stage === "final" && e.status === "ok").pop();
const qa = fin?.data ? JSON.parse(fin.data).qa : null;
console.log((qa?.lines ?? ["(no QA lines)"]).join("\n"));
console.log(`[e2e] files: https://github.com/${process.env.GITHUB_REPOSITORY}/releases/tag/job-${id}`);
if (!qa?.pass) process.exit(1);
