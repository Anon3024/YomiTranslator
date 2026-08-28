export type GlossaryRecord = {
  id: string;
  from: string;
  to: string;
  updatedAt: number;
};

const KEY_V2 = "yomi.glossary.v2";
const KEY_V1 = "yomi.glossary.v1";

function uid() {
  return crypto.randomUUID();
}

export function loadGlossary(): GlossaryRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const v2 = localStorage.getItem(KEY_V2);
    if (v2) {
      const parsed = JSON.parse(v2) as GlossaryRecord[];
      if (Array.isArray(parsed)) {
        return parsed
          .filter((row) => row && typeof row.from === "string" && row.to)
          .map((row) => ({
            id: String(row.id || uid()),
            from: String(row.from).trim(),
            to: String(row.to).trim(),
            updatedAt: Number(row.updatedAt) || Date.now(),
          }))
          .filter((row) => row.from && row.to);
      }
    }
    return migrateV1(localStorage.getItem(KEY_V1));
  } catch {
    return [];
  }
}

function migrateV1(raw: string | null): GlossaryRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<{
      japanese?: string;
      preferred?: string;
      replacements?: { from?: string; to?: string }[];
    }>;
    if (!Array.isArray(parsed)) return [];
    const out: GlossaryRecord[] = [];
    const seen = new Set<string>();
    for (const row of parsed) {
      for (const repl of row.replacements ?? []) {
        const from = String(repl?.from ?? "").trim();
        const to = String(repl?.to ?? "").trim();
        const key = from.toLowerCase();
        if (from.length < 2 || !to || seen.has(key)) continue;
        seen.add(key);
        out.push({ id: uid(), from, to, updatedAt: Date.now() });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function saveGlossary(records: GlossaryRecord[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY_V2, JSON.stringify(records));
  } catch {
    // Quota or private mode — ignore.
  }
}

export function upsertRecord(
  records: GlossaryRecord[],
  input: { from: string; to: string },
): GlossaryRecord[] {
  const from = input.from.trim();
  const to = input.to.trim();
  if (from.length < 1 || !to || from === to) return records;
  const key = from.toLowerCase();
  const now = Date.now();
  const idx = records.findIndex((row) => row.from.toLowerCase() === key);
  const next: GlossaryRecord = {
    id: idx >= 0 ? records[idx].id : uid(),
    from,
    to,
    updatedAt: now,
  };
  if (idx >= 0) {
    const copy = records.slice();
    copy[idx] = next;
    return copy;
  }
  return [next, ...records];
}

export function applyGlossary(
  _japanese: string,
  english: string,
  records: GlossaryRecord[],
): string {
  if (!english) return english;
  let out = english;
  const hits = records
    .filter((row) => row.from.length >= 2)
    .sort((a, b) => b.from.length - a.from.length);
  for (const row of hits) {
    if (!out.includes(row.from)) continue;
    out = out.split(row.from).join(row.to);
  }
  return out;
}

export function customsFor(word: string, records: GlossaryRecord[]): string[] {
  const key = word.trim().toLowerCase();
  if (!key) return [];
  return records
    .filter((row) => row.from.toLowerCase() === key && row.to)
    .map((row) => row.to);
}

export function glossaryPayload(records: GlossaryRecord[]) {
  return records
    .filter((row) => row.from && row.to)
    .slice(0, 40)
    .map((row) => ({ from: row.from.slice(0, 80), to: row.to.slice(0, 80) }));
}
