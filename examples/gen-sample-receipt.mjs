// Generates a sample EOY receipt PDF using the real renderer.
// Requires the package to be built first (imports from ../dist/sdk).
// Run: pnpm build && node examples/gen-sample-receipt.mjs [outPath]
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { renderDonorPdf } from "../dist/sdk/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? path.join(__dirname, "sample-receipt.pdf");

const donor = {
  contact_id: "ct_demo",
  name: "Jordan Rivera",
  email: "jordan.rivera@example.org",
  address: {
    line1: "1428 Maple Street",
    line2: "Apt 3B",
    city: "Portland",
    state: "OR",
    postal_code: "97214",
    country: "United States",
  },
  total_amount: 1450,
  donation_count: 6,
  payments: [
    { id: "p1", date: "2025-01-15T00:00:00.000Z", amount: 250, campaign: "Winter Appeal" },
    { id: "p2", date: "2025-03-02T00:00:00.000Z", amount: 100, campaign: "General Fund" },
    { id: "p3", date: "2025-05-20T00:00:00.000Z", amount: 500, campaign: "Library Renovation" },
    { id: "p4", date: "2025-08-11T00:00:00.000Z", amount: 100, campaign: "General Fund" },
    { id: "p5", date: "2025-10-04T00:00:00.000Z", amount: 250, campaign: "Fall Membership Drive" },
    { id: "p6", date: "2025-12-22T00:00:00.000Z", amount: 250, campaign: "Year-End Match" },
  ],
};

const report = {
  year: 2025,
  timezone: "America/Los_Angeles",
  currency: "USD",
  generated_at: "2026-01-15T17:00:00.000Z",
  totals: { total_amount: 1450, donor_count: 1, donation_count: 6 },
  donors: [donor],
};

const buf = await renderDonorPdf(donor, report, {
  orgName: "Friends of the Library",
  logoPath: path.join(__dirname, "sample-logo.png"),
});
await writeFile(out, buf);
console.log(`Wrote ${out} (${buf.length} bytes)`);
