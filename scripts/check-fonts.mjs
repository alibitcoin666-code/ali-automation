#!/usr/bin/env node
// CI: only OFL fonts may ship; the forbidden commercial Persian families must never appear in the repo.
import fs from "node:fs";
import path from "node:path";

const FORBIDDEN = /iransans|yekan\s*bakh|yekanbakh|\bdana\b|peyda|kalameh|morabba/i;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const fontsDir = path.join(root, "brands/_fonts");
let bad = 0;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
for (const f of walk(fontsDir)) {
  if (FORBIDDEN.test(path.basename(f))) (console.error(`::error file=${f}::forbidden font file`), bad++);
}
const lic = fs.readFileSync(path.join(fontsDir, "LICENSES.md"), "utf8");
for (const f of fs.readdirSync(path.join(fontsDir, "woff2"))) {
  const fam = f.replace(/\.woff2$/, "");
  if (!lic.includes(fam)) (console.error(`::error::font ${fam} missing from LICENSES.md`), bad++);
}
for (const b of fs.readdirSync(path.join(root, "brands")).filter((d) => !d.startsWith("_"))) {
  const t = JSON.parse(fs.readFileSync(path.join(root, "brands", b, "theme.json"), "utf8"));
  for (const v of Object.values(t.fonts)) if (FORBIDDEN.test(String(v))) (console.error(`::error::brand ${b} uses forbidden font ${v}`), bad++);
}
if (bad) process.exit(1);
console.log("[fonts] OFL only — ok");
