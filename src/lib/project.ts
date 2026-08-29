import type { EntryKind, LineEntry, Page } from "./types";
import type { GlossaryRecord } from "./glossary";
import { srcToPngBytes } from "./download-images";
import { buildZip, downloadBlob, readZip } from "./zip";

export const PROJECT_KIND = "yomi-project";
export const PROJECT_VERSION = 1;
export const DEFAULT_PROJECT_NAME = "Untitled";

const NAME_KEY = "yomi.project-name";
const MAX_PAGES = 80;
const MAX_IMAGE = 8_000_000;

export type ProjectFile = {
  kind: typeof PROJECT_KIND;
  version: number;
  name: string;
  savedAt: string;
  pageIndex: number;
  glossary: GlossaryRecord[];
  pages: {
    id: string;
    image: string;
    entries: LineEntry[];
  }[];
};

export type LoadedProject = {
  name: string;
  pageIndex: number;
  glossary: GlossaryRecord[];
  pages: Page[];
};

export function loadProjectName(): string {
  if (typeof localStorage === "undefined") return DEFAULT_PROJECT_NAME;
  try {
    const name = String(localStorage.getItem(NAME_KEY) ?? "").trim();
    return name.slice(0, 80) || DEFAULT_PROJECT_NAME;
  } catch {
    return DEFAULT_PROJECT_NAME;
  }
}

export function saveProjectName(value: string) {
  if (typeof localStorage === "undefined") return;
  const name = sanitizeProjectName(value);
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // private mode
  }
}

export function sanitizeProjectName(value: string) {
  const name = value.replace(/\s+/g, " ").trim().slice(0, 80);
  return name || DEFAULT_PROJECT_NAME;
}

export function folderNameFor(name: string) {
  const slug = sanitizeProjectName(name)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "yomi-project";
}

export function downloadNameFor(name: string) {
  return `${folderNameFor(name)}.zip`;
}

export function looksLikeProjectFile(file: File) {
  const n = file.name.toLowerCase();
  return (
    n.endsWith(".zip") ||
    n.endsWith(".yomi") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed"
  );
}

function padPage(i: number) {
  return String(i + 1).padStart(3, "0");
}

export async function saveProjectZip(args: {
  name: string;
  pages: Page[];
  glossary: GlossaryRecord[];
  pageIndex: number;
}) {
  const name = sanitizeProjectName(args.name);
  if (args.pages.length > MAX_PAGES) {
    throw new Error(`A project can have at most ${MAX_PAGES} pages.`);
  }
  const folder = folderNameFor(name);
  const pageMeta: ProjectFile["pages"] = [];
  const entries: { name: string; data: Uint8Array }[] = [];

  for (let i = 0; i < args.pages.length; i++) {
    const page = args.pages[i];
    const image = `images/${padPage(i)}.png`;
    const bytes = await srcToPngBytes(page.src);
    if (bytes.byteLength > MAX_IMAGE) {
      throw new Error(`Page ${i + 1} is larger than 8 MB.`);
    }
    entries.push({ name: `${folder}/${image}`, data: bytes });
    pageMeta.push({
      id: page.id,
      image,
      entries: page.entries.map((e) => ({
        id: e.id,
        kind: e.kind === "detail" ? "detail" : "line",
        japanese: e.japanese,
        english: e.english,
        notes: e.notes,
      })),
    });
  }

  const doc: ProjectFile = {
    kind: PROJECT_KIND,
    version: PROJECT_VERSION,
    name,
    savedAt: new Date().toISOString(),
    pageIndex: Math.max(
      0,
      Math.min(args.pageIndex, Math.max(args.pages.length - 1, 0)),
    ),
    glossary: args.glossary.map((row) => ({
      id: row.id,
      from: row.from,
      to: row.to,
      updatedAt: row.updatedAt,
    })),
    pages: pageMeta,
  };
  const json = new TextEncoder().encode(`${JSON.stringify(doc, null, 2)}\n`);
  entries.unshift({ name: `${folder}/project.json`, data: json });

  const zip = buildZip(entries);
  const bytes = new ArrayBuffer(zip.byteLength);
  new Uint8Array(bytes).set(zip);
  downloadBlob(
    downloadNameFor(name),
    new Blob([bytes], { type: "application/zip" }),
  );
}

