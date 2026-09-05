export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type OcrBlock = {
  text: string;
  orientation: "horizontal" | "vertical" | "unknown";
  furigana?: string | null;
};

export type OcrResult = {
  full_text: string;
  reading_order?: string;
  has_japanese: boolean;
  blocks: OcrBlock[];
  notes?: string;
};

export type TranslateResult = {
  translation: string;
  notes?: string;
};

export type TranslatorId = "grok" | "deepl";

export type Tool = "pan" | "region";

export type EntryKind = "line" | "detail";

export type LineEntry = {
  id: string;
  kind: EntryKind;
  japanese: string;
  english: string;
  notes?: string;
  /** Extra situation for Translate / alternatives, e.g. "speaking with a mouth full". */
  context?: string;
  /** JPEG data URL of the region that was transcribed, for line-by-line proofreading. */
  regionSrc?: string;
};

export type Page = {
  id: string;
  src: string;
  selection: Rect | null;
  entries: LineEntry[];
};

/** English line written when the model declines a translation. */
export const REJECTED_TRANSLATION =
  "Translation Rejected. Use another translator application.";
