const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u16(n: number) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n >>> 0, true);
  return b;
}

function u32(n: number) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, true);
  return b;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot unpack a compressed zip.");
  }
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const stream = new Blob([copy.buffer]).stream().pipeThrough(
    new DecompressionStream("deflate-raw"),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function viewOf(buf: Uint8Array) {
  return new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
}

export type ZipEntry = { name: string; data: Uint8Array };
export type ZipFile = ZipEntry;

export async function readZip(buf: Uint8Array): Promise<ZipFile[]> {
  if (buf.length < 22) throw new Error("That file is not a zip.");
  const view = viewOf(buf);
  let eocd = -1;
  const min = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= min; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("That file is not a zip.");

  const count = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (count > 400) throw new Error("That zip has too many files.");

  const files: ZipFile[] = [];
  let cursor = centralOffset;
  for (let n = 0; n < count; n++) {
    if (cursor + 46 > buf.length) throw new Error("That zip is damaged.");
    if (view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error("That zip is damaged.");
    }
    const method = view.getUint16(cursor + 10, true);
    const compSize = view.getUint32(cursor + 20, true);
    const uncompSize = view.getUint32(cursor + 24, true);
    const nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const nameBytes = buf.subarray(cursor + 46, cursor + 46 + nameLen);
    const name = new TextDecoder().decode(nameBytes).replace(/\\/g, "/");
    cursor += 46 + nameLen + extraLen + commentLen;
    if (!name || name.endsWith("/")) continue;
    if (localOffset + 30 > buf.length) throw new Error("That zip is damaged.");
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > buf.length) throw new Error("That zip is damaged.");
    const raw = buf.subarray(dataStart, dataEnd);
    let data: Uint8Array;
    if (method === 0) {
      data = raw.slice();
    } else if (method === 8) {
      data = await inflateRaw(raw);
    } else {
      throw new Error("That zip uses an unsupported compression method.");
    }
    if (uncompSize && data.length !== uncompSize) {
      throw new Error("That zip is damaged.");
    }
    files.push({ name: name.replace(/^\.\//, ""), data });
  }
  return files;
}


/** Uncompressed ZIP (STORE). Fine for PNG/JPEG. */
export function buildZip(entries: ZipEntry[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data,
    ]);
    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralDir = concat(centrals);
  const eocd = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);
  return concat([...locals, centralDir, eocd]);
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
