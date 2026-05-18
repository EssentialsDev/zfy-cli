import { z } from "zod";
import { ListResponseSchema, type ListResponse } from "./schemas.js";

export interface ZeffyClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Cap requests/min — Zeffy allows 100, default 90 leaves headroom. */
  rateLimitPerMinute?: number;
  /** Max attempts on 429 / 5xx. */
  maxRetries?: number;
  /** Override fetch (for tests). */
  fetch?: typeof fetch;
}

export class ZeffyApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ZeffyApiError";
  }
}

type ListParams = Record<string, string | number | boolean | undefined>;

export class ZeffyClient {
  private apiKey: string;
  private baseUrl: string;
  private maxRetries: number;
  private fetchFn: typeof fetch;
  private requestTimestamps: number[] = [];
  private rateLimit: number;

  constructor(opts: ZeffyClientOptions) {
    if (!opts.apiKey) throw new Error("ZeffyClient: apiKey is required");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? "https://api.zeffy.com/api/v1").replace(/\/+$/, "");
    this.maxRetries = opts.maxRetries ?? 5;
    this.fetchFn = opts.fetch ?? globalThis.fetch;
    this.rateLimit = opts.rateLimitPerMinute ?? 90;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const windowStart = now - 60_000;
    this.requestTimestamps = this.requestTimestamps.filter((t) => t > windowStart);
    if (this.requestTimestamps.length >= this.rateLimit) {
      const oldest = this.requestTimestamps[0];
      if (oldest !== undefined) {
        const waitMs = 60_000 - (now - oldest) + 50;
        await sleep(waitMs);
      }
    }
    this.requestTimestamps.push(Date.now());
  }

  async request<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }
    }

    let attempt = 0;
    while (true) {
      await this.throttle();
      const res = await this.fetchFn(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
          "User-Agent": "zfy-cli/0.1.0 (+https://github.com/zfy/zfy)",
        },
      });

      if (res.ok) {
        return (await res.json()) as T;
      }

      const retryable = res.status === 429 || (res.status >= 500 && res.status < 600);
      if (retryable && attempt < this.maxRetries) {
        const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
        const backoff = retryAfter ?? Math.min(2 ** attempt * 500, 30_000);
        await sleep(backoff);
        attempt++;
        continue;
      }

      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = await res.text().catch(() => undefined);
      }
      const msg =
        typeof body === "object" && body && "message" in body
          ? String((body as { message: unknown }).message)
          : res.statusText || `HTTP ${res.status}`;
      throw new ZeffyApiError(res.status, msg, body);
    }
  }

  async list<T>(
    path: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    params: ListParams = {},
  ): Promise<ListResponse<T>> {
    const raw = await this.request<unknown>(path, params);
    const parsed = ListResponseSchema(schema).safeParse(raw);
    if (!parsed.success) {
      throw new ZeffyApiError(
        500,
        `Failed to parse response from ${path}: ${parsed.error.message}`,
        raw,
      );
    }
    return parsed.data as ListResponse<T>;
  }

  async *iterate<T>(
    path: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    params: ListParams = {},
  ): AsyncIterable<T> {
    let cursor: string | undefined;
    const pageLimit = typeof params["limit"] === "number" ? params["limit"] : 100;
    while (true) {
      const page = await this.list<T>(path, schema, {
        ...params,
        limit: pageLimit,
        starting_after: cursor,
      });
      for (const item of page.data) yield item;
      if (!page.has_more || !page.next_cursor) return;
      cursor = page.next_cursor;
    }
  }

  async collect<T>(
    path: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    params: ListParams = {},
    max?: number,
  ): Promise<T[]> {
    const out: T[] = [];
    for await (const item of this.iterate<T>(path, schema, params)) {
      out.push(item);
      if (max !== undefined && out.length >= max) break;
    }
    return out;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return undefined;
}
