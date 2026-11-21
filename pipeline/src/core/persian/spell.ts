import { foldForMatch } from "../align";
import { hasForbiddenCodepoints, tokenizeWords } from "./normalize";

export interface SpellFlag {
  word: string;
  where: "voice" | "screen";
  sceneId: string;
  reason: string;
}

/**
 * Consistency check. Flags (for the owner to confirm, never auto-fixed):
 *  - forbidden codepoints (Arabic yeh/kaf, kashida, double space, dangling ZWNJ)
 *  - Latin words not in the brand dictionary
 *  - on-screen words that appear neither in the voice script nor the dictionary
 *  - the same word spelled two different ways (with/without ZWNJ)
 *  - immediately repeated words ("و و")
 *  - mixed-script words (Persian + Latin letters in one token)
 */
export function spellCheck(
  scenes: { id: string; voiceText: string; onScreenText: string[] }[],
  dictionary: string[],
): SpellFlag[] {
  const flags: SpellFlag[] = [];
  const dict = new Set(dictionary.map(foldForMatch));
  const voiceVocab = new Set<string>();
  const spellings = new Map<string, Set<string>>();
  for (const s of scenes) for (const w of tokenizeWords(s.voiceText)) voiceVocab.add(foldForMatch(w));

  const check = (text: string, where: "voice" | "screen", sceneId: string) => {
    for (const bad of hasForbiddenCodepoints(text)) flags.push({ word: text, where, sceneId, reason: bad });
    const words = tokenizeWords(text);
    for (let i = 0; i < words.length; i++) {
      const raw = words[i]!.replace(/^[«(]+|[»),.،؛؟!:]+$/g, "");
      if (!raw) continue;
      const f = foldForMatch(raw);
      const key = raw.replace(/\u200C/g, "");
      if (!spellings.has(key)) spellings.set(key, new Set());
      spellings.get(key)!.add(raw);
      if (/[A-Za-z]/.test(raw) && /[\u0600-\u06FF]/.test(raw))
        flags.push({ word: raw, where, sceneId, reason: "mixed-script" });
      else if (/^[A-Za-z]/.test(raw) && !dict.has(f))
        flags.push({ word: raw, where, sceneId, reason: "latin-not-in-dictionary" });
      if (where === "screen" && /[\u0600-\u06FF]/.test(raw) && !voiceVocab.has(f) && !dict.has(f) && raw.length > 2)
        flags.push({ word: raw, where, sceneId, reason: "screen-word-not-in-script-or-dictionary" });
      if (i > 0 && foldForMatch(words[i - 1]!) === f && f.length > 0)
        flags.push({ word: raw, where, sceneId, reason: "repeated-word" });
    }
  };
  for (const s of scenes) {
    check(s.voiceText, "voice", s.id);
    for (const t of s.onScreenText) check(t, "screen", s.id);
  }
  for (const [key, forms] of spellings)
    if (forms.size > 1) flags.push({ word: [...forms].join(" / "), where: "voice", sceneId: "*", reason: `inconsistent-spelling:${key}` });
  return flags;
}
