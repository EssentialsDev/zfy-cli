import { mkdir, readFile, writeFile, chmod, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export interface StoredConfig {
  api_key?: string;
}

function configDir(): string {
  const xdg = process.env["XDG_CONFIG_HOME"];
  if (xdg) return path.join(xdg, "zfy");
  return path.join(os.homedir(), ".config", "zfy");
}

function configPath(): string {
  return path.join(configDir(), "config.json");
}

export async function readConfig(): Promise<StoredConfig> {
  try {
    const raw = await readFile(configPath(), "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

export async function writeConfig(cfg: StoredConfig): Promise<string> {
  const dir = configDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const p = configPath();
  await writeFile(p, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
  await chmod(p, 0o600).catch(() => {});
  return p;
}

export async function clearConfig(): Promise<boolean> {
  try {
    await unlink(configPath());
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
}

export async function resolveApiKey(): Promise<string | undefined> {
  const env = process.env["ZEFFY_API_KEY"];
  if (env && env.trim()) return env.trim();
  const cfg = await readConfig();
  return cfg.api_key;
}

export function getConfigPath(): string {
  return configPath();
}
