// Read the files in a zip: MusicXML (.mxl), MuseScore (.mscz), and Pyware's .3dz packages are all zips.
// Only stored and deflated files (what these programs write). Sizes come from the central directory, so files
// written with a data descriptor (sizes 0 in the local header, as Pyware's are) read fine.

const MAX_FILE = 200_000_000; // bytes, unpacked: more than any show, score, or recording needs

/** Each file in the zip by its path, unpacked on demand. Throws a readable error naming `what` if it isn't a zip. */
export function readZip(buf: ArrayBuffer, what: string): Record<string, () => Promise<Uint8Array<ArrayBuffer>>> {
  const v = new DataView(buf), b = new Uint8Array(buf);
  let e = -1;
  for (let o = b.length - 22; o >= Math.max(0, b.length - 65557); o--) if (v.getUint32(o, true) === 0x06054b50) { e = o; break; }
  if (e < 0) throw new Error(`That ${what} file is damaged (it isn't a readable zip).`);
  const n = v.getUint16(e + 10, true);
  let o = v.getUint32(e + 16, true);
  const files: Record<string, () => Promise<Uint8Array<ArrayBuffer>>> = {};
  for (let k = 0; k < n && o + 46 <= b.length; k++) {
    if (v.getUint32(o, true) !== 0x02014b50) break;
    const flags = v.getUint16(o + 8, true), method = v.getUint16(o + 10, true), size = v.getUint32(o + 20, true), full = v.getUint32(o + 24, true);
    const nameLen = v.getUint16(o + 28, true), extra = v.getUint16(o + 30, true), comment = v.getUint16(o + 32, true), local = v.getUint32(o + 42, true);
    const name = new TextDecoder().decode(b.subarray(o + 46, o + 46 + nameLen));
    files[name] = async () => {
      if (flags & 1) throw new Error(`That ${what} file is password-protected, so FreeFORM can't open it.`);
      if (full > MAX_FILE) throw new Error(`That ${what} file holds something too big to open.`);
      if (local + 30 > b.length || v.getUint32(local, true) !== 0x04034b50) throw new Error(`That ${what} file is damaged (it isn't a readable zip).`);
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const data = b.slice(start, start + size);
      if (method === 0) return data;
      if (method !== 8) throw new Error(`That ${what} file uses a compression FreeFORM can't read.`);
      const out = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      if (out.length > MAX_FILE) throw new Error(`That ${what} file holds something too big to open.`);
      return out;
    };
    o += 46 + nameLen + extra + comment;
  }
  return files;
}

/** True when the bytes start like a zip. */
export const isZip = (b: Uint8Array) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4;
