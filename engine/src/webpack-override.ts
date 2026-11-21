import path from "node:path";
import type { WebpackOverrideFn } from "@remotion/bundler";

export const engineRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

export const webpackOverride: WebpackOverrideFn = (c) => ({
  ...c,
  resolve: { ...c.resolve, modules: [path.join(engineRoot, "node_modules"), "node_modules"], symlinks: true },
});
