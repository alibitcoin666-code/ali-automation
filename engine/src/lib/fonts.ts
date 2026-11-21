import { loadFont } from "@remotion/fonts";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

/** Every font the engine may use. Variable fonts declare their full weight range. */
export const FONT_FILES = [
  { family: "Vazirmatn", file: "Vazirmatn.woff2", weight: "100 900" },
  { family: "Estedad", file: "Estedad.woff2", weight: "100 900" },
  { family: "Lalezar", file: "Lalezar.woff2", weight: "400" },
  { family: "MarkaziText", file: "MarkaziText.woff2", weight: "400 700" },
  { family: "NotoNaskhArabic", file: "NotoNaskhArabic.woff2", weight: "400 700" },
  { family: "NotoSansArabic", file: "NotoSansArabic.woff2", weight: "100 900" },
  { family: "Cinzel", file: "Cinzel.woff2", weight: "400 900" },
  { family: "CormorantGaramond", file: "CormorantGaramond.woff2", weight: "300 700" },
  { family: "Montserrat", file: "Montserrat.woff2", weight: "100 900" },
  { family: "Orbitron", file: "Orbitron.woff2", weight: "400 900" },
  { family: "Michroma", file: "Michroma.woff2", weight: "400" },
  { family: "PlayfairDisplay", file: "PlayfairDisplay.woff2", weight: "400 900" },
  { family: "Inter", file: "Inter.woff2", weight: "100 900" },
] as const;

export type FontFamily = (typeof FONT_FILES)[number]["family"];

/** CSS font stack: the chosen face first, Persian-capable fallbacks after (never a system font). */
export const stack = (family: string) => `"${family}", "Vazirmatn", "NotoNaskhArabic", "NotoSansArabic"`;

let loaded = false;
const handle = delayRender("Loading all brand fonts", { timeoutInMilliseconds: 60000 });
let resolveReady: () => void = () => {};
export const fontsReady = new Promise<void>((r) => (resolveReady = r));

Promise.all(
  FONT_FILES.map((f) =>
    loadFont({ family: f.family, url: staticFile(`fonts/${f.file}`), weight: f.weight, display: "block", format: "woff2" }),
  ),
)
  .then(async () => {
    await document.fonts.ready;
    // Hard check: a failing face must fail the render, never fall back silently.
    for (const f of FONT_FILES) {
      if (!document.fonts.check(`400 40px "${f.family}"`)) throw new Error(`Font not available after load: ${f.family}`);
    }
    loaded = true;
    resolveReady();
    continueRender(handle);
  })
  .catch((err) => cancelRender(err));

export const fontsLoaded = () => loaded;
