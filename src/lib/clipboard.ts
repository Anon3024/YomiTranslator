function isImageFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  if (file.type === "" || file.type === "application/octet-stream") return true;
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(file.name);
}

function pushFile(files: File[], file: File | null | undefined) {
  if (!file || !isImageFile(file)) return;
  if (files.some((f) => f === file || (f.size === file.size && f.type === file.type && f.name === file.name))) {
    return;
  }
  files.push(file);
}

/** Collect image files from a paste or drop. Call preventDefault before getAsFile(). */
export function filesFromDataTransfer(data: DataTransfer | null | undefined): File[] {
  const files: File[] = [];
  if (!data) return files;

  if (data.files) {
    for (let i = 0; i < data.files.length; i++) {
      pushFile(files, data.files.item(i));
    }
  }

  if (data.items) {
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (!item || item.kind !== "file") continue;
      if (item.type.startsWith("image/") || item.type === "") {
        pushFile(files, item.getAsFile());
      }
    }
  }

  return files;
}

export function dataTransferHasImage(data: DataTransfer | null | undefined): boolean {
  if (!data) return false;
  if (data.files) {
    for (let i = 0; i < data.files.length; i++) {
      const f = data.files.item(i);
      if (f && isImageFile(f)) return true;
    }
  }
  if (data.items) {
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (!item) continue;
      if (item.kind === "file" && (item.type.startsWith("image/") || item.type === "")) {
        return true;
      }
      if (item.type.startsWith("image/")) return true;
    }
  }
  return false;
}

export function imageSrcFromHtml(html: string): string | null {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

export async function filesFromClipboardApi(): Promise<File[]> {
  if (!navigator.clipboard?.read) return [];
  const items = await navigator.clipboard.read();
  const files: File[] = [];
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith("image/"));
    if (!type) continue;
    const blob = await item.getType(type);
    const ext = type.split("/")[1] || "png";
    files.push(new File([blob], `paste.${ext}`, { type: blob.type || type }));
  }
  return files;
}

export function blobFromDataUrl(dataUrl: string): Blob | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const b64 = match[2];
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
