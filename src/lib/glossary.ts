export type GlossaryRecord = {
  id: string;
  from: string;
  to: string;
  updatedAt: number;
};

function uid() {
  return crypto.randomUUID();
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

/** Apply leftover English→English pairs. Japanese→English pairs are used in the prompt. */
export function applyGlossary(
  _japanese: string,
  english: string,
  records: GlossaryRecord[],
): string {
  if (!english) return english;
  let out = english;
  const hits = records
    .filter((row) => row.from.length >= 2 && out.includes(row.from))
    .sort((a, b) => b.from.length - a.from.length);
  for (const row of hits) {
    out = out.split(row.from).join(row.to);
  }
  return out;
}

export function customsFor(term: string, records: GlossaryRecord[]): string[] {
  const key = term.trim().toLowerCase();
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

export function parseGlossaryRecords(raw: unknown): GlossaryRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: GlossaryRecord[] = [];
  const seen = new Set<string>();
  for (const row of raw as Partial<GlossaryRecord>[]) {
    const from = String(row?.from ?? "").trim().slice(0, 80);
    const to = String(row?.to ?? "").trim().slice(0, 80);
    const key = from.toLowerCase();
    if (!from || !to || seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: String(row?.id || uid()),
      from,
      to,
      updatedAt: Number(row?.updatedAt) || Date.now(),
    });
  }
  return out;
}
