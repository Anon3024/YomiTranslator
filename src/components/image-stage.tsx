import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ClipboardPaste,
  Crop,
  ImagePlus,
  Link2,
  Move,
  ScanText,
  Upload,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageGrid } from "@/components/page-grid";
import { cn } from "@/lib/utils";
import { clamp, normalizeRect } from "@/lib/image";
import type { Rect, Tool } from "@/lib/types";

type Drag =
  | { kind: "pan"; sx: number; sy: number; ox: number; oy: number }
  | { kind: "draw"; ix: number; iy: number }
  | { kind: "move"; ix: number; iy: number; orig: Rect }
  | {
      kind: "resize";
      handle: Handle;
      ix: number;
      iy: number;
      orig: Rect;
    };

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const HANDLE_CURSOR: Record<Handle, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

type Props = {
  src: string | null;
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  selection: Rect | null;
  onSelectionChange: (rect: Rect | null) => void;
  imageRef: React.RefObject<HTMLImageElement | null>;
  busy?: boolean;
  pageIndex: number;
  pageCount: number;
  hasEntries: boolean;
  onAddFiles: (files: File[]) => void;
  onReplaceFile: (file: File) => void;
  onUrl: (url: string) => void;
  onSample: () => void;
  onPasteClick: () => void;
  onTranscribe: () => void;
  onRemovePage: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  view: "page" | "reorder";
  onViewChange: (view: "page" | "reorder") => void;
  pages: { id: string; src: string }[];
  onReorder: (from: number, to: number) => void;
  onSelectPage: (index: number) => void;
  onDownloadImages: () => void;
  downloading?: boolean;
};