function normalizeZipPath(name: string) {
  return name.replace(/\\/g, "/").replace(/^\.\//, "");
}

function dirOf(path: string) {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i + 1);
}

function findProjectJson(files: { name: string; data: Uint8Array }[]) {
  const matches = files.filter((f) =>
    normalizeZipPath(f.name).toLowerCase().endsWith("project.json"),
  );
  if (matches.length === 0) return null;
  matches.sort(
    (a, b) =>
      normalizeZipPath(a.name).length - normalizeZipPath(b.name).length,
  );
  return matches[0];
}

function parseGlossary(raw: unknown): GlossaryRecord[] {
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
      id: String(row?.id || crypto.randomUUID()),
      from,
      to,
      updatedAt: Number(row?.updatedAt) || Date.now(),
    });
  }
  return out;
}

function parseEntries(raw: unknown): LineEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = item as Partial<LineEntry>;
      const kind: EntryKind = row?.kind === "detail" ? "detail" : "line";
      return {
        id: String(row?.id || crypto.randomUUID()),
        kind,
        japanese: String(row?.japanese ?? ""),
        english: String(row?.english ?? ""),
        notes: row?.notes ? String(row.notes) : undefined,
      };
    })
    .filter((e) => e.id);
}

export async function loadProjectZip(
  file: File | Blob,
): Promise<LoadedProject> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const files = await readZip(buf);
  const jsonFile = findProjectJson(files);
  if (!jsonFile) {
    throw new Error("That zip is not a Yomi project.");
  }
  let parsed: ProjectFile;
  try {
    parsed = JSON.parse(new TextDecoder().decode(jsonFile.data)) as ProjectFile;
  } catch {
    throw new Error("That project file is not valid JSON.");
  }
  if (parsed?.kind !== PROJECT_KIND) {
    throw new Error("That zip is not a Yomi project.");
  }
  if (Number(parsed.version) > PROJECT_VERSION) {
    throw new Error("That project was saved with a newer Yomi.");
  }
  const pagesIn = Array.isArray(parsed.pages) ? parsed.pages : [];
  if (pagesIn.length > MAX_PAGES) {
    throw new Error(`A project can have at most ${MAX_PAGES} pages.`);
  }
  const root = dirOf(normalizeZipPath(jsonFile.name));
  const byName = new Map(
    files.map((f) => [normalizeZipPath(f.name), f.data]),
  );
  const pages: Page[] = [];
  for (const item of pagesIn) {
    const rel = String(item?.image ?? "").replace(/\\/g, "/");
    if (!rel || rel.includes("..")) {
      throw new Error("That project has a bad image path.");
    }
    const full = `${root}${rel}`;
    const data = byName.get(full);
    if (!data) throw new Error(`Missing image ${rel}.`);
    if (data.byteLength > MAX_IMAGE) {
      throw new Error("An image in that project is larger than 8 MB.");
    }
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    const blob = new Blob([copy.buffer], { type: "image/png" });
    pages.push({
      id: String(item.id || crypto.randomUUID()),
      src: URL.createObjectURL(blob),
      selection: null,
      entries: parseEntries(item.entries),
    });
  }
  const pageIndex = Math.max(
    0,
    Math.min(Number(parsed.pageIndex) || 0, Math.max(pages.length - 1, 0)),
  );
  return {
    name: sanitizeProjectName(String(parsed.name || DEFAULT_PROJECT_NAME)),
    pageIndex,
    glossary: parseGlossary(parsed.glossary),
    pages,
  };
}
