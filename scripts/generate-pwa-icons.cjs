/**
 * Generate placeholder PWA icons for TradieMate
 *
 * Creates valid PNG files at 192x192 and 512x512 with the "TM" initials
 * on a dark background matching the app theme (#0f1419).
 *
 * These are functional placeholders. Replace with properly designed icons
 * before production release.
 *
 * Usage: node scripts/generate-pwa-icons.js
 */

const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

/**
 * Creates a minimal valid PNG file with a solid color.
 * This builds a raw PNG from scratch without any external dependencies.
 *
 * PNG format: signature + IHDR + IDAT (zlib-compressed raw image data) + IEND
 */
function createPng(width, height, r, g, b) {
  const zlib = require('zlib');

  // Build raw image data: each row starts with filter byte (0 = None)
  const rowSize = 1 + width * 3; // filter byte + RGB per pixel
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
    }
  }

  // Draw "TM" text as white pixels (simple bitmap font)
  drawTM(rawData, width, height, rowSize);

  // Compress raw data
  const compressed = zlib.deflateSync(rawData);

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = createChunk('IHDR', (() => {
    const buf = Buffer.alloc(13);
    buf.writeUInt32BE(width, 0);
    buf.writeUInt32BE(height, 4);
    buf[8] = 8;  // bit depth
    buf[9] = 2;  // color type: RGB
    buf[10] = 0; // compression
    buf[11] = 0; // filter
    buf[12] = 0; // interlace
    return buf;
  })());

  // IDAT chunk
  const idat = createChunk('IDAT', compressed);

  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

/**
 * CRC32 implementation for PNG chunks
 */
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Draw "TM" initials as white pixels on the image data.
 * Uses a simple blocky bitmap approach scaled to the image size.
 */
function drawTM(rawData, width, height, rowSize) {
  // Define "TM" as a simple 11x7 bitmap grid (each char ~5 wide, 1 space between)
  // T = columns 0-4, M = columns 6-10
  const bitmap = [
    '11111.11011',
    '00100.11011',
    '00100.10101',
    '00100.10101',
    '00100.10001',
    '00100.10001',
    '00100.10001',
  ];

  const gridW = 11;
  const gridH = 7;

  // Scale: center the text, taking about 50% of image width
  const textWidth = Math.floor(width * 0.5);
  const cellW = Math.floor(textWidth / gridW);
  const cellH = cellW; // square cells
  const textHeight = cellH * gridH;

  const startX = Math.floor((width - cellW * gridW) / 2);
  const startY = Math.floor((height - textHeight) / 2);

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      if (bitmap[gy][gx] === '1') {
        // Fill this cell with white pixels
        for (let dy = 0; dy < cellH; dy++) {
          for (let dx = 0; dx < cellW; dx++) {
            const px = startX + gx * cellW + dx;
            const py = startY + gy * cellH + dy;
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const offset = py * rowSize + 1 + px * 3;
              rawData[offset] = 255;     // R
              rawData[offset + 1] = 255; // G
              rawData[offset + 2] = 255; // B
            }
          }
        }
      }
    }
  }
}

// Theme color #0f1419 -> RGB(15, 20, 25)
const icon192 = createPng(192, 192, 15, 20, 25);
const icon512 = createPng(512, 512, 15, 20, 25);

fs.writeFileSync(path.join(iconsDir, 'icon-192x192.png'), icon192);
fs.writeFileSync(path.join(iconsDir, 'icon-512x512.png'), icon512);

console.log('PWA icons created in public/icons/:');
console.log(`  icon-192x192.png (${icon192.length} bytes)`);
console.log(`  icon-512x512.png (${icon512.length} bytes)`);
console.log('');
console.log('These are placeholder icons with "TM" initials on a dark background.');
console.log('Replace with properly designed icons before production release.');
