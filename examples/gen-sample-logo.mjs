// Generates examples/sample-logo.png — a placeholder logo for documentation
// and PDF rendering tests. Solid colored band with a simple gradient so it
// reads as "demo placeholder" without claiming any real brand identity.
//
// Run: node examples/gen-sample-logo.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import path from "node:path";

const WIDTH = 256;
const HEIGHT = 256;

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = (crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(width, height, pixel) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type (RGB)
  // compression, filter, interlace all 0
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(width * 3 + 1);
    row[0] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      row[1 + x * 3] = r;
      row[2 + x * 3] = g;
      row[3 + x * 3] = b;
    }
    rows.push(row);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Rounded-square placeholder mark: teal→indigo gradient with a centered "Z".
function pixel(x, y) {
  const r = 32;
  const corner = (px, py) => {
    const dx = px < r ? r - px : px >= WIDTH - r ? px - (WIDTH - r - 1) : 0;
    const dy = py < r ? r - py : py >= HEIGHT - r ? py - (HEIGHT - r - 1) : 0;
    return dx * dx + dy * dy > r * r;
  };
  if (corner(x, y)) return [255, 255, 255];

  const t = (x + y) / (WIDTH + HEIGHT - 2);
  const r0 = Math.round(20 + t * 70);
  const g0 = Math.round(160 - t * 100);
  const b0 = Math.round(170 + t * 40);

  const pad = 64;
  if (drawZ(x, y, pad, pad, WIDTH - pad * 2, HEIGHT - pad * 2)) return [255, 255, 255];

  return [r0, g0, b0];
}

function drawZ(x, y, ox, oy, w, h) {
  const stroke = 18;
  // Top bar
  if (y >= oy && y < oy + stroke && x >= ox && x < ox + w) return true;
  // Bottom bar
  if (y >= oy + h - stroke && y < oy + h && x >= ox && x < ox + w) return true;
  // Diagonal: from top-right to bottom-left
  // Parametrize: t in [0,1], x = ox + w - t*w, y = oy + t*h. Distance from line:
  // line: y - oy = -(h/w)*(x - (ox+w))  =>  h*(x-(ox+w)) + w*(y-oy) = 0
  const num = Math.abs(h * (x - (ox + w)) + w * (y - oy));
  const denom = Math.sqrt(h * h + w * w);
  if (num / denom < stroke / 2) return true;
  return false;
}

const png = makePng(WIDTH, HEIGHT, pixel);
const out = path.join(path.dirname(new URL(import.meta.url).pathname), "sample-logo.png");
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, png);
console.log("wrote", out, `(${png.length} bytes)`);
