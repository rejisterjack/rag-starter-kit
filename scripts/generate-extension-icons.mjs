/**
 * Generates branded Chrome extension icons for RAG Starter Kit.
 * No external dependencies — pure Node.js built-ins (zlib, fs).
 *
 * Design:
 *   • Rounded indigo (#6366f1) background
 *   • White "R" lettermark (pixel-art, scales to each size)
 *
 * Produces: extensions/chrome/icons/icon{16,32,48,128}.png
 * Run:      node scripts/generate-extension-icons.mjs
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../extensions/chrome/icons');

// ─── PNG helpers ─────────────────────────────────────────────────────────────

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(typeStr, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const type = Buffer.from(typeStr, 'ascii');
  const crcInput = Buffer.concat([type, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, type, data, crcBuf]);
}

/**
 * Build a PNG from a pixel callback `getPixel(x, y) → [r, g, b, a]`.
 * Uses RGBA (color type 6) for transparency support.
 */
function buildPNG(size, getPixel) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA

  const rowLen = 1 + size * 4;
  const raw = Buffer.alloc(size * rowLen);
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = getPixel(x, y, size);
      const o = y * rowLen + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Icon design ──────────────────────────────────────────────────────────────

// Brand colours
const BG = [99, 102, 241];      // indigo-500
const FG = [255, 255, 255];     // white
const BG2 = [79, 70, 229];     // indigo-600 (gradient shadow)

/**
 * "R" lettermark defined on a 7×9 grid (fits cleanly at all target sizes).
 * 1 = foreground, 0 = background.
 */
const R_PIXELS = [
  [1, 1, 1, 1, 0, 0, 0],
  [1, 0, 0, 0, 1, 0, 0],
  [1, 0, 0, 0, 1, 0, 0],
  [1, 1, 1, 1, 0, 0, 0],
  [1, 0, 1, 0, 0, 0, 0],
  [1, 0, 0, 1, 0, 0, 0],
  [1, 0, 0, 0, 1, 0, 0],
  [1, 0, 0, 0, 0, 1, 0],
  [1, 0, 0, 0, 0, 0, 1],
];
const LETTER_W = 7;
const LETTER_H = 9;

function getPixel(x, y, size) {
  // Rounded-rectangle background
  const pad = Math.round(size * 0.1);
  const radius = Math.round(size * 0.22);

  // Check rounded corners
  const inCorner = (cx, cy) =>
    Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) > radius;

  const left = pad, right = size - 1 - pad;
  const top = pad, bottom = size - 1 - pad;

  const inBg =
    x >= left && x <= right &&
    y >= top && y <= bottom &&
    !(x < left + radius && y < top + radius && inCorner(left + radius, top + radius)) &&
    !(x > right - radius && y < top + radius && inCorner(right - radius, top + radius)) &&
    !(x < left + radius && y > bottom - radius && inCorner(left + radius, bottom - radius)) &&
    !(x > right - radius && y > bottom - radius && inCorner(right - radius, bottom - radius));

  if (!inBg) return [0, 0, 0, 0]; // transparent outside badge

  // Subtle diagonal gradient: top-left lighter, bottom-right darker
  const gradientFactor = (x + y) / (size * 2);
  const r = Math.round(BG[0] + (BG2[0] - BG[0]) * gradientFactor);
  const g = Math.round(BG[1] + (BG2[1] - BG[1]) * gradientFactor);
  const b = Math.round(BG[2] + (BG2[2] - BG[2]) * gradientFactor);

  // Letter area
  const innerSize = size - pad * 2;
  const letterScale = innerSize / Math.max(LETTER_W, LETTER_H);
  const letterPixelW = Math.round(letterScale * 0.7);
  const letterPixelH = Math.round(letterScale * 0.7);

  // Centre the letter within the badge
  const letterTotalW = LETTER_W * letterPixelW;
  const letterTotalH = LETTER_H * letterPixelH;
  const offsetX = pad + Math.round((innerSize - letterTotalW) / 2);
  const offsetY = pad + Math.round((innerSize - letterTotalH) / 2);

  const lx = Math.floor((x - offsetX) / (letterPixelW || 1));
  const ly = Math.floor((y - offsetY) / (letterPixelH || 1));

  if (
    lx >= 0 && lx < LETTER_W &&
    ly >= 0 && ly < LETTER_H &&
    R_PIXELS[ly]?.[lx] === 1
  ) {
    return [...FG, 255];
  }

  return [r, g, b, 255];
}

// ─── Generate ─────────────────────────────────────────────────────────────────

fs.mkdirSync(outDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const buf = buildPNG(size, getPixel);
  const outPath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(outPath, buf);
  console.log(`✔ icon${size}.png  (${buf.length} bytes)  →  ${outPath}`);
}

console.log('\nDone. Branded Chrome extension icons generated successfully.');
