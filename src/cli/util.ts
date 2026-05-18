import { createInterface } from "node:readline";
import pc from "picocolors";
import { Zeffy } from "../sdk/index.js";
import { resolveApiKey } from "./config.js";

export async function loadClientOrExit(): Promise<Zeffy> {
  const key = await resolveApiKey();
  if (!key) {
    console.error(
      pc.red("No Zeffy API key configured.") +
        "\nRun " +
        pc.bold("zfy auth set") +
        " or export " +
        pc.bold("ZEFFY_API_KEY") +
        ".",
    );
    process.exit(1);
  }
  return new Zeffy({ apiKey: key });
}

export function parseDateToUnix(input: string | undefined, endOfDay = false): number | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (/^\d{10}$/.test(trimmed)) return Number(trimmed);
  if (/^\d{13}$/.test(trimmed)) return Math.floor(Number(trimmed) / 1000);
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? endOfDay
      ? `${trimmed}T23:59:59`
      : `${trimmed}T00:00:00`
    : trimmed;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid date: ${input}`);
  return Math.floor(ms / 1000);
}

export async function promptHidden(question: string): Promise<string> {
  process.stdout.write(question);
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const rl = createInterface({ input: stdin, output: process.stdout });
    const onData = (char: Buffer | string) => {
      const s = char.toString();
      if (s === "\n" || s === "\r" || s === "\r\n") return;
      process.stdout.write("*");
    };
    // best-effort: not all environments support raw mode masking
    if (typeof stdin.setRawMode === "function") {
      try {
        stdin.setRawMode(false);
      } catch {}
    }
    stdin.on("data", onData);
    rl.question("", (answer) => {
      stdin.removeListener("data", onData);
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

export function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}
