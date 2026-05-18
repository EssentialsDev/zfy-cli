import type { EoyReport } from "../eoy.js";

export function formatMarkdown(report: EoyReport, topN = 25): string {
  const lines: string[] = [];
  const cur = report.currency;
  lines.push(`# Donation report — ${report.year}`);
  lines.push("");
  lines.push(`Generated ${report.generated_at} · Timezone ${report.timezone}`);
  lines.push("");
  lines.push(`## Totals`);
  lines.push(`- Total raised: ${money(report.totals.total_amount, cur)}`);
  lines.push(`- Unique donors: ${report.totals.donor_count}`);
  lines.push(`- Total donations: ${report.totals.donation_count}`);
  if (report.totals.donor_count > 0) {
    const avg = report.totals.total_amount / report.totals.donor_count;
    lines.push(`- Average per donor: ${money(avg, cur)}`);
  }
  lines.push("");
  lines.push(`## Top ${Math.min(topN, report.donors.length)} donors`);
  lines.push("");
  lines.push("| # | Donor | Email | Gifts | Total |");
  lines.push("| --- | --- | --- | ---: | ---: |");
  report.donors.slice(0, topN).forEach((d, i) => {
    lines.push(
      `| ${i + 1} | ${escape(d.name ?? "(anonymous)")} | ${escape(d.email ?? "")} | ${d.donation_count} | ${money(d.total_amount, cur)} |`,
    );
  });
  if (report.donors.length > topN) {
    lines.push("");
    lines.push(`_…and ${report.donors.length - topN} more donors._`);
  }
  return lines.join("\n") + "\n";
}

function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function escape(s: string): string {
  return s.replace(/\|/g, "\\|");
}
