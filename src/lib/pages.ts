import type { EntryKind, LineEntry, Page } from "./types";

export function uid() {
  return crypto.randomUUID();
}

export function createPage(src: string): Page {
  return { id: uid(), src, selection: null, entries: [] };
}

export function createEntry(
  japanese: string,
  extras?: Partial<LineEntry>,
): LineEntry {
  return {
    id: uid(),
    kind: "line",
    japanese,
    english: "",
    ...extras,
  };
}

export function entriesOf(page: Page, kind: EntryKind) {
  return page.entries.filter((e) => e.kind === kind);
}

export function toMarkdown(pages: Page[]): string {
  return pages
    .map((page, i) => {
      const n = i + 1;
      const lines = entriesOf(page, "line");
      const details = entriesOf(page, "detail");
      const origLines = formatList(lines, "Line", "japanese");
      const origDetails = formatList(details, "Detail", "japanese");
      const trLines = formatList(lines, "Line", "english");
      const trDetails = formatList(details, "Detail", "english");
      return [
        `## Page ${n}`,
        "### Original",
        "#### Lines",
        origLines || "(none)",
        "#### Detail/SFX",
        origDetails || "(none)",
        "### Translation",
        "#### Lines",
        trLines || "(none)",
        "#### Detail/SFX",
        trDetails || "(none)",
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

function formatList(
  items: LineEntry[],
  label: string,
  field: "japanese" | "english",
) {
  if (items.length === 0) return "";
  return items
    .map((item, i) => `${label} ${i + 1}: ${item[field] || ""}`)
    .join("\n");
}

export function downloadMarkdown(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type Token = {
  value: string;
  start: number;
  end: number;
  isWord: boolean;
};

export function tokenizeEnglish(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) {
      tokens.push({
        value: text.slice(last, match.index),
        start: last,
        end: match.index,
        isWord: false,
      });
    }
    tokens.push({
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
      isWord: true,
    });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    tokens.push({
      value: text.slice(last),
      start: last,
      end: text.length,
      isWord: false,
    });
  }
  return tokens;
}
