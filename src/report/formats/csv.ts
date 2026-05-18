import { stringify } from "csv-stringify/sync";
import type { EoyReport } from "../eoy.js";

export function formatCsv(report: EoyReport): string {
  const rows = report.donors.map((d) => ({
    contact_id: d.contact_id ?? "",
    name: d.name ?? "",
    email: d.email ?? "",
    address_line1: d.address?.line1 ?? "",
    address_line2: d.address?.line2 ?? "",
    city: d.address?.city ?? "",
    state: d.address?.state ?? "",
    postal_code: d.address?.postal_code ?? "",
    country: d.address?.country ?? "",
    donation_count: d.donation_count,
    total_amount: d.total_amount.toFixed(2),
    currency: report.currency,
    year: report.year,
  }));
  return stringify(rows, { header: true });
}
