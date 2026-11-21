/**
 * Sequence alignment between the approved script words (source of truth for
 * text) and ASR words (source of timing only). Needleman–Wunsch with a fuzzy
 * substitution cost, then linear interpolation for words the ASR missed.
 */

export interface AsrWord {
  word: string;
  start: number; // ms
  end: number; // ms
}

export interface AlignedWord {
  scriptIndex: number;
  text: string;
  startMs: number;
  endMs: number;
  matched: boolean;
  asrIndex: number | null;
}

export function foldForMatch(w: string): string {
  return w
    .normalize("NFC")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[أإآ]/g, "ا")
    .replace(/ۀ|ة/g, "ه")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[\u200C\u200E\u200F\s]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();
}

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1).fill(0).map((_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n]!;
}

export function similarity(a: string, b: string): number {
  const fa = foldForMatch(a);
  const fb = foldForMatch(b);
  if (!fa.length && !fb.length) return 1;
  return 1 - lev(fa, fb) / Math.max(fa.length, fb.length);
}

export function alignSequences(script: string[], asr: AsrWord[]): AlignedWord[] {
  const n = script.length;
  const m = asr.length;
  const GAP = 0.6;
  const score: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  const back: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    score[i]![0] = -GAP * i;
    back[i]![0] = 1;
  }
  for (let j = 1; j <= m; j++) {
    score[0]![j] = -GAP * j;
    back[0]![j] = 2;
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sim = similarity(script[i - 1]!, asr[j - 1]!.word);
      const diag = score[i - 1]![j - 1]! + (sim >= 0.5 ? sim : sim - 1);
      const up = score[i - 1]![j]! - GAP; // script word not in ASR
      const left = score[i]![j - 1]! - GAP; // extra ASR word
      if (diag >= up && diag >= left) {
        score[i]![j] = diag;
        back[i]![j] = 0;
      } else if (up >= left) {
        score[i]![j] = up;
        back[i]![j] = 1;
      } else {
        score[i]![j] = left;
        back[i]![j] = 2;
      }
    }
  }
  const match: (number | null)[] = new Array(n).fill(null);
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const b = back[i]![j]!;
    if (i > 0 && j > 0 && b === 0) {
      if (similarity(script[i - 1]!, asr[j - 1]!.word) >= 0.5) match[i - 1] = j - 1;
      i--;
      j--;
    } else if (i > 0 && (b === 1 || j === 0)) {
      i--;
    } else {
      j--;
    }
  }
  const out: AlignedWord[] = script.map((text, k) => {
    const a = match[k];
    return a == null
      ? { scriptIndex: k, text, startMs: NaN, endMs: NaN, matched: false, asrIndex: null }
      : { scriptIndex: k, text, startMs: asr[a]!.start, endMs: asr[a]!.end, matched: true, asrIndex: a };
  });
  interpolateMissing(out, asr.length ? asr[asr.length - 1]!.end : 0);
  return out;
}

/** Fill unmatched words proportionally to their character length between matched anchors. */
export function interpolateMissing(words: AlignedWord[], endFallbackMs: number) {
  let k = 0;
  while (k < words.length) {
    if (words[k]!.matched) {
      k++;
      continue;
    }
    let e = k;
    while (e < words.length && !words[e]!.matched) e++;
    const from = k > 0 ? words[k - 1]!.endMs : 0;
    const to = e < words.length ? words[e]!.startMs : Math.max(from + 300 * (e - k), endFallbackMs);
    const lens = words.slice(k, e).map((w) => Math.max(1, foldForMatch(w.text).length));
    const total = lens.reduce((a, b) => a + b, 0);
    let t = from;
    for (let q = k; q < e; q++) {
      const d = ((to - from) * lens[q - k]!) / total;
      words[q]!.startMs = t;
      words[q]!.endMs = t + d;
      t += d;
    }
    k = e;
  }
}

/** Drift statistics between two timing sets for the same script words. */
export function driftStats(reference: { startMs: number }[], measured: { startMs: number; matched?: boolean }[]) {
  const d: number[] = [];
  for (let i = 0; i < Math.min(reference.length, measured.length); i++) {
    if (measured[i]!.matched === false) continue;
    d.push(Math.abs(reference[i]!.startMs - measured[i]!.startMs));
  }
  d.sort((a, b) => a - b);
  const q = (p: number) => (d.length ? d[Math.min(d.length - 1, Math.floor(p * d.length))]! : 0);
  return { count: d.length, median: q(0.5), p95: q(0.95), max: d.length ? d[d.length - 1]! : 0 };
}
