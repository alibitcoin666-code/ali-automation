import { tokenizeWords } from "./persian/normalize";
import { spokenForm } from "./persian/numbers";

/**
 * An alignment unit: one or more consecutive script words that are spoken as one
 * pronunciation (e.g. "Music Radio 69" → «موزیک رادیو شصت و نه»).
 */
export interface SpokenUnit {
  wordIdx: number[]; // indices into the scene's script words
  spoken: string; // what the TTS says (Persian letters)
}

const strip = (w: string) => w.replace(/^[«(“"']+|[»)”"'.,،؛؟!:]+$/g, "");

/** Build spoken units for a scene, applying the brand pronunciation map (longest phrase first). */
export function spokenUnits(voiceText: string, pron: Record<string, string>): { words: string[]; units: SpokenUnit[] } {
  const words = tokenizeWords(voiceText);
  const phrases = Object.entries(pron)
    .map(([k, v]) => ({ k: tokenizeWords(k).map((x) => strip(x).toLowerCase()), v }))
    .sort((a, b) => b.k.length - a.k.length);
  const units: SpokenUnit[] = [];
  for (let i = 0; i < words.length; ) {
    let hit: { n: number; v: string } | null = null;
    for (const p of phrases) {
      const n = p.k.length;
      if (i + n > words.length) continue;
      let ok = true;
      for (let j = 0; j < n; j++) if (strip(words[i + j]!).toLowerCase() !== p.k[j]) ok = false;
      if (ok) {
        hit = { n, v: p.v };
        break;
      }
    }
    if (hit) {
      units.push({ wordIdx: Array.from({ length: hit.n }, (_, j) => i + j), spoken: hit.v });
      i += hit.n;
    } else {
      units.push({ wordIdx: [i], spoken: spokenForm(strip(words[i]!)) || strip(words[i]!) });
      i++;
    }
  }
  return { words, units };
}

/** TTS input text: the script with pronunciations substituted, punctuation kept for prosody. */
export function ttsText(voiceText: string, pron: Record<string, string>): string {
  const { words, units } = spokenUnits(voiceText, pron);
  return units
    .map((u) => {
      const last = words[u.wordIdx[u.wordIdx.length - 1]!]!;
      const first = words[u.wordIdx[0]!]!;
      const pre = first.match(/^[«(“"]+/)?.[0] ?? "";
      const post = last.match(/[»)”".,،؛؟!:]+$/)?.[0] ?? "";
      return pre + u.spoken + post;
    })
    .join(" ");
}
