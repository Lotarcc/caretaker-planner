// Decodes an Unreal Engine compressed-chunk stream (.sav) into the raw GVAS payload.
// Layout per chunk:
//   u64 tag, u64 blockSize, u8 compressor, u64 compressedSize, u64 uncompressedSize,
//   {u64 compressed, u64 uncompressed} * ceil(uncompressedSize / blockSize), then block payloads.
// Runs in Node and in the browser: `buffer` resolves to Node's built-in or the npm polyfill.
import { Buffer } from 'buffer';
import { unzlibSync } from 'fflate';
import { decompressUnsafe } from 'ooz-wasm';

export const CHUNK_TAG = 0x222222229e2a83c1n;
export const COMPRESSOR_KRAKEN = 2;
export const COMPRESSOR_ZLIB = 3;

const HEADER_SIZE = 33;

export function isChunked(buf) {
  return buf.length >= HEADER_SIZE && buf.readBigUInt64LE(0) === CHUNK_TAG;
}

export function decodeChunks(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (buf.subarray(0, 4).toString('latin1') === 'GVAS') return { gvas: buf, compressor: 'none' };
  if (!isChunked(buf)) throw new Error('Not a Last Caretaker save: unknown file header');

  const parts = [];
  const compressors = new Set();
  let p = 0;
  while (p < buf.length) {
    if (buf.length - p < HEADER_SIZE) throw new Error(`Truncated chunk header at offset ${p}`);
    if (buf.readBigUInt64LE(p) !== CHUNK_TAG) throw new Error(`Bad chunk tag at offset ${p}`);
    const blockSize = Number(buf.readBigUInt64LE(p + 8));
    const compressor = buf[p + 16];
    const uncompressedSize = Number(buf.readBigUInt64LE(p + 25));
    p += HEADER_SIZE;
    compressors.add(compressor);

    const blockCount = Math.ceil(uncompressedSize / blockSize);
    const blocks = [];
    for (let i = 0; i < blockCount; i++) {
      blocks.push([Number(buf.readBigUInt64LE(p)), Number(buf.readBigUInt64LE(p + 8))]);
      p += 16;
    }
    for (const [compressed, uncompressed] of blocks) {
      if (p + compressed > buf.length) throw new Error(`Truncated block at offset ${p}`);
      const block = buf.subarray(p, p + compressed);
      p += compressed;
      parts.push(decompressBlock(block, uncompressed, compressor));
    }
  }
  let gvas = Buffer.concat(parts);
  // The payload is prefixed with its own u32 length.
  if (gvas.length >= 8 && gvas.subarray(4, 8).toString('latin1') === 'GVAS' && gvas.readUInt32LE(0) === gvas.length - 4) {
    gvas = gvas.subarray(4);
  }
  if (gvas.subarray(0, 4).toString('latin1') !== 'GVAS') throw new Error('Decompressed data is not GVAS');
  const names = { [COMPRESSOR_KRAKEN]: 'oodle-kraken', [COMPRESSOR_ZLIB]: 'zlib' };
  return { gvas, compressor: [...compressors].map((c) => names[c] ?? String(c)).join('+') };
}

function decompressBlock(block, uncompressed, compressor) {
  if (compressor === COMPRESSOR_ZLIB) {
    const out = unzlibSync(block);
    return Buffer.from(out.buffer, out.byteOffset, out.byteLength);
  }
  if (compressor === COMPRESSOR_KRAKEN) {
    const out = Buffer.from(decompressUnsafe(block, uncompressed));
    if (out.length !== uncompressed) throw new Error('Oodle block size mismatch');
    return out;
  }
  throw new Error(`Unsupported compressor ${compressor}`);
}
