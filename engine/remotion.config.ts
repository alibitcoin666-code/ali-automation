import { Config } from "@remotion/cli/config";
import path from "node:path";

const engineModules = path.resolve(process.cwd(), "node_modules");

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setColorSpace("bt709");
Config.setChromiumOpenGlRenderer("angle");
Config.setPublicDir(path.resolve(process.cwd(), "public"));
Config.setEntryPoint("src/index.ts");
Config.overrideWebpackConfig((c) => ({
  ...c,
  resolve: {
    ...c.resolve,
    // /styles and /templates live outside /engine; resolve their imports from the engine's node_modules
    // so there is exactly one copy of react and remotion in the bundle.
    modules: [engineModules, "node_modules"],
    symlinks: true,
  },
}));