export function ImageStage({
  src,
  tool,
  onToolChange,
  selection,
  onSelectionChange,
  imageRef,
  busy,
  pageIndex,
  pageCount,
  hasEntries,
  onAddFiles,
  onReplaceFile,
  onUrl,
  onSample,
  onPasteClick,
  onTranscribe,
  onRemovePage,
  onPrevPage,
  onNextPage,
  view,
  onViewChange,
  pages,
  onReorder,
  onSelectPage,
  onDownloadImages,
  downloading,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [urlValue, setUrlValue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const fittedFor = useRef<string | null>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  const fit = useCallback((nw: number, nh: number) => {
    const vp = viewportRef.current;
    if (!vp || !nw || !nh) return;
    const pad = 16;
    const vw = Math.max(1, vp.clientWidth - pad);
    const vh = Math.max(1, vp.clientHeight - pad);
    const z = Math.min(vw / nw, vh / nh);
    setZoom(z);
    setPan({
      x: (vp.clientWidth - nw * z) / 2,
      y: (vp.clientHeight - nh * z) / 2,
    });
  }, []);

  const onImageReady = () => {
    const el = imageRef.current;
    if (!el) return;
    const nw = el.naturalWidth;
    const nh = el.naturalHeight;
    setNat({ w: nw, h: nh });
    if (src && fittedFor.current !== src) {
      fittedFor.current = src;
      fit(nw, nh);
    }
  };

  useEffect(() => {
    if (!src) {
      fittedFor.current = null;
      setNat({ w: 0, h: 0 });
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [src]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handle = (e: WheelEvent) => {
      if (!src || view === "reorder") return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const z = zoomRef.current;
      const p = panRef.current;
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      const next = clamp(z * factor, 0.08, 12);
      const ix = (mx - p.x) / z;
      const iy = (my - p.y) / z;
      setZoom(next);
      setPan({ x: mx - ix * next, y: my - iy * next });
    };
    const blockMiddle = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };
    el.addEventListener("wheel", handle, { passive: false });
    el.addEventListener("mousedown", blockMiddle);
    el.addEventListener("auxclick", blockMiddle);
    return () => {
      el.removeEventListener("wheel", handle);
      el.removeEventListener("mousedown", blockMiddle);
      el.removeEventListener("auxclick", blockMiddle);
    };
  }, [src, view]);

  const clientToImage = (cx: number, cy: number) => {
    const vp = viewportRef.current;
    if (!vp) return { x: 0, y: 0 };
    const r = vp.getBoundingClientRect();
    return {
      x: (cx - r.left - pan.x) / zoom,
      y: (cy - r.top - pan.y) / zoom,
    };
  };

  const applyResize = (orig: Rect, handle: Handle, ix: number, iy: number): Rect => {
    let { x, y, w, h } = orig;
    if (handle.includes("w")) {
      const x2 = x + w;
      x = ix;
      w = x2 - ix;
    }
    if (handle.includes("e")) w = ix - x;
    if (handle.includes("n")) {
      const y2 = y + h;
      y = iy;
      h = y2 - iy;
    }
    if (handle.includes("s")) h = iy - y;
    return normalizeRect({ x, y, w, h }, nat);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!src || view === "reorder") return;
    if (e.button === 1) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        kind: "pan",
        sx: e.clientX,
        sy: e.clientY,
        ox: pan.x,
        oy: pan.y,
      };
      return;
    }
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const handle = target.dataset.handle as Handle | undefined;
    const { x, y } = clientToImage(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (tool === "pan" || e.shiftKey) {
      dragRef.current = {
        kind: "pan",
        sx: e.clientX,
        sy: e.clientY,
        ox: pan.x,
        oy: pan.y,
      };
      return;
    }

    if (handle && selection) {
      dragRef.current = {
        kind: "resize",
        handle,
        ix: x,
        iy: y,
        orig: selection,
      };
      return;
    }

    if (
      selection &&
      x >= selection.x &&
      y >= selection.y &&
      x <= selection.x + selection.w &&
      y <= selection.y + selection.h
    ) {
      dragRef.current = { kind: "move", ix: x, iy: y, orig: selection };
      return;
    }

    dragRef.current = { kind: "draw", ix: x, iy: y };
    onSelectionChange({ x, y, w: 1, h: 1 });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "pan") {
      setPan({
        x: drag.ox + (e.clientX - drag.sx),
        y: drag.oy + (e.clientY - drag.sy),
      });
      return;
    }
    const { x, y } = clientToImage(e.clientX, e.clientY);
    if (drag.kind === "draw") {
      onSelectionChange(
        normalizeRect(
          { x: drag.ix, y: drag.iy, w: x - drag.ix, h: y - drag.iy },
          nat,
        ),
      );
    } else if (drag.kind === "move") {
      const dx = x - drag.ix;
      const dy = y - drag.iy;
      onSelectionChange(
        normalizeRect(
          {
            x: drag.orig.x + dx,
            y: drag.orig.y + dy,
            w: drag.orig.w,
            h: drag.orig.h,
          },
          nat,
        ),
      );
    } else {
      onSelectionChange(applyResize(drag.orig, drag.handle, x, y));
    }
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.kind === "draw" && selection && (selection.w < 8 || selection.h < 8)) {
      onSelectionChange(null);
    }
  };

  return (
    <section className="flex min-h-0 flex-col rounded-3xl bg-surface p-2 pb-4 shadow-[var(--shadow-border)]">
      <div
        ref={viewportRef}
        className={cn(
          "stage-frame relative flex-1 overscroll-none rounded-2xl bg-surface-inset",
          src && view === "page" ? "overflow-hidden" : "overflow-y-auto",
          src && view === "page" ? "cursor-crosshair" : "",
          tool === "pan" && src && view === "page" ? "cursor-grab" : "",
        )}
        tabIndex={0}
        style={{ touchAction: view === "reorder" || !src ? "auto" : "none" }}
        onPointerDown={src && view === "page" ? onPointerDown : undefined}
        onPointerMove={src && view === "page" ? onPointerMove : undefined}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDragOver={(e) => {
          if (view === "reorder") return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          if (view === "reorder") return;
          e.preventDefault();
        }}
      >
        {!src ? (
          <EmptyDrop
            urlValue={urlValue}
            onUrlValue={setUrlValue}
            onAdd={() => addRef.current?.click()}
            onPaste={onPasteClick}
            onUrl={onUrl}
            onSample={onSample}
          />
        ) : view === "reorder" ? (
          <PageGrid
            pages={pages}
            pageIndex={pageIndex}
            onSelect={onSelectPage}
            onMove={onReorder}
          />
        ) : (
          <>
            <div
              className="absolute left-0 top-0 origin-top-left will-change-transform"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              <img
                ref={imageRef}
                src={src}
                alt="Source"
                draggable={false}
                onLoad={onImageReady}
                className="block max-w-none select-none outline outline-1 -outline-offset-1 outline-fg/10"
              />
              {selection && nat.w > 0 ? (
                <div
                  className="absolute box-border border-2 border-accent bg-accent/10 shadow-[0_0_0_9999px_rgba(28,27,24,0.45)]"
                  style={{
                    left: selection.x,
                    top: selection.y,
                    width: selection.w,
                    height: selection.h,
                  }}
                >
                  {(
                    [
                      ["nw", "0", "0"],
                      ["n", "50%", "0"],
                      ["ne", "100%", "0"],
                      ["e", "100%", "50%"],
                      ["se", "100%", "100%"],
                      ["s", "50%", "100%"],
                      ["sw", "0", "100%"],
                      ["w", "0", "50%"],
                    ] as const
                  ).map(([h, left, top]) => (
                    <span
                      key={h}
                      data-handle={h}
                      className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-surface shadow-[var(--shadow-border)]"
                      style={{
                        left,
                        top,
                        cursor: HANDLE_CURSOR[h],
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            {busy ? (
              <div className="absolute inset-0 flex items-center justify-center bg-bg/55 text-sm font-medium text-fg">
                Reading text…
              </div>
            ) : null}
            {pageCount > 0 ? (
              <div
                className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-surface/95 px-1 py-1 shadow-[var(--shadow-border)]"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Previous page"
                  disabled={pageIndex <= 0 || busy}
                  onClick={onPrevPage}
                >
                  <ChevronLeft />
                </Button>
                <span className="min-w-20 px-2 text-center text-xs font-medium tabular-nums text-fg">
                  Page {pageIndex + 1} / {pageCount}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Next page"
                  disabled={pageIndex >= pageCount - 1 || busy}
                  onClick={onNextPage}
                >
                  <ChevronRight />
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-2 flex shrink-0 flex-wrap items-center gap-2 px-2 pb-1 pt-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onReplaceFile(f);
            e.target.value = "";
          }}
        />
        <input
          ref={addRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            if (files.length) onAddFiles(files);
            e.target.value = "";
          }}
        />
        {src ? (
          view === "reorder" ? (
            <>
              <p className="px-1 text-xs text-muted">
                Drag pages or use the arrows. Regions are off until you return
                to the page view.
              </p>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addRef.current?.click()}
                >
                  <ImagePlus />
                  Add page
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onDownloadImages}
                  disabled={downloading || pageCount === 0}
                >
                  <Download />
                  {downloading ? "Preparing…" : "Download images"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onViewChange("page")}
                >
                  Done
                </Button>
              </div>
            </>
          ) : (
          <>
            <Button
              type="button"
              variant={tool === "pan" ? "default" : "secondary"}
              size="sm"
              aria-pressed={tool === "pan"}
              onClick={() => onToolChange("pan")}
            >
              <Move />
              Pan
            </Button>
            <Button
              type="button"
              variant={tool === "region" ? "default" : "secondary"}
              size="sm"
              aria-pressed={tool === "region"}
              onClick={() => onToolChange("region")}
            >
              <Crop />
              Region
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom in"
              onClick={() => setZoom((z) => clamp(z * 1.2, 0.08, 12))}
            >
              <ZoomIn />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom out"
              onClick={() => setZoom((z) => clamp(z / 1.2, 0.08, 12))}
            >
              <ZoomOut />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fit(nat.w, nat.h)}
            >
              Fit
            </Button>
            {selection ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSelectionChange(null)}
              >
                Clear region
              </Button>
            ) : null}
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onViewChange("reorder")}
                disabled={pageCount < 1}
              >
                <LayoutGrid />
                Re-order pages
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDownloadImages}
                disabled={downloading || pageCount === 0}
              >
                <Download />
                {downloading ? "Preparing…" : "Download images"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onPasteClick}
              >
                <ClipboardPaste />
                Paste
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addRef.current?.click()}
              >
                <ImagePlus />
                Add page
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                Replace
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onRemovePage}>
                Remove
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onTranscribe}
                disabled={busy}
              >
                <ScanText />
                {selection
                  ? hasEntries
                    ? "Add region"
                    : "Transcribe region"
                  : hasEntries
                    ? "Add from page"
                    : "Transcribe"}
              </Button>
            </div>
          </>
          )
        ) : (
          <p className="px-1 text-xs text-muted">
            Scroll to zoom. Middle-drag pans. Draw a region, transcribe, then the
            next. Arrow keys change page.
          </p>
        )}
      </div>
    </section>
  );
}

