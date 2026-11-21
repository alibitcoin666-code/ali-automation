/** Persian number words, used to build the spoken transcript for forced alignment. */
import { toLatinDigits } from "./normalize";

const ONES = ["صفر", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const SCALES = ["", "هزار", "میلیون", "میلیارد"];

function below1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) parts.push(HUNDREDS[h]!);
  if (r >= 10 && r < 20) parts.push(TEENS[r - 10]!);
  else {
    const t = Math.floor(r / 10);
    const o = r % 10;
    if (t) parts.push(TENS[t]!);
    if (o) parts.push(ONES[o]!);
  }
  return parts.join(" و ");
}

export function numberToPersianWords(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n === 0) return ONES[0]!;
  if (n < 0) return "منفی " + numberToPersianWords(-n);
  const groups: string[] = [];
  let s = 0;
  let x = Math.floor(n);
  while (x > 0 && s < SCALES.length) {
    const g = x % 1000;
    if (g) groups.unshift(below1000(g) + (SCALES[s] ? " " + SCALES[s] : ""));
    x = Math.floor(x / 1000);
    s++;
  }
  return groups.join(" و ").replace(/^یک هزار/, "هزار");
}

/** Spoken form of a token for alignment: digits → words, % → درصد. */
export function spokenForm(token: string): string {
  const t = toLatinDigits(token).replace(/[«»"()،؛؟!.:,]/g, "");
  const m = t.match(/^(\d+)(%)?$/);
  if (m) return numberToPersianWords(Number(m[1])) + (m[2] ? " درصد" : "");
  return t;
}
