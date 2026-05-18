import { Command } from "commander";
import { loadClientOrExit, parseDateToUnix, printJson } from "./util.js";

export function campaignsCommand(): Command {
  const cmd = new Command("campaigns").description("List Zeffy campaigns");

  cmd
    .command("list")
    .description("List campaigns (JSON output)")
    .option("--created-from <date>", "Created at or after (YYYY-MM-DD)")
    .option("--created-to <date>", "Created at or before (YYYY-MM-DD)")
    .option("--limit <n>", "Stop after N records", (v) => Number(v))
    .action(async (opts: Record<string, string | number | undefined>) => {
      const zeffy = await loadClientOrExit();
      const filters = {
        created_gte: parseDateToUnix(opts["createdFrom"] as string | undefined),
        created_lte: parseDateToUnix(opts["createdTo"] as string | undefined, true),
      };
      const max = typeof opts["limit"] === "number" ? opts["limit"] : undefined;
      const data = await zeffy.campaigns.collect(filters, max);
      printJson(data);
    });

  return cmd;
}
