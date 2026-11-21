#!/usr/bin/env node
// HMAC-signed client for the Worker's POST /cb/rpc (same scheme as scripts/callback.mjs):
//   X-AMF-Timestamp: unix seconds, X-AMF-Signature: hex HMAC-SHA256(CALLBACK_SECRET, ts + "." + body)
// CLI:  node scripts/amf-rpc.mjs claim
//       node scripts/amf-rpc.mjs get <key> <outFile>
//       node scripts/amf-rpc.mjs put <key> <file> [contentType]
import crypto from "node:crypto";
import fs from "node:fs";

export function rpcUrl() {
  const base = (process.env.AMF_PUBLIC_URL || "").replace(/\/+$/, "");
  return base ? `${base}/cb/rpc` : "";
}

export async function rpc(call, { raw = false } = {}) {
  const url = rpcUrl();
  const secret = process.env.CALLBACK_SECRET;
  if (!url || !secret) throw new Error("AMF_PUBLIC_URL / CALLBACK_SECRET not set");
  const body = JSON.stringify(call);
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-amf-timestamp": ts, "x-amf-signature": sig }, body });
    if (res.status === 404 && call.op === "getBlob") return null;
    if (res.ok) return raw ? Buffer.from(await res.arrayBuffer()) : res.json();
    last = new Error(`rpc ${call.op} → HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    if (res.status < 500) break;
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw last;
}

/** Downloads a stored object; follows release-asset links. Returns false when absent. */
export async function getTo(key, out) {
  const r = await rpc({ op: "getBlob", key }, { raw: true });
  if (!r) return false;
  const buf = r; // release-asset links are answered with a 302 that fetch follows
  fs.writeFileSync(out, buf);
  return true;
}

export const putFile = (key, file, ctype = "") => rpc({ op: "putBlob", key, b64: fs.readFileSync(file).toString("base64"), ctype });

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === "claim") console.log(JSON.stringify(await rpc({ op: "claim", max: 4 })));
  else if (cmd === "get") process.exit((await getTo(a, b)) ? 0 : 3);
  else if (cmd === "put") console.log(JSON.stringify(await putFile(a, b, c)));
  else {
    console.error("usage: amf-rpc.mjs claim | get <key> <out> | put <key> <file> [ctype]");
    process.exit(2);
  }
}
