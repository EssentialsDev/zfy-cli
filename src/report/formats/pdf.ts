import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { EoyDonor, EoyReport } from "../eoy.js";

export interface PdfOptions {
  /** Organization name for the receipt header. */
  orgName?: string;
  /** Free-form boilerplate text for tax-receipt language. */
  receiptText?: string;
}

const DEFAULT_RECEIPT_TEXT =
  "Thank you for your generous support. No goods or services were provided in exchange for these contributions. Please consult your tax advisor regarding deductibility.";

export async function writePdfReceipts(
  report: EoyReport,
  outDir: string,
  opts: PdfOptions = {},
): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const written: string[] = [];
  for (const donor of report.donors) {
    const filename = receiptFilename(donor, report.year);
    const fullPath = path.join(outDir, filename);
    const buf = await renderDonorPdf(donor, report, opts);
    await writeFile(fullPath, buf);
    written.push(fullPath);
  }
  return written;
}

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
    doc.fontSize(18).text(orgName, { align: "left" });
    doc.fontSize(10).fillColor("#555").text(`Donation Receipt — ${report.year}`);
    doc.moveDown();
    doc.fillColor("black");

    doc.fontSize(11).text(donor.name ?? "(Anonymous donor)");
    if (donor.email) doc.text(donor.email);
    if (donor.address) {
      const a = donor.address;
      const lines = [
        a.line1,
        a.line2,
        [a.city, a.state, a.postal_code].filter(Boolean).join(", "),
        a.country,
      ].filter(Boolean) as string[];
      for (const line of lines) doc.text(line);
    }
    doc.moveDown();

    doc.fontSize(12).text(`Total ${report.year} contributions: ${money(donor.total_amount, report.currency)}`, {
      underline: true,
    });
    doc.fontSize(10).text(`${donor.donation_count} donation${donor.donation_count === 1 ? "" : "s"}`);
    doc.moveDown();

    doc.fontSize(11).text("Itemized contributions");
    doc.moveDown(0.5);
    doc.fontSize(9);
    for (const p of donor.payments) {
      const date = p.date ? p.date.slice(0, 10) : "";
      const campaign = p.campaign ? ` — ${p.campaign}` : "";
      doc.text(`${date}  ${money(p.amount, report.currency).padStart(12)}${campaign}`);
    }

    doc.moveDown();
    doc.fontSize(9).fillColor("#555").text(opts.receiptText ?? DEFAULT_RECEIPT_TEXT, {
      align: "left",
    });
    doc.end();
  });
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
