import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "../..");
const demo = process.env.AMF_PANEL_DEMO === "1";

/** Copies OFL fonts (and demo jobs for the static demo build) next to the bundle. */
const copyStatic = (outDir: string) => ({
  name: "amf-copy-static",
  closeBundle() {
    const fonts = path.join(root, "brands/_fonts/woff2");
    fs.mkdirSync(path.join(outDir, "fonts"), { recursive: true });
    for (const f of fs.readdirSync(fonts)) fs.copyFileSync(path.join(fonts, f), path.join(outDir, "fonts", f));
    if (demo) fs.cpSync(path.join(root, ".work/panel-demo"), path.join(outDir, "demo"), { recursive: true });
  },
});

export default defineConfig(({ mode }) => {
  const outDir = demo ? path.join(root, "worker/dist-demo") : path.join(root, "worker/dist/panel");
  return {
    root: here,
    base: "./",
    define: { __AMF_DEMO__: JSON.stringify(demo) },
    plugins: [react(), copyStatic(outDir)],
    resolve: { dedupe: ["react", "react-dom", "remotion", "zod"] },
    build: { outDir, emptyOutDir: true, chunkSizeWarningLimit: 4000, sourcemap: mode !== "production" },
  };
});
