import fs from "node:fs";
import path from "node:path";
import { BrandTheme, type Channel } from "../core/schemas";
import { ROOT, readJson } from "./util";

export interface LedgerTrack {
  id: string;
  title: string;
  rights: string;
  license: string;
  source: string;
  file?: string;
  mood: string;
  bpm?: number;
  seed?: number;
}

export function loadBrand(channel: Channel) {
  const dir = path.join(ROOT, "brands", channel);
  const theme = BrandTheme.parse(readJson(path.join(dir, "theme.json")));
  const dictionary = fs.readFileSync(path.join(dir, "dictionary.txt"), "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const pronunciation = readJson<Record<string, string>>(path.join(dir, "pronunciation.json"));
  const ledger = readJson<{ version: number; tracks: LedgerTrack[] }>(path.join(dir, "music", "ledger.json"));
  for (const t of ledger.tracks) if (!t.rights || !t.license) throw new Error(`ledger track ${t.id} has no rights/license`);
  return { dir, theme, dictionary, pronunciation, ledger };
}
export type Brand = ReturnType<typeof loadBrand>;
