#!/usr/bin/env node
// Uploads the final deliverables of a job to Google Drive (OAuth refresh token; drive.file scope).
// stdout prints only `DRIVE_URL=<folder link>` so the workflow can append it to $GITHUB_ENV. Logs go to stderr.
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
const { GDRIVE_CLIENT_ID: cid, GDRIVE_CLIENT_SECRET: csec, GDRIVE_REFRESH_TOKEN: rt, GDRIVE_FOLDER_ID: parent } = process.env;
if (!cid || !csec || !rt) {
  console.error("[drive] OAuth secrets missing — skipped");
  process.exit(0);
}
const tok = await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: cid, client_secret: csec, refresh_token: rt, grant_type: "refresh_token" }),
})).json();
if (!tok.access_token) throw new Error(`[drive] token refresh failed: ${tok.error ?? "unknown"}`);
const auth = { authorization: `Bearer ${tok.access_token}` };
const id = path.basename(dir);
const folder = await (await fetch("https://www.googleapis.com/drive/v3/files?fields=id,webViewLink", {
  method: "POST",
  headers: { ...auth, "content-type": "application/json" },
  body: JSON.stringify({ name: `AMF ${id}`, mimeType: "application/vnd.google-apps.folder", ...(parent ? { parents: [parent] } : {}) }),
})).json();
if (!folder.id) throw new Error("[drive] folder create failed");
const outDir = path.join(dir, "out");
const MIME = { mp4: "video/mp4", png: "image/png", jpg: "image/jpeg", srt: "application/x-subrip", txt: "text/plain", json: "application/json" };
for (const f of fs.readdirSync(outDir)) {
  if (/preview-720p/.test(f)) continue;
  const p = path.join(outDir, f);
  const size = fs.statSync(p).size;
  const type = MIME[f.split(".").pop()] ?? "application/octet-stream";
  // resumable upload: session → single PUT (fine for files < 5 GB)
  const init = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
    method: "POST",
    headers: { ...auth, "content-type": "application/json; charset=UTF-8", "x-upload-content-type": type, "x-upload-content-length": String(size) },
    body: JSON.stringify({ name: f, parents: [folder.id] }),
  });
  const loc = init.headers.get("location");
  if (!loc) throw new Error(`[drive] resumable init failed for ${f}: HTTP ${init.status}`);
  const put = await fetch(loc, { method: "PUT", headers: { "content-type": type, "content-length": String(size) }, body: fs.readFileSync(p) });
  if (!put.ok) throw new Error(`[drive] upload failed for ${f}: HTTP ${put.status}`);
  console.error(`[drive] ${f} (${(size / 1e6).toFixed(1)} MB)`);
}
console.log(`DRIVE_URL=${folder.webViewLink ?? `https://drive.google.com/drive/folders/${folder.id}`}`);
