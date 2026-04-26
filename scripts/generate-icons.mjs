#!/usr/bin/env node

/**
 * Generate PWA placeholder icons
 *
 * Creates simple monochrome PNG icons at all sizes referenced in manifest.json.
 * No external dependencies required — uses raw PNG encoding.
 *
 * Replace these with branded icons before production use.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const iconsDir = join(rootDir, 'public', 'icons');

// Create output directory
mkdirSync(iconsDir, { recursive: true });

const BG_COLOR = [0x0f, 0x17, 0x2a]; // #0f172a — matches theme_color
const FG_COLOR = [0xff, 0xff, 0xff]; // white

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const SHORTCUT_ICONS = [
  { name: 'shortcut-chat', label: 'C' },
  { name: 'shortcut-docs', label: 'D' },
  { name: 'shortcut-analytics', label: 'A' },
];

/**
 * Create a minimal valid PNG with a solid background and centered letter
 */
function createPNG(size, letter) {
  // Build RGBA pixel data
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Check if pixel is within a circle (for app icons) or rectangle (for shortcuts)
      const cx = size / 2;
      const cy = size / 2;
      const radius = size * 0.42;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

      if (dist <= radius) {
        // Inside circle — draw the letter
        const charSize = size * 0.55;
        const charTop = cy - charSize * 0.38;
        const charBottom = cy + charSize * 0.42;
        const charLeft = cx - charSize * 0.35;
        const charRight = cx + charSize * 0.35;

        // Simple bounding-box "font" for R, C, D, A
        const inLetter = isInLetter(x, y, charLeft, charTop, charRight, charBottom, letter, size);

        pixels[idx] = inLetter ? FG_COLOR[0] : BG_COLOR[0];
        pixels[idx + 1] = inLetter ? FG_COLOR[1] : BG_COLOR[1];
        pixels[idx + 2] = inLetter ? FG_COLOR[2] : BG_COLOR[2];
        pixels[idx + 3] = 255;
      } else {
        // Outside circle — transparent
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
      }
    }
  }

  return encodePNG(pixels, size, size);
}

function isInLetter(x, y, left, top, right, bottom, letter, size) {
  const strokeWidth = size * 0.08;

  switch (letter) {
    case 'R': {
      // Vertical bar on left
      if (x >= left && x <= left + strokeWidth && y >= top && y <= bottom) return true;
      // Top horizontal bar
      if (x >= left && x <= right && y >= top && y <= top + strokeWidth) return true;
      // Middle horizontal bar
      const midY = top + (bottom - top) * 0.5;
      if (x >= left && x <= right && y >= midY - strokeWidth / 2 && y <= midY + strokeWidth / 2) return true;
      // Right diagonal leg
      const diagStartX = right - strokeWidth;
      const diagEndX = right;
      const diagProgress = (y - midY) / (bottom - midY);
      if (y >= midY && diagProgress >= 0 && diagProgress <= 1) {
        const diagX = left + strokeWidth + diagProgress * (right - left - strokeWidth);
        if (x >= diagX - strokeWidth / 2 && x <= diagX + strokeWidth / 2) return true;
      }
      return false;
    }
    case 'C': {
      // C shape: three sides of a rectangle
      if (x >= left && x <= right) {
        // Top bar
        if (y >= top && y <= top + strokeWidth) return true;
        // Bottom bar
        if (y >= bottom - strokeWidth && y <= bottom) return true;
        // Left bar
        if (x >= left && x <= left + strokeWidth && y >= top && y <= bottom) return true;
      }
      return false;
    }
    case 'D': {
      // Left vertical bar
      if (x >= left && x <= left + strokeWidth && y >= top && y <= bottom) return true;
      // Top bar
      if (x >= left && x <= right * 0.7 && y >= top && y <= top + strokeWidth) return true;
      // Bottom bar
      if (x >= left && x <= right * 0.7 && y >= bottom - strokeWidth && y <= bottom) return true;
      // Right curve (approximated as vertical bar)
      if (x >= right * 0.65 - strokeWidth && x <= right * 0.65 && y >= top + strokeWidth && y <= bottom - strokeWidth) return true;
      return false;
    }
    case 'A': {
      // Left leg
      const legWidth = strokeWidth;
      const apexX = (left + right) / 2;
      const progress = (y - top) / (bottom - top);
      if (progress >= 0 && progress <= 1) {
        const leftLegX = apexX - progress * (right - left) * 0.5;
        const rightLegX = apexX + progress * (right - left) * 0.5;
        if (x >= leftLegX - legWidth / 2 && x <= leftLegX + legWidth / 2) return true;
        if (x >= rightLegX - legWidth / 2 && x <= rightLegX + legWidth / 2) return true;
      }
      // Cross bar
      const crossY = top + (bottom - top) * 0.6;
      if (y >= crossY - strokeWidth / 2 && y <= crossY + strokeWidth / 2) {
        const crossProgress = 0.6;
        const crossLeft = apexX - crossProgress * (right - left) * 0.5;
        const crossRight = apexX + crossProgress * (right - left) * 0.5;
        if (x >= crossLeft && x <= crossRight) return true;
      }
      return false;
    }
    default:
      return false;
  }
}

/**
 * Minimal PNG encoder (RFC 2083)
 * Creates an 8-bit RGBA PNG from raw pixel data
 */
function encodePNG(pixels, width, height) {
  // Build raw image data with filter byte (0 = None) per row
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = rowOffset + 1 + x * 4;
      rawData[dstIdx] = pixels[srcIdx];
      rawData[dstIdx + 1] = pixels[srcIdx + 1];
      rawData[dstIdx + 2] = pixels[srcIdx + 2];
      rawData[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }

  const compressed = deflateSync(rawData);

  // Build PNG file
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = createChunk('IHDR', (() => {
    const b = Buffer.alloc(13);
    b.writeUInt32BE(width, 0);
    b.writeUInt32BE(height, 4);
    b[8] = 8;  // bit depth
    b[9] = 6;  // color type: RGBA
    b[10] = 0; // compression
    b[11] = 0; // filter
    b[12] = 0; // interlace
    return b;
  })());

  const idat = createChunk('IDAT', compressed);
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Main
console.log('Generating PWA placeholder icons...\n');

// App icons
for (const size of ICON_SIZES) {
  const pngData = createPNG(size, 'R');
  const filename = `icon-${size}x${size}.png`;
  writeFileSync(join(iconsDir, filename), pngData);
  console.log(`  Created ${filename} (${pngData.length} bytes)`);
}

// Shortcut icons
for (const { name, label } of SHORTCUT_ICONS) {
  const pngData = createPNG(96, label);
  const filename = `${name}.png`;
  writeFileSync(join(iconsDir, filename), pngData);
  console.log(`  Created ${filename} (${pngData.length} bytes)`);
}

console.log('\nDone! Replace these placeholders with branded icons before production.');
