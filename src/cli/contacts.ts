import { Command } from "commander";
import { loadClientOrExit, parseDateToUnix, printJson } from "./util.js";

export function contactsCommand(): Command {
  const cmd = new Command("contacts").description("List Zeffy contacts (donors)");

  cmd
    .command("list")
    .description("List contacts with optional filters (JSON output)")
    .option("--email <email>", "Filter by email")
    .option("--created-from <date>", "Created at or after (YYYY-MM-DD)")
    .option("--created-to <date>", "Created at or before (YYYY-MM-DD)")
    .option("--updated-from <date>", "Updated at or after (YYYY-MM-DD)")
    .option("--updated-to <date>", "Updated at or before (YYYY-MM-DD)")
    .option("--limit <n>", "Stop after N records (default: all)", (v) => Number(v))
    .action(async (opts: Record<string, string | number | undefined>) => {
      const zeffy = await loadClientOrExit();
      const filters = {
        email: opts["email"] as string | undefined,
        created_gte: parseDateToUnix(opts["createdFrom"] as string | undefined),
        created_lte: parseDateToUnix(opts["createdTo"] as string | undefined, true),
        updated_gte: parseDateToUnix(opts["updatedFrom"] as string | undefined),
        updated_lte: parseDateToUnix(opts["updatedTo"] as string | undefined, true),
      };
      const max = typeof opts["limit"] === "number" ? opts["limit"] : undefined;
      const data = await zeffy.contacts.collect(filters, max);
      printJson(data);
    });

  return cmd;
}
