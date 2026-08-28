import type { Page } from "./types";
import { buildZip, downloadBlob } from "./zip";

function rasterToPng(src: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not convert that image."));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Could not encode PNG.")),
        "image/png",
      );
    };
    img.onerror = () => reject(new Error("Could not decode an image."));
    img.src = src;
  });
}

async function srcToPngBytes(src: string): Promise<Uint8Array> {
  const res = await fetch(src);
  if (!res.ok) throw new Error("Could not read an image.");
  const blob = await res.blob();
  const png =
    blob.type === "image/png" ? blob : await rasterToPng(src);
  return new Uint8Array(await png.arrayBuffer());
}

export async function downloadPagesZip(pages: Page[]) {
  if (pages.length === 0) throw new Error("No images to download.");
  const entries = [];
  for (let i = 0; i < pages.length; i++) {
    entries.push({
      name: `${i + 1}.png`,
      data: await srcToPngBytes(pages[i].src),
    });
  }
  const zip = buildZip(entries);
  const bytes = new ArrayBuffer(zip.byteLength);
  new Uint8Array(bytes).set(zip);
  downloadBlob("yomi-pages.zip", new Blob([bytes], { type: "application/zip" }));
}
