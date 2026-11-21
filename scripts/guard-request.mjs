#!/usr/bin/env node
// Independent guard step (defense in depth): fails the workflow if anything in the job targets a protected channel.
import fs from "node:fs";
import path from "node:path";

const PROTECTED = ["youtube.com/@alibaghbani1hand"];
const dir = process.argv[2];
const norm = (s) => s.toLowerCase().replace(/https?:\/\//g, "").replace(/(^|[\s"'])(www\.|m\.)/g, "$1");
let blob = "";
for (const f of ["request.json", "storyboard.json", "edits.json"]) {
  const p = path.join(dir, f);
  if (fs.existsSync(p)) blob += norm(fs.readFileSync(p, "utf8"));
}
for (const t of PROTECTED) if (blob.includes(t)) {
  console.error(`::error::guard: job targets protected channel ${t}`);
  process.exit(1);
}
if ((process.env.FACTORY_ENABLED ?? "true").toLowerCase() !== "true") {
  console.error("::error::guard: FACTORY_ENABLED is off");
  process.exit(1);
}
console.log("[guard] ok");
