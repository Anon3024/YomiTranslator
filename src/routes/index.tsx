import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImageStage } from "@/components/image-stage";
import { TranscriptPanel } from "@/components/transcript-panel";
import { HelpDialog } from "@/components/help-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { ApiKeyDialog, ApiKeyGate } from "@/components/api-key-dialog";
import { encodeRegion, looksLikeImageUrl } from "@/lib/image";
import {
  blobFromDataUrl,
  dataTransferHasImage,
  filesFromClipboardApi,
  filesFromDataTransfer,
  imageSrcFromHtml,
} from "@/lib/clipboard";
import {
  fetchRemoteImage,
  suggestAlternatives,
  transcribeImage,
  translateText,
} from "@/lib/ocr";
import { downloadPagesZip } from "@/lib/download-images";
import {
  createEntry,
  createPage,
  downloadMarkdown,
  toMarkdown,
} from "@/lib/pages";
import type { EntryKind, LineEntry, Page, Rect, Tool } from "@/lib/types";
import {
  applyGlossary,
  glossaryPayload,
  loadGlossary,
  saveGlossary,
  upsertRecord,
  type GlossaryRecord,
} from "@/lib/glossary";
import { applyTheme, readTheme, type Theme } from "@/lib/theme";
import { loadApiKey, saveApiKey } from "@/lib/api-key";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const pagesRef = useRef<Page[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [tool, setTool] = useState<Tool>("region");
  const [transcribing, setTranscribing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [glossary, setGlossary] = useState<GlossaryRecord[]>(loadGlossary);
  const [theme, setThemeState] = useState<Theme>("light");
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [apiKey, setApiKeyState] = useState(loadApiKey);
  const [view, setView] = useState<"page" | "reorder">("page");
  const [downloading, setDownloading] = useState(false);
  const glossaryRef = useRef(glossary);
  glossaryRef.current = glossary;
  const queueRef = useRef<string[]>([]);
  const drainingRef = useRef(false);
  const apiKeyRef = useRef(apiKey);
  apiKeyRef.current = apiKey;

  const setApiKey = useCallback((value: string) => {
    saveApiKey(value);
    setApiKeyState(value);
  }, []);

  useEffect(() => {
    const t = readTheme();
    setThemeState(t);
    applyTheme(t);
  }, []);

  useEffect(() => {
    saveGlossary(glossary);
  }, [glossary]);

  pagesRef.current = pages;
  const page = pages[pageIndex] ?? null;

  const updatePage = useCallback(
    (fn: (current: Page) => Page) => {
      setPages((prev) =>
        prev.map((item, i) => (i === pageIndex ? fn(item) : item)),
      );
    },
    [pageIndex],
  );

  const addBlobs = useCallback((blobs: Blob[]) => {
    if (blobs.length === 0) return;
    const next = blobs.map((blob) => createPage(URL.createObjectURL(blob)));
    const start = pagesRef.current.length;
    const merged = [...pagesRef.current, ...next];
    pagesRef.current = merged;
    setPages(merged);
    setPageIndex(start);
    setTool("region");
    setError(null);
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      const images = files.filter(
        (f) =>
          f.type.startsWith("image/") ||
          f.type === "" ||
          f.type === "application/octet-stream",
      );
      if (images.length === 0) {
        toast("Please choose an image file.");
        return false;
      }
      addBlobs(images);
      return true;
    },
    [addBlobs],
  );

  const replaceFile = useCallback(
    (file: File) => {
      if (
        !file.type.startsWith("image/") &&
        file.type !== "" &&
        file.type !== "application/octet-stream"
      ) {
        toast("Please choose an image file.");
        return;
      }
      if (!page) {
        addBlobs([file]);
        return;
      }
      const url = URL.createObjectURL(file);
      const old = page.src;
      updatePage((p) => ({ ...p, src: url, selection: null }));
      URL.revokeObjectURL(old);
      setTool("region");
    },
    [addBlobs, page, updatePage],
  );

  const loadUrl = useCallback(
    async (url: string) => {
      const toastId = toast.loading("Fetching image…");
      try {
        const res = await fetchRemoteImage({ data: { url } });
        if (!res.ok) {
          toast.error(res.error, { id: toastId });
          return;
        }
        const blob = await (await fetch(res.data.dataUrl)).blob();
        addBlobs([blob]);
        toast.success("Page added", { id: toastId });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not load that link.",
          { id: toastId },
        );
      }
    },
    [addBlobs],
  );

  const loadSample = useCallback(async () => {
    const toastId = toast.loading("Loading sample…");
    try {
      const res = await fetch("/samples/sign.jpg");
      if (!res.ok) throw new Error("Could not load the sample.");
      addBlobs([await res.blob()]);
      toast.success("Sample loaded", { id: toastId });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create the sample.",
        { id: toastId },
      );
    }
  }, [addBlobs]);

  const removePage = useCallback(() => {
    setPages((prev) => {
      const current = prev[pageIndex];
      if (current) URL.revokeObjectURL(current.src);
      const next = prev.filter((_, i) => i !== pageIndex);
      pagesRef.current = next;
      setPageIndex((idx) => Math.max(0, Math.min(idx, next.length - 1)));
      if (next.length === 0) setView("page");
      return next;
    });
    setError(null);
  }, [pageIndex]);

  const waitForImage = () =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const el = imageRef.current;
      if (!el) {
        reject(new Error("Image is not ready."));
        return;
      }
      if (el.complete && el.naturalWidth > 0) {
        resolve(el);
        return;
      }
      const onErr = () => {
        reject(
          new Error(
            "This browser could not decode that image. Try JPEG or PNG.",
          ),
        );
      };
      el.addEventListener("load", () => resolve(el), { once: true });
      el.addEventListener("error", onErr, { once: true });
    });

  const runTranscribe = useCallback(async () => {
    if (transcribing || !page) return;
    if (!apiKeyRef.current) {
      setError("Add your xAI API key first.");
      return;
    }
    setTranscribing(true);
    setError(null);
    try {
      const el = await waitForImage();
      const dataUrl = await encodeRegion(el, page.selection);
      const res = await transcribeImage({
        data: { imageDataUrl: dataUrl, apiKey: apiKeyRef.current },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const texts =
        !page.selection && res.data.blocks.length > 1
          ? res.data.blocks.map((b) => b.text)
          : [res.data.full_text];
      const created = texts
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => createEntry(t));
      if (created.length === 0) {
        setError(
          res.data.notes ||
            "No Japanese text was found. Try a tighter region.",
        );
        return;
      }
      updatePage((p) => ({
        ...p,
        selection: null,
        entries: [...p.entries, ...created],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  }, [page, transcribing, updatePage]);

  const patchEntry = useCallback(
    (id: string, patch: Partial<LineEntry>) => {
      updatePage((p) => ({
        ...p,
        entries: p.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }));
    },
    [updatePage],
  );

  const setKind = useCallback(
    (id: string, kind: EntryKind) => {
      updatePage((p) => ({
        ...p,
        entries: p.entries.map((e) => (e.id === id ? { ...e, kind } : e)),
      }));
    },
    [updatePage],
  );

  const moveEntry = useCallback(
    (id: string, dir: -1 | 1) => {
      updatePage((p) => {
        const entry = p.entries.find((e) => e.id === id);
        if (!entry) return p;
        const same = p.entries
          .map((e, i) => ({ e, i }))
          .filter((x) => x.e.kind === entry.kind);
        const pos = same.findIndex((x) => x.e.id === id);
        const swapWith = same[pos + dir];
        if (!swapWith) return p;
        const next = p.entries.slice();
        const a = same[pos].i;
        const b = swapWith.i;
        [next[a], next[b]] = [next[b], next[a]];
        return { ...p, entries: next };
      });
    },
    [updatePage],
  );

  const removeEntry = useCallback(
    (id: string) => {
      updatePage((p) => ({
        ...p,
        entries: p.entries.filter((e) => e.id !== id),
      }));
    },
    [updatePage],
  );

  const addBlank = useCallback(() => {
    updatePage((p) => ({
      ...p,
      entries: [...p.entries, createEntry("")],
    }));
  }, [updatePage]);

  const runTranslateEntry = useCallback((id: string) => {
    enqueueTranslate([id]);
  }, []);

  const runTranslatePage = useCallback(() => {
    const current = pagesRef.current[pageIndex];
    if (!current) return;
    const ids = current.entries
      .filter((e) => e.japanese.trim() && !e.english.trim())
      .map((e) => e.id);
    if (ids.length === 0) {
      toast("Nothing left to translate on this page.");
      return;
    }
    enqueueTranslate(ids);
  }, [pageIndex]);

  const enqueueTranslate = useCallback((ids: string[]) => {
    if (!apiKeyRef.current) {
      setError("Add your xAI API key first.");
      return;
    }
    const find = (id: string) => {
      for (const p of pagesRef.current) {
        const entry = p.entries.find((e) => e.id === id);
        if (entry) return entry;
      }
      return null;
    };
    const next = [...queueRef.current];
    const seen = new Set(next);
    for (const id of ids) {
      if (!id || seen.has(id) || id === translatingId) continue;
      const entry = find(id);
      if (!entry?.japanese.trim()) continue;
      next.push(id);
      seen.add(id);
    }
    if (next.length === queueRef.current.length) {
      if (ids.length === 1 && (queueRef.current.includes(ids[0]) || translatingId === ids[0])) {
        toast("Already in the queue.");
      }
      return;
    }
    queueRef.current = next;
    setQueueIds(next);
    void drainTranslate();
  }, [translatingId]);

  const drainTranslate = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    setTranslating(true);
    setError(null);
    const find = (id: string) => {
      for (const p of pagesRef.current) {
        const entry = p.entries.find((e) => e.id === id);
        if (entry) return entry;
      }
      return null;
    };
    const patch = (id: string, data: Partial<LineEntry>) => {
      setPages((prev) =>
        prev.map((p) => ({
          ...p,
          entries: p.entries.map((e) => (e.id === id ? { ...e, ...data } : e)),
        })),
      );
    };
    while (queueRef.current.length) {
      const id = queueRef.current[0];
      setTranslatingId(id);
      const entry = find(id);
      try {
        if (entry?.japanese.trim()) {
          const res = await translateText({
            data: {
              text: entry.japanese,
              glossary: glossaryPayload(glossaryRef.current),
              apiKey: apiKeyRef.current,
            },
          });
          if (!res.ok) {
            setError(res.error);
          } else {
            patch(id, {
              english: applyGlossary(
                entry.japanese,
                res.data.translation,
                glossaryRef.current,
              ),
              notes: res.data.notes,
            });
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Translation failed.");
      }
      queueRef.current = queueRef.current.slice(1);
      setQueueIds([...queueRef.current]);
    }
    setTranslatingId(null);
    setTranslating(false);
    drainingRef.current = false;
  }, []);

  const runAlternatives = useCallback(
    async (id: string, _start: number, _end: number, word: string) => {
      const entry = pagesRef.current[pageIndex]?.entries.find((e) => e.id === id);
      const res = await suggestAlternatives({
        data: {
          japanese: entry?.japanese ?? "",
          english: entry?.english ?? "",
          selected: word,
          apiKey: apiKeyRef.current,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return [];
      }
      return res.data.alternatives;
    },
    [pageIndex],
  );

  const exportAll = useCallback(() => {
    if (pages.every((p) => p.entries.length === 0)) {
      toast("Nothing to export yet.");
      return;
    }
    downloadMarkdown("yomi.md", toMarkdown(pages));
    toast("Exported yomi.md");
  }, [pages]);

  const rememberTerm = useCallback((input: { from: string; to: string }) => {
    setGlossary((prev) => upsertRecord(prev, input));
  }, []);

  const ingestClipboard = useCallback(
    async (data: DataTransfer | null | undefined) => {
      const files = filesFromDataTransfer(data);
      if (files.length) {
        if (addFiles(files)) toast("Image added");
        return true;
      }
      const html = data?.getData("text/html") ?? "";
      const src = html ? imageSrcFromHtml(html) : null;
      if (src?.startsWith("data:image/")) {
        const blob = blobFromDataUrl(src);
        if (blob) {
          addBlobs([blob]);
          toast("Image added");
          return true;
        }
      }
      if (src && looksLikeImageUrl(src)) {
        void loadUrl(src);
        return true;
      }
      const text = data?.getData("text/plain")?.trim() ?? "";
      if (text && looksLikeImageUrl(text)) {
        void loadUrl(text);
        return true;
      }
      return false;
    },
    [addBlobs, addFiles, loadUrl],
  );

  const pasteFromButton = useCallback(async () => {
    try {
      const files = await filesFromClipboardApi();
      if (files.length) {
        if (addFiles(files)) toast("Image added");
        return;
      }
    } catch {
      // Iframes often block clipboard.read().
    }
    toast("Click the image panel, then press Ctrl+V / Cmd+V.");
  }, [addFiles]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const data = e.clipboardData;
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (dataTransferHasImage(data)) {
        e.preventDefault();
        void ingestClipboard(data);
        return;
      }

      if (inField) return;

      const html = data?.getData("text/html") ?? "";
      if (html && imageSrcFromHtml(html)) {
        e.preventDefault();
        void ingestClipboard(data);
        return;
      }

      const text = data?.getData("text/plain")?.trim() ?? "";
      if (text && looksLikeImageUrl(text)) {
        e.preventDefault();
        void loadUrl(text);
      }
    };
    document.addEventListener("paste", onPaste, true);
    return () => document.removeEventListener("paste", onPaste, true);
  }, [ingestClipboard, loadUrl]);

  useEffect(() => {
    const hasFiles = (e: DragEvent) =>
      Boolean(
        e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files"),
      );

    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      setDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      const to = e.relatedTarget as Node | null;
      if (to && document.documentElement.contains(to)) return;
      setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = filesFromDataTransfer(e.dataTransfer);
      if (files.length) {
        if (addFiles(files)) toast("Image added");
        return;
      }
      const uri = (
        e.dataTransfer?.getData("text/uri-list") ||
        e.dataTransfer?.getData("text/plain") ||
        ""
      )
        .trim()
        .split("\n")[0]
        ?.trim();
      if (uri && looksLikeImageUrl(uri)) void loadUrl(uri);
    };
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [addFiles, loadUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (inField || transcribing || view === "reorder") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPageIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPageIndex((i) =>
          Math.min(Math.max(pagesRef.current.length - 1, 0), i + 1),
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [transcribing, view]);

  const reorderPages = useCallback((from: number, to: number) => {
    if (from === to) return;
    const currentId = pagesRef.current[pageIndex]?.id;
    const next = [...pagesRef.current];
    if (
      from < 0 ||
      to < 0 ||
      from >= next.length ||
      to >= next.length
    ) {
      return;
    }
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    pagesRef.current = next;
    setPages(next);
    if (currentId) {
      const idx = next.findIndex((p) => p.id === currentId);
      if (idx >= 0) setPageIndex(idx);
    }
  }, [pageIndex]);

  const downloadImages = useCallback(async () => {
    if (pagesRef.current.length === 0) {
      toast("No images to download.");
      return;
    }
    setDownloading(true);
    try {
      await downloadPagesZip(pagesRef.current);
      toast("Saved yomi-pages.zip");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not download images.",
      );
    } finally {
      setDownloading(false);
    }
  }, []);

  const setSelection = (rect: Rect | null) => {
    updatePage((p) => ({ ...p, selection: rect }));
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 pb-10 pt-6 md:px-8 md:pt-7">
      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-bg/70">
          <p className="rounded-2xl bg-surface px-6 py-4 font-display text-2xl tracking-tight text-fg shadow-[var(--shadow-border)]">
            Drop to add a page
          </p>
        </div>
      ) : null}
      <header className="mb-5 flex flex-col gap-4 lg:mb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
            Japanese from photos
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">
            Yomi
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
            Region by region, page by page. Edit the English, click a word for
            alternatives, export when you are done.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <HelpDialog />
          <ApiKeyDialog
            apiKey={apiKey}
            onSave={setApiKey}
            onClear={() => setApiKey("")}
          />
          <ThemeToggle
            theme={theme}
            onTheme={(next) => {
              setThemeState(next);
              applyTheme(next);
            }}
          />
        </div>
      </header>

      <div className="flex flex-col gap-8">
        {!apiKey ? <ApiKeyGate onSave={setApiKey} /> : null}
        <div className={page ? "stage-wrap shrink-0" : "min-h-96 shrink-0"}>
        <ImageStage
          src={page?.src ?? null}
          tool={tool}
          onToolChange={setTool}
          selection={page?.selection ?? null}
          onSelectionChange={setSelection}
          imageRef={imageRef}
          busy={transcribing}
          pageIndex={pageIndex}
          pageCount={pages.length}
          hasEntries={Boolean(page && page.entries.length > 0)}
          onAddFiles={addFiles}
          onReplaceFile={replaceFile}
          onUrl={(u) => void loadUrl(u)}
          onSample={() => void loadSample()}
          onPasteClick={() => void pasteFromButton()}
          onTranscribe={() => void runTranscribe()}
          onRemovePage={removePage}
          onPrevPage={() => setPageIndex((i) => Math.max(0, i - 1))}
          onNextPage={() =>
            setPageIndex((i) => Math.min(pages.length - 1, i + 1))
          }
          view={view}
          onViewChange={setView}
          pages={pages.map((p) => ({ id: p.id, src: p.src }))}
          onReorder={reorderPages}
          onSelectPage={setPageIndex}
          onDownloadImages={() => void downloadImages()}
          downloading={downloading}
        />
        </div>
        <TranscriptPanel
          page={page}
          pageNumber={pageIndex + 1}
          pageCount={pages.length}
          transcribing={transcribing}
          translating={translating}
          translatingId={translatingId}
          error={error}
          onEntryChange={patchEntry}
          onKind={setKind}
          onMove={moveEntry}
          onRemove={removeEntry}
          onAddBlank={addBlank}
          onTranslateEntry={(id) => void runTranslateEntry(id)}
          onTranslatePage={() => void runTranslatePage()}
          onAlternatives={runAlternatives}
          onExport={exportAll}
          glossary={glossary}
          queueIds={queueIds}
          onRemember={rememberTerm}
          onForget={(id) =>
            setGlossary((prev) => prev.filter((row) => row.id !== id))
          }
        />
      </div>
    </div>
  );
}
