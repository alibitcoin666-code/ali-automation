import { staticFile } from "remotion";

/** Plan asset paths are either absolute URLs or paths relative to the render's public dir. */
export const resolveSrc = (s: string | undefined): string | undefined =>
  !s ? undefined : /^(https?:|data:|blob:)/.test(s) ? s : staticFile(s.replace(/^\/+/, ""));