function EmptyDrop({
  urlValue,
  onUrlValue,
  onAdd,
  onPaste,
  onUrl,
  onSample,
}: {
  urlValue: string;
  onUrlValue: (v: string) => void;
  onAdd: () => void;
  onPaste: () => void;
  onUrl: (url: string) => void;
  onSample: () => void;
}) {
  const submitUrl = (form?: HTMLFormElement | null) => {
    const input = form?.elements.namedItem("url") as HTMLInputElement | null;
    const url = (input?.value || urlValue).trim();
    if (url) onUrl(url);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-5 py-6 text-center md:gap-5 md:px-6 md:py-10">
      <div className="flex size-12 items-center justify-center rounded-lg bg-bg-warm text-accent">
        <Upload className="size-5" />
      </div>
      <div className="max-w-sm space-y-2">
        <p className="font-display text-xl tracking-tight text-fg">
          Drop a photo, paste, or load a link
        </p>
        <p className="text-sm leading-relaxed text-muted">
          Signs, menus, screenshots, manga panels. Add several pages, then
          transcribe region by region.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={onAdd}>
          <Upload />
          Choose image
        </Button>
        <Button type="button" variant="secondary" onClick={onPaste}>
          <ClipboardPaste />
          Paste
        </Button>
        <Button type="button" variant="secondary" onClick={onSample}>
          Try a sample sign
        </Button>
      </div>
      <form
        className="flex w-full max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submitUrl(e.currentTarget);
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={urlValue}
            onChange={(e) => onUrlValue(e.target.value)}
            placeholder="Paste an image URL"
            className="pl-9"
            inputMode="url"
            autoComplete="off"
            name="url"
          />
        </div>
        <Button type="submit" variant="outline">
          Load
        </Button>
      </form>
      <p className="text-xs text-subtle">
        Click this panel, then Ctrl+V / Cmd+V — or use Paste. Images stay in
        this session.
      </p>
    </div>
  );
}
