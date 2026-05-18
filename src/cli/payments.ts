import { Command } from "commander";
import { loadClientOrExit, parseDateToUnix, printJson } from "./util.js";

export function paymentsCommand(): Command {
  const cmd = new Command("payments").description("List Zeffy payments");

  cmd
    .command("list")
    .description("List payments with optional filters (JSON output)")
    .option("--from <date>", "Start date (YYYY-MM-DD or Unix seconds)")
    .option("--to <date>", "End date (YYYY-MM-DD or Unix seconds)")
    .option("--status <status>", "Filter by payment status")
    .option("--currency <code>", "Filter by 3-letter currency code")
    .option("--type <type>", "Filter by payment type")
    .option("--campaign <id>", "Filter by campaign id")
    .option("--contact <id>", "Filter by contact id")
    .option("--limit <n>", "Stop after N records (default: all)", (v) => Number(v))
    .action(async (opts: Record<string, string | number | undefined>) => {
      const zeffy = await loadClientOrExit();
      const filters = {
        created_gte: parseDateToUnix(opts["from"] as string | undefined),
        created_lte: parseDateToUnix(opts["to"] as string | undefined, true),
        status: opts["status"] as string | undefined,
        currency: opts["currency"] as string | undefined,
        type: opts["type"] as string | undefined,
        campaign_id: opts["campaign"] as string | undefined,
        contact_id: opts["contact"] as string | undefined,
      };
      const max = typeof opts["limit"] === "number" ? opts["limit"] : undefined;
      const data = await zeffy.payments.collect(filters, max);
      printJson(data);
    });

  return cmd;
}
