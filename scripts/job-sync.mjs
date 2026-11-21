#!/usr/bin/env node
// Moves job state between the Worker (small JSON blobs in the Durable Object) and the runner,
// and publishes deliverables as GitHub Release assets (tag job-<id>, pre-release).
//   node scripts/job-sync.mjs pull <jobDir>
//   node scripts/job-sync.mjs push <jobDir> <stage>
// Needs: AMF_PUBLIC_URL, CALLBACK_SECRET, GH_TOKEN (contents: write), GITHUB_REPOSITORY.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { getTo, putFile, rpc } from "./amf-rpc.mjs";

const [cmd, dir, stage] = process.argv.slice(2);
if (!cmd || !dir) {
  console.error("usage: job-sync.mjs pull|push <jobDir> [stage]");
  process.exit(2);
}
const id = path.basename(dir);
const repo = process.env.GITHUB_REPOSITORY;
const tag = `job-${id}`;
const key = (rel) => `jobs/${id}/${rel}`;
const gh = (args, opts = {}) => execFileSync("gh", args, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", ...opts });

const SMALL = ["request.json", "edits.json", "storyboard.json"];
const CTYPE = { mp4: "video/mp4", m4a: "audio/mp4", png: "image/png", jpg: "image/jpeg", json: "application/json", srt: "application/x-subrip; charset=utf-8", txt: "text/plain; charset=utf-8", vtt: "text/vtt; charset=utf-8" };
const ctypeOf = (f) => CTYPE[f.split(".").pop()] ?? "application/octet-stream";

function releaseExists() {
  try {
    gh(["release", "view", tag, "-R", repo, "--json", "tagName"]);
    return true;
  } catch {
    return false;
  }
}

if (cmd === "pull") {
  fs.mkdirSync(dir, { recursive: true });
  if (releaseExists()) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "amf-state-"));
    try {
      gh(["release", "download", tag, "-R", repo, "-p", "state.tgz", "-D", tmp, "--clobber"]);
      execFileSync("tar", ["-xzf", path.join(tmp, "state.tgz"), "-C", dir]);
      console.log(`[sync] restored state.tgz from ${tag}`);
    } catch {
      console.log("[sync] no state.tgz yet");
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  for (const rel of SMALL) {
    const ok = await getTo(key(rel), path.join(dir, rel));
    console.log(`[sync] ${rel}: ${ok ? "pulled" : "absent"}`);
  }
  process.exit(0);
}

if (cmd === "push") {
  if (!releaseExists()) {
    gh(["release", "create", tag, "-R", repo, "--prerelease", "--latest=false", "--title", `job ${id}`, "--notes", `ALI MOTION FACTORY job ${id}. Review files — nothing here is final until approved in Telegram/panel.`]);
  }
  // 1) resumable state for the next stage (voice, alignment, mix, plans) — bulky intermediates stay out.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "amf-up-"));
  const state = path.join(tmp, "state.tgz");
  execFileSync("tar", ["-czf", state, "-C", dir, "--exclude=./out", "--exclude=./public", "--exclude=./stills", "--exclude=./qa/proof", "--exclude=*.mov", "--exclude=*silent*", "--exclude=./align/*.wav", "."]);
  const uploads = [state];
  // 2) reviewable deliverables
  const want = [];
  const walk = (rel) => {
    const abs = path.join(dir, rel);
    if (!fs.existsSync(abs)) return;
    if (fs.statSync(abs).isDirectory()) return fs.readdirSync(abs).forEach((f) => walk(path.posix.join(rel, f)));
    want.push(rel);
  };
  ["out", "qa/report.json", "qa/proof-sheet.png", "audio/final.m4a", "render/plan-preview.json", "render/plan-final.json", "storyboard.json"].forEach(walk);
  const links = [];
  for (const rel of want) {
    const abs = path.join(dir, rel);
    const size = fs.statSync(abs).size;
    if (size <= 900 * 1024 && /\.(json|srt|txt|vtt|png|jpg)$/.test(rel)) {
      await putFile(key(rel), abs, ctypeOf(rel));
      continue;
    }
    const name = rel.replace(/\//g, "__");
    const flat = path.join(tmp, name);
    fs.copyFileSync(abs, flat);
    uploads.push(flat);
    links.push({ rel, name, size });
  }
  for (let i = 0; i < uploads.length; i += 8) gh(["release", "upload", tag, "-R", repo, "--clobber", ...uploads.slice(i, i + 8)], { maxBuffer: 1 << 26 });
  for (const l of links) await rpc({ op: "putLink", key: key(l.rel), url: `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(l.name)}`, size: l.size, ctype: ctypeOf(l.rel) });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`[sync] ${stage ?? ""}: ${want.length} file(s) published, ${links.length} as release assets`);
  process.exit(0);
}
console.error("unknown command");
process.exit(2);
