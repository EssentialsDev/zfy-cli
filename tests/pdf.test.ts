import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { writeFile, mkdtemp } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { renderDonorPdf, validateLogo, writePdfReceipts } from "../src/report/formats/pdf.js";
import type { EoyDonor, EoyReport } from "../src/report/eoy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_LOGO = path.join(__dirname, "..", "examples", "sample-logo.png");

const donor: EoyDonor = {
  contact_id: "ct_1",
  name: "Test Donor",
  email: "test@example.com",
  address: null,
  total_amount: 100,
  donation_count: 1,
  payments: [{ id: "p1", date: "2025-06-01T00:00:00.000Z", amount: 100 }],
};

const report: EoyReport = {
  year: 2025,
  timezone: "UTC",
  currency: "USD",
  generated_at: "2026-01-01T00:00:00.000Z",
  totals: { total_amount: 100, donor_count: 1, donation_count: 1 },
  donors: [donor],
};

function containsImageStream(pdfBuf: Buffer): boolean {
  const haystack = pdfBuf.toString("binary");
  return haystack.includes("/Subtype /Image") || haystack.includes("/Subtype/Image");
}

// --- Minimal PNG generator for fixtures ------------------------------------

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const b of buf) crc = (crcTable[(crc ^ b) & 0xff]! ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function makePng(width: number, height: number): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.alloc(width * 3 + 1, 0x44);
  row[0] = 0;
  const raw = Buffer.alloc(0);
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) rows.push(row);
  void raw;
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function tmpFile(name: string, contents: Buffer): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "zfy-test-"));
  const p = path.join(dir, name);
  await writeFile(p, contents);
  return p;
}

// --- Tests -----------------------------------------------------------------

describe("PDF receipt rendering", () => {
  it("produces a valid PDF buffer with the %PDF header", async () => {
    const buf = await renderDonorPdf(donor, report, { orgName: "Test Org" });
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("embeds an Image XObject when a valid logo is provided", async () => {
    const buf = await renderDonorPdf(donor, report, {
      orgName: "Test Org",
      logoPath: SAMPLE_LOGO,
    });
    expect(containsImageStream(buf)).toBe(true);
  });
});

describe("validateLogo", () => {
  it("accepts the example sample logo", async () => {
    const result = await validateLogo(SAMPLE_LOGO);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.format).toBe("png");
      expect(result.width).toBe(result.height); // square
    }
  });

  it("rejects a missing file", async () => {
    const result = await validateLogo("/nonexistent/logo.png");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("not found");
  });

  it("rejects an unsupported format (text file)", async () => {
    const p = await tmpFile("not-a-logo.txt", Buffer.from("hello world"));
    const result = await validateLogo(p);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("unsupported format");
  });

  it("rejects a file larger than 2 MB", async () => {
    const big = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(2 * 1024 * 1024 + 1, 0),
    ]);
    const p = await tmpFile("big.png", big);
    const result = await validateLogo(p);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/too large/);
  });

  it("rejects a logo smaller than 64×64 px", async () => {
    const p = await tmpFile("tiny.png", makePng(32, 32));
    const result = await validateLogo(p);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/too small/);
  });

  it("rejects a non-square logo", async () => {
    const p = await tmpFile("wide.png", makePng(400, 100));
    const result = await validateLogo(p);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("not square");
  });

  it("accepts a logo within ±10% of square", async () => {
    const p = await tmpFile("near-square.png", makePng(100, 105));
    const result = await validateLogo(p);
    expect(result.ok).toBe(true);
  });
});

describe("writePdfReceipts logo handling", () => {
  it("uses the logo when valid and emits no warning", async () => {
    const warnings: string[] = [];
    const dir = await mkdtemp(path.join(os.tmpdir(), "zfy-out-"));
    const files = await writePdfReceipts(report, dir, {
      orgName: "Test Org",
      logoPath: SAMPLE_LOGO,
      warnStream: { write: (s) => warnings.push(s) },
    });
    expect(files).toHaveLength(1);
    expect(warnings).toEqual([]);
    const buf = await import("node:fs/promises").then((m) => m.readFile(files[0]!));
    expect(containsImageStream(buf)).toBe(true);
  });

  it("warns and produces text-only receipts when the logo is invalid", async () => {
    const warnings: string[] = [];
    const dir = await mkdtemp(path.join(os.tmpdir(), "zfy-out-"));
    const badLogo = await tmpFile("wide.png", makePng(400, 100));
    const files = await writePdfReceipts(report, dir, {
      orgName: "Test Org",
      logoPath: badLogo,
      warnStream: { write: (s) => warnings.push(s) },
    });
    expect(files).toHaveLength(1);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatch(/skipping logo/);
    const buf = await import("node:fs/promises").then((m) => m.readFile(files[0]!));
    expect(containsImageStream(buf)).toBe(false);
  });
});
