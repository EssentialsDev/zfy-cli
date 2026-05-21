import { Command } from "commander";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";
import { loadClientOrExit } from "./util.js";
import { buildEoyReport } from "../report/eoy.js";
import { formatJson } from "../report/formats/json.js";
import { formatCsv } from "../report/formats/csv.js";
import { formatMarkdown } from "../report/formats/md.js";
import { writePdfReceipts } from "../report/formats/pdf.js";

type Format = "json" | "csv" | "md" | "markdown" | "pdf";

export function reportCommand(): Command {
  const cmd = new Command("report").description("Generate donation reports");

  cmd
    .command("eoy")
    .description("End-of-year donation report aggregated per donor")
    .requiredOption("--year <year>", "Calendar year, e.g. 2025", (v) => Number(v))
    .option("--format <format>", "json | csv | md | pdf", "json")
    .option("--out <path>", "Output file (or directory, for pdf). Defaults to stdout.")
    .option("--timezone <tz>", "IANA timezone (e.g. America/Los_Angeles). Defaults to system tz.")
    .option("--currency <code>", "Filter to a single currency code")
    .option("--status <status>", "Filter to a single payment status (e.g. succeeded)")
    .option("--include-refunded", "Include refunded payments (excluded by default)")
    .option("--top <n>", "Markdown: limit donor table to top N", (v) => Number(v))
    .option("--org <name>", "PDF: organization name for the header")
    .option("--logo <path>", "PDF: path to a square PNG/JPEG logo (~512×512, max 2 MB)")
    .option("--logo-size <pt>", "PDF: edge length of the square logo slot in points (default 48)", (v) => Number(v))
    .option("--receipt-text <text>", "PDF: override receipt boilerplate")
    .action(async (opts: Record<string, string | number | boolean | undefined>) => {
      const year = opts["year"] as number;
      if (!Number.isInteger(year) || year < 1900 || year > 9999) {
        console.error(pc.red(`Invalid --year: ${opts["year"]}`));
        process.exit(1);
      }
      const format = String(opts["format"] ?? "json").toLowerCase() as Format;
      const zeffy = await loadClientOrExit();
      const report = await buildEoyReport(zeffy, {
        year,
        timezone: opts["timezone"] as string | undefined,
        currency: opts["currency"] as string | undefined,
        status: opts["status"] as string | undefined,
        excludeRefunded: !opts["includeRefunded"],
      });

      const outPath = opts["out"] as string | undefined;

      if (format === "pdf") {
        const dir = outPath ?? path.join(process.cwd(), `eoy-${year}-receipts`);
        const written = await writePdfReceipts(report, dir, {
          orgName: opts["org"] as string | undefined,
          receiptText: opts["receiptText"] as string | undefined,
          logoPath: opts["logo"] as string | undefined,
          logoSize: typeof opts["logoSize"] === "number" ? (opts["logoSize"] as number) : undefined,
        });
        console.error(pc.green(`Wrote ${written.length} receipts to ${dir}`));
        return;
      }

      let body: string;
      if (format === "csv") body = formatCsv(report);
      else if (format === "md" || format === "markdown") {
        const topN = typeof opts["top"] === "number" ? (opts["top"] as number) : 25;
        body = formatMarkdown(report, topN);
      } else if (format === "json") body = formatJson(report);
      else {
        console.error(pc.red(`Unknown --format: ${format}`));
        process.exit(1);
      }

      if (outPath) {
        await mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
        await writeFile(outPath, body);
        console.error(pc.green(`Wrote ${outPath}`));
      } else {
        process.stdout.write(body.endsWith("\n") ? body : body + "\n");
      }
    });

  return cmd;
}
