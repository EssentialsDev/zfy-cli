import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { EoyDonor, EoyReport } from "../eoy.js";

export interface PdfOptions {
  /** Organization name for the receipt header. */
  orgName?: string;
  /** Free-form boilerplate text for tax-receipt language. */
  receiptText?: string;
  /** Path to a square PNG or JPEG logo. See validateLogo() for the spec. */
  logoPath?: string;
  /** Edge length in pt for the square logo slot (default 48). */
  logoSize?: number;
  /** Stream to write validation warnings to. Defaults to process.stderr. */
  warnStream?: { write(s: string): void };
}

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_MIN_PIXELS = 64;
const LOGO_ASPECT_TOLERANCE = 0.1; // ±10% off 1:1 is still accepted as "square"
const DEFAULT_LOGO_SIZE = 48;

export type LogoValidation =
  | { ok: true; width: number; height: number; format: "png" | "jpeg" }
  | { ok: false; reason: string };

/**
 * Validates a logo file against the constraints documented in the README:
 * PNG or JPEG, square (within ±10%), at least 64×64 px, max 2 MB.
 * Pure: never throws, never logs.
 */
export async function validateLogo(logoPath: string): Promise<LogoValidation> {
  let stats;
  try {
    stats = await stat(logoPath);
  } catch {
    return { ok: false, reason: `file not found: ${logoPath}` };
  }
  if (!stats.isFile()) return { ok: false, reason: `not a regular file: ${logoPath}` };
  if (stats.size > LOGO_MAX_BYTES) {
    return {
      ok: false,
      reason: `file too large (${formatBytes(stats.size)}, max ${formatBytes(LOGO_MAX_BYTES)})`,
    };
  }

  const head = await readFile(logoPath);
  const dims = readImageDimensions(head);
  if (!dims) {
    return { ok: false, reason: "unsupported format (only PNG and JPEG are accepted)" };
  }
  if (dims.width < LOGO_MIN_PIXELS || dims.height < LOGO_MIN_PIXELS) {
    return {
      ok: false,
      reason: `image too small (${dims.width}×${dims.height}, minimum ${LOGO_MIN_PIXELS}×${LOGO_MIN_PIXELS})`,
    };
  }
  const ratio = dims.width / dims.height;
  if (Math.abs(ratio - 1) > LOGO_ASPECT_TOLERANCE) {
    return {
      ok: false,
      reason: `image is not square (${dims.width}×${dims.height}); supply a square PNG/JPEG (e.g. 512×512)`,
    };
  }
  return { ok: true, width: dims.width, height: dims.height, format: dims.format };
}

interface ImageDims {
  width: number;
  height: number;
  format: "png" | "jpeg";
}

function readImageDimensions(buf: Buffer): ImageDims | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A, then IHDR at offset 8 with width @ 16, height @ 20 (BE uint32)
  if (
    buf.length >= 24 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), format: "png" };
  }
  // JPEG: FF D8 ... scan for SOF marker (FF C0..CF, skipping C4/C8/CC)
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off < buf.length - 9) {
      if (buf[off] !== 0xff) {
        off++;
        continue;
      }
      while (off < buf.length && buf[off] === 0xff) off++;
      const marker = buf[off];
      if (marker === undefined) return null;
      off++;
      if (marker === 0xd9 || marker === 0xda) return null; // end / start-of-scan
      const segLen = buf.readUInt16BE(off);
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof && off + 7 <= buf.length) {
        const height = buf.readUInt16BE(off + 3);
        const width = buf.readUInt16BE(off + 5);
        return { width, height, format: "jpeg" };
      }
      off += segLen;
    }
  }
  return null;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const DEFAULT_RECEIPT_TEXT =
  "Thank you for your generous support. No goods or services were provided in exchange for these contributions. Please consult your tax advisor regarding deductibility.";

export async function writePdfReceipts(
  report: EoyReport,
  outDir: string,
  opts: PdfOptions = {},
): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const effective = await resolveLogoOptions(opts);
  const written: string[] = [];
  for (const donor of report.donors) {
    const filename = receiptFilename(donor, report.year);
    const fullPath = path.join(outDir, filename);
    const buf = await renderDonorPdf(donor, report, effective);
    await writeFile(fullPath, buf);
    written.push(fullPath);
  }
  return written;
}

async function resolveLogoOptions(opts: PdfOptions): Promise<PdfOptions> {
  if (!opts.logoPath) return opts;
  const result = await validateLogo(opts.logoPath);
  if (result.ok) return opts;
  const out = opts.warnStream ?? process.stderr;
  out.write(`zfy: skipping logo — ${result.reason}\n`);
  const next: PdfOptions = { ...opts };
  delete next.logoPath;
  return next;
}

const ACCENT = "#1f3a5f";
const MUTED = "#6b7280";
const RULE = "#e5e7eb";
const ROW_ALT = "#f9fafb";

