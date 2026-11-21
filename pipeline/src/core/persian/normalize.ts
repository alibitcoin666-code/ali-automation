/**
 * Persian text normalization. Pure and deterministic; applied exactly once,
 * at script approval time. After approval, text is never modified again.
 */

export const ZWNJ = "\u200C";
export const LRM = "\u200E";
export const RLM = "\u200F";
export const NBSP = "\u00A0";

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

const CHAR_MAP: Record<string, string> = {
  "ي": "ی", // Arabic yeh
  "ى": "ی", // alef maksura
  "ك": "ک", // Arabic kaf
  "ە": "ه",
  "ۀ": "هٔ",
  "\u0640": "", // tatweel / kashida is never allowed
};

const SUFFIXES = [
  "هایشان",
  "هایتان",
  "هایمان",
  "هایش",
  "هایت",
  "هایم",
  "هایی",
  "های",
  "ها",
  "ترین",
  "تری",
  "تر",
];

/** Replace Arabic codepoints with Persian ones, remove kashida, unify spaces. */
export function normalizeChars(input: string): string {
  let s = input.normalize("NFC");
  s = s.replace(/[يىكەۀ\u0640]/g, (c) => CHAR_MAP[c] ?? c);
  s = s.replace(/[٠-٩]/g, (d) => FA_DIGITS[AR_DIGITS.indexOf(d)]!);
  // Unify exotic spaces, keep ZWNJ
  s = s.replace(/[\u2000-\u200B\u202F\u205F\u3000\t]/g, " ");
  // Remove bidi controls coming from copy/paste (we add our own where needed)
  s = s.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");
  // Collapse repeated ZWNJ, ZWNJ next to space
  s = s.replace(/\u200C+/g, ZWNJ);
  // A ZWNJ next to a space or at a word edge is meaningless: drop it, keep the space.
  s = s.replace(/ +\u200C|\u200C +/g, " ").replace(/^\u200C|\u200C$/g, "");
  s = s.replace(/ {2,}/g, " ");
  return s.trim();
}

const PERSIAN_LETTER = "[\\u0600-\\u06FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]";
const RE_LETTER = new RegExp(PERSIAN_LETTER);

/** Fix ZWNJ for verbal prefixes and plural / comparative suffixes. */
export function fixZwnj(input: string): string {
  let s = input;
  // می / نمی + space + verb  →  می‌verb. Only when the prefix is a standalone token.
  for (const p of ["نمی", "می"]) {
    const re = new RegExp(`(^|[\\s«(])${p} (?=${PERSIAN_LETTER})`, "g");
    s = s.replace(re, `$1${p}${ZWNJ}`);
  }
  // Already glued forms like «میخواهم»/«نمیدانم» → insert ZWNJ when followed by a common verb stem start.
  s = s.replace(
    new RegExp(`(^|[\\s«(])(ن?می)(خواه|توان|کن|شو|گوی|آموز|نواز|سازی|گیر|خوان|نویس|شنو|پرداز|گذار|یاب)`, "g"),
    (_m, pre, p, stem) => `${pre}${p}${ZWNJ}${stem}`,
  );
  // word + space + suffix → word‌suffix (only when suffix is a standalone token)
  for (const suf of SUFFIXES) {
    const re = new RegExp(`(${PERSIAN_LETTER}) ${suf}(?=$|[\\s.,،؛؟!:»)\\]])`, "g");
    s = s.replace(re, `$1${ZWNJ}${suf}`);
  }
  // Ezafe-like "ه ای" / "ه ام" → "ه‌ای" / "ه‌ام" (after final heh only)
  s = s.replace(/ه (ای|ام|ات|اش|اید|ایم|اند)(?=$|[\s.,،؛؟?!:»)])/g, `ه${ZWNJ}$1`);
  return s;
}

/** Persian punctuation: ? → ؟, , → ، , ; → ؛, straight quotes → « » around Persian text. */
export function fixPunctuation(input: string): string {
  let s = input;
  // Only convert ASCII punctuation adjacent to Persian context.
  s = s.replace(new RegExp(`(${PERSIAN_LETTER}|[۰-۹»)]) ?\\?`, "g"), "$1؟");
  s = s.replace(new RegExp(`(${PERSIAN_LETTER}|[۰-۹»)]) ?,(?!\\d)`, "g"), "$1،");
  s = s.replace(new RegExp(`(${PERSIAN_LETTER}) ?;`, "g"), "$1؛");
  // Paired straight double quotes → guillemets
  s = s.replace(/"([^"]+)"/g, (_m, inner: string) => (RE_LETTER.test(inner) ? `«${inner}»` : `"${inner}"`));
  // No space before punctuation, one space after
  s = s.replace(/ +([،؛؟!.:»])/g, "$1");
  s = s.replace(/« +/g, "«").replace(/ +»/g, "»");
  s = s.replace(/([،؛؟!])(?=[^\s»)\]\d۰-۹!؟])/g, "$1 ");
  s = s.replace(/ {2,}/g, " ");
  return s.trim();
}

export function toPersianDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]!);
}

export function toLatinDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

/**
 * Persian digits on screen, except inside Latin runs (e.g. "Pianova 2026"
 * stays Latin when the number is attached to a Latin word).
 */
export function screenDigits(input: string): string {
  return input.replace(/([A-Za-z][A-Za-z .'-]*\s)?(\d+)/g, (m, latinPrefix: string | undefined, num: string) =>
    latinPrefix ? m : toPersianDigits(num),
  );
}

/** Full normalization used at approval time. */
export function normalizePersian(input: string): string {
  return fixPunctuation(fixZwnj(normalizeChars(input)));
}

export const LATIN_RUN = /[A-Za-z][A-Za-z0-9 .'&+\-]*[A-Za-z0-9]|[A-Za-z]/g;

/** Wrap Latin runs with LRM marks (for SRT/ASS); keeps RTL paragraph direction. */
export function bidiForSubtitleFile(line: string): string {
  const wrapped = line.replace(LATIN_RUN, (m) => `${LRM}${m}${LRM}`);
  return RLM + wrapped;
}

export function startsWithLatin(line: string): boolean {
  return /^[\s\u200E\u200F«(]*[A-Za-z0-9]/.test(line);
}

/** Splits text into spoken word tokens: whitespace separated; ZWNJ stays inside words. */
export function tokenizeWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** True when the string has any Arabic-specific codepoints we forbid. */
export function hasForbiddenCodepoints(s: string): string[] {
  const bad: string[] = [];
  if (/[يىك]/.test(s)) bad.push("arabic-yeh-kaf");
  if (/\u0640/.test(s)) bad.push("kashida");
  if (/ {2,}/.test(s)) bad.push("double-space");
  if (/[٠-٩]/.test(s)) bad.push("arabic-digits");
  if (/\u200C(\s|$)|(^|\s)\u200C/.test(s)) bad.push("dangling-zwnj");
  return bad;
}
