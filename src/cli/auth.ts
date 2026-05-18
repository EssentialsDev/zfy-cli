import { Command } from "commander";
import pc from "picocolors";
import { clearConfig, getConfigPath, readConfig, resolveApiKey, writeConfig } from "./config.js";
import { promptHidden } from "./util.js";
import { Zeffy, ZeffyApiError } from "../sdk/index.js";

export function authCommand(): Command {
  const cmd = new Command("auth").description("Manage Zeffy API credentials");

  cmd
    .command("set")
    .description("Store a Zeffy API key in your local config")
    .option("--key <key>", "API key (skips the prompt)")
    .action(async (opts: { key?: string }) => {
      const key = opts.key ?? (await promptHidden("Zeffy API key: "));
      if (!key) {
        console.error(pc.red("No key provided."));
        process.exit(1);
      }
      const path = await writeConfig({ api_key: key });
      console.log(pc.green("Saved.") + ` ${pc.dim(path)}`);
    });

  cmd
    .command("status")
    .description("Verify the current API key by calling the Zeffy API")
    .action(async () => {
      const key = await resolveApiKey();
      if (!key) {
        console.log(pc.yellow("Not authenticated. Run `zfy auth set` or set ZEFFY_API_KEY."));
        process.exit(1);
      }
      const zeffy = new Zeffy({ apiKey: key });
      try {
        const res = await zeffy.campaigns.list({ limit: 1 });
        const sample = res.data[0];
        console.log(pc.green("Authenticated."));
        if (sample) {
          console.log(pc.dim(`Sample campaign: ${sample.name ?? sample.id}`));
        } else {
          console.log(pc.dim("(No campaigns yet on this account.)"));
        }
      } catch (err) {
        if (err instanceof ZeffyApiError) {
          console.error(pc.red(`API error ${err.status}: ${err.message}`));
        } else {
          console.error(pc.red(String(err)));
        }
        process.exit(1);
      }
    });

  cmd
    .command("clear")
    .description("Remove the stored API key from disk")
    .action(async () => {
      const removed = await clearConfig();
      console.log(removed ? pc.green("Cleared.") : pc.dim("No stored credential to clear."));
    });

  cmd
    .command("path")
    .description("Print the path to the config file")
    .action(async () => {
      const cfg = await readConfig();
      console.log(getConfigPath() + (cfg.api_key ? "" : pc.dim(" (empty)")));
    });

  return cmd;
}
