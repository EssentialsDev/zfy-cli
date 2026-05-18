import { Command } from "commander";
import pc from "picocolors";
import { authCommand } from "./auth.js";
import { paymentsCommand } from "./payments.js";
import { contactsCommand } from "./contacts.js";
import { campaignsCommand } from "./campaigns.js";
import { reportCommand } from "./report.js";
import { ZeffyApiError } from "../sdk/index.js";

const program = new Command();

program
  .name("zfy")
  .description("Third-party CLI for the Zeffy API — donations data for nonprofits and AI agents.")
  .version("0.1.0");

program.addCommand(authCommand());
program.addCommand(paymentsCommand());
program.addCommand(contactsCommand());
program.addCommand(campaignsCommand());
program.addCommand(reportCommand());

program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof ZeffyApiError) {
    console.error(pc.red(`Zeffy API error ${err.status}: ${err.message}`));
    if (err.body && process.env["DEBUG"]) console.error(err.body);
  } else {
    console.error(pc.red(err instanceof Error ? err.message : String(err)));
  }
  process.exit(1);
});