export function renderDonorPdf(
  donor: EoyDonor,
  report: EoyReport,
  opts: PdfOptions = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 54 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const orgName = opts.orgName ?? "Your Organization";
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const usable = right - left;

    // --- Header band: accent rule, org name, receipt label ---
    doc.rect(left, doc.y, usable, 3).fill(ACCENT);
    doc.moveDown(0.7);
    doc.fillColor("black");

    const headerY = doc.y;
    const logoSize = opts.logoSize ?? DEFAULT_LOGO_SIZE;
    const logoGutter = opts.logoPath ? logoSize + 14 : 0;
    if (opts.logoPath) {
      try {
        doc.image(opts.logoPath, left, headerY, { fit: [logoSize, logoSize] });
      } catch {
        /* fall through to text-only header */
      }
    }

    const textX = left + logoGutter;
    const textWidth = usable - logoGutter;
    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("black")
      .text(orgName, textX, headerY + 4, {
        width: textWidth,
      });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text(`OFFICIAL DONATION RECEIPT · ${report.year}`, textX, doc.y, {
        width: textWidth,
        characterSpacing: 1.2,
      });

    // Make sure the next section starts below the logo, not on top of it.
    doc.x = left;
    doc.y = Math.max(doc.y, headerY + logoSize);
    doc.moveDown(1.5);
    doc.fillColor("black");

    // --- Donor block + receipt date (two columns) ---
    const blockTop = doc.y;
    const colWidth = (usable - 20) / 2;

    doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("ISSUED TO", left, blockTop, {
      width: colWidth,
      characterSpacing: 1,
    });
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fontSize(12).fillColor("black").text(donor.name ?? "(Anonymous donor)", {
      width: colWidth,
    });
    doc.font("Helvetica").fontSize(10).fillColor("#374151");
    if (donor.email) doc.text(donor.email, { width: colWidth });
    if (donor.address) {
      const a = donor.address;
      const addrLines = [
        a.line1,
        a.line2,
        [a.city, a.state, a.postal_code].filter(Boolean).join(", "),
        a.country,
      ].filter(Boolean) as string[];
      for (const line of addrLines) doc.text(line, { width: colWidth });
    }

    // Right column: issue date + donation count
    const rightColX = left + colWidth + 20;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("ISSUED", rightColX, blockTop, {
      width: colWidth,
      characterSpacing: 1,
    });
    doc.moveDown(0.3);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("black")
      .text(formatIssuedDate(report.generated_at), { width: colWidth });
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("DONATIONS", {
      width: colWidth,
      characterSpacing: 1,
    });
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10).fillColor("black").text(`${donor.donation_count} gift${donor.donation_count === 1 ? "" : "s"} in ${report.year}`, {
      width: colWidth,
    });

    // Reset cursor below whichever column is taller
    doc.x = left;
    doc.y = Math.max(doc.y, blockTop + 110);
    doc.moveDown(0.5);

    // --- Total box ---
    const boxY = doc.y;
    doc.roundedRect(left, boxY, usable, 64, 6).fill(ACCENT);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#cbd5e1")
      .text("TOTAL CONTRIBUTED", left + 20, boxY + 14, {
        characterSpacing: 1.2,
        width: usable - 40,
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(28)
      .fillColor("white")
      .text(money(donor.total_amount, report.currency), left + 20, boxY + 28, {
        width: usable - 40,
      });
    doc.y = boxY + 64;
    doc.moveDown(1.2);
    doc.fillColor("black");

    // --- Itemized table ---
    doc.font("Helvetica-Bold").fontSize(10).text("Itemized gifts", left);
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const colDate = left;
    const colCampaign = left + 90;
    const colAmount = right;
    const rowHeight = 22;

    // Header row
    doc.rect(left, tableTop, usable, rowHeight).fill(ROW_ALT);
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(MUTED)
      .text("DATE", colDate + 10, tableTop + 7, { characterSpacing: 1 });
    doc.text("CAMPAIGN", colCampaign, tableTop + 7, { characterSpacing: 1 });
    doc.text("AMOUNT", left, tableTop + 7, {
      width: usable - 10,
      align: "right",
      characterSpacing: 1,
    });

    let rowY = tableTop + rowHeight;
    donor.payments.forEach((p, i) => {
      if (i % 2 === 1) {
        doc.rect(left, rowY, usable, rowHeight).fill(ROW_ALT);
      }
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("black")
        .text(p.date ? p.date.slice(0, 10) : "—", colDate + 10, rowY + 7);
      doc.text(p.campaign ?? "—", colCampaign, rowY + 7, {
        width: colAmount - colCampaign - 90,
        ellipsis: true,
      });
      doc.text(money(p.amount, report.currency), left, rowY + 7, {
        width: usable - 10,
        align: "right",
      });
      rowY += rowHeight;
    });

    // Bottom border
    doc.moveTo(left, rowY).lineTo(right, rowY).strokeColor(RULE).lineWidth(0.5).stroke();
    doc.y = rowY + 20;

    // --- Footer / boilerplate ---
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(RULE).lineWidth(0.5).stroke();
    doc.moveDown(0.8);
    doc
      .font("Helvetica-Oblique")
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(opts.receiptText ?? DEFAULT_RECEIPT_TEXT, left, doc.y, {
        width: usable,
        align: "left",
        lineGap: 2,
      });

    doc.end();
  });
}

function formatIssuedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function receiptFilename(donor: EoyDonor, year: number): string {
  const slug = (donor.name ?? donor.email ?? donor.contact_id ?? "anonymous")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return `${year}-${slug || "anonymous"}.pdf`;
}
