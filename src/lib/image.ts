import type { Rect } from "./types";

const MAX_EDGE = 2048;
const MAX_BYTES = 1_700_000;
const THUMB_EDGE = 320;
const THUMB_MAX_BYTES = 80_000;

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function normalizeRect(
  r: Rect,
  bounds: { w: number; h: number },
): Rect {
  let { x, y, w, h } = r;
  if (w < 0) {
    x += w;
    w = -w;
  }
  if (h < 0) {
    y += h;
    h = -h;
  }
  x = clamp(x, 0, bounds.w);
  y = clamp(y, 0, bounds.h);
  w = clamp(w, 1, bounds.w - x);
  h = clamp(h, 1, bounds.h - y);
  return { x, y, w, h };
}

export function looksLikeImageUrl(text: string): boolean {
  const t = text.trim();
  if (!/^https?:\/\//i.test(t)) return false;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image data"));
    reader.readAsDataURL(blob);
  });
}

async function canvasToJpeg(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("Could not encode image");
  return blob;
}

async function encodeCrop(
  source: HTMLImageElement,
  region: Rect,
  opts: { maxEdge: number; maxBytes: number; quality: number },
): Promise<string> {
  let scale = Math.min(1, opts.maxEdge / Math.max(region.w, region.h));
  let quality = opts.quality;

  for (let attempt = 0; attempt < 6; attempt++) {
    const dw = Math.max(1, Math.round(region.w * scale));
    const dh = Math.max(1, Math.round(region.h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, dw, dh);
    ctx.drawImage(
      source,
      region.x,
      region.y,
      region.w,
      region.h,
      0,
      0,
      dw,
      dh,
    );
    const blob = await canvasToJpeg(canvas, quality);
    if (blob.size <= opts.maxBytes) {
      return blobToDataUrl(blob);
    }
    if (quality > 0.55) {
      quality -= 0.12;
    } else {
      scale *= 0.75;
    }
  }

  throw new Error(
    "Image is still too large after compression. Select a smaller region.",
  );
}

function boundsOf(source: HTMLImageElement) {
  if (!source.naturalWidth || !source.naturalHeight) {
    throw new Error("Image is not loaded yet");
  }
  return { w: source.naturalWidth, h: source.naturalHeight };
}

export async function encodeRegion(
  source: HTMLImageElement,
  crop: Rect | null,
): Promise<string> {
  const bounds = boundsOf(source);
  const region = crop
    ? normalizeRect(crop, bounds)
    : { x: 0, y: 0, w: bounds.w, h: bounds.h };
  return encodeCrop(source, region, {
    maxEdge: MAX_EDGE,
    maxBytes: MAX_BYTES,
    quality: 0.84,
  });
}

/** Small JPEG crop for the transcript line. Requires a drawn region. */
export async function encodeRegionThumb(
  source: HTMLImageElement,
  crop: Rect,
): Promise<string> {
  const bounds = boundsOf(source);
  const region = normalizeRect(crop, bounds);
  return encodeCrop(source, region, {
    maxEdge: THUMB_EDGE,
    maxBytes: THUMB_MAX_BYTES,
    quality: 0.8,
  });
}

export async function createSampleSignBlob(): Promise<Blob> {
  await document.fonts.ready;
  try {
    await document.fonts.load('700 52px "Noto Sans JP"');
    await document.fonts.load('500 34px "Noto Sans JP"');
  } catch {
    // Continue with fallbacks if the webfont is slow.
  }

  const w = 960;
  const h = 640;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  ctx.fillStyle = "#d9cbb6";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#2c4a5c";
  ctx.fillRect(40, 40, w - 80, h - 80);
  ctx.fillStyle = "#f6f1e6";
  ctx.fillRect(64, 64, w - 128, h - 128);

  ctx.fillStyle = "#1c1b18";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = '700 48px "Noto Sans JP", sans-serif';
  ctx.fillText("本日のおすすめ", w / 2, 160);

  ctx.font = '500 34px "Noto Sans JP", sans-serif';
  ctx.fillText("鮭弁当　　６５０円", w / 2, 260);
  ctx.fillText("唐揚げ定食　７８０円", w / 2, 330);
  ctx.fillText("冷やし中華　７２０円", w / 2, 400);

  ctx.font = '400 22px "Noto Sans JP", sans-serif';
  ctx.fillText("営業時間 １１：００ − ２０：００", w / 2, 500);

  return canvasToJpeg(canvas, 0.92);
}
