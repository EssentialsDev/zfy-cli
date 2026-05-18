import { describe, it, expect } from "vitest";
import { ZeffyClient, ZeffyApiError } from "../src/sdk/client.js";
import { PaymentSchema } from "../src/sdk/schemas.js";
import { payment } from "./fixtures.js";

function mockFetch(handlers: Array<(req: Request) => Response | Promise<Response>>) {
  let i = 0;
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(input as RequestInfo, init);
    const h = handlers[Math.min(i, handlers.length - 1)];
    if (!h) throw new Error("no handler");
    i++;
    return Promise.resolve(h(req));
  };
}

function jsonRes(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("ZeffyClient", () => {
  it("auto-paginates through cursors and stops when has_more=false", async () => {
    const p1 = payment({ id: "p1" });
    const p2 = payment({ id: "p2" });
    const p3 = payment({ id: "p3" });

    const fetchFn = mockFetch([
      (req) => {
        expect(req.headers.get("authorization")).toBe("Bearer test-key");
        expect(new URL(req.url).searchParams.get("starting_after")).toBe(null);
        return jsonRes({ data: [p1, p2], has_more: true, next_cursor: "cursor-2" });
      },
      (req) => {
        expect(new URL(req.url).searchParams.get("starting_after")).toBe("cursor-2");
        return jsonRes({ data: [p3], has_more: false, next_cursor: null });
      },
    ]);

    const client = new ZeffyClient({ apiKey: "test-key", fetch: fetchFn as typeof fetch });
    const all = await client.collect("/payments", PaymentSchema);
    expect(all.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("retries on 429 and respects Retry-After header", async () => {
    let calls = 0;
    const fetchFn = mockFetch([
      () => {
        calls++;
        return new Response("rate limited", { status: 429, headers: { "retry-after": "0" } });
      },
      () => {
        calls++;
        return jsonRes({ data: [payment({ id: "p1" })], has_more: false, next_cursor: null });
      },
    ]);
    const client = new ZeffyClient({
      apiKey: "k",
      fetch: fetchFn as typeof fetch,
      rateLimitPerMinute: 9999,
    });
    const res = await client.list("/payments", PaymentSchema);
    expect(res.data).toHaveLength(1);
    expect(calls).toBe(2);
  });

  it("throws ZeffyApiError on 401", async () => {
    const fetchFn = mockFetch([
      () =>
        new Response(JSON.stringify({ message: "Invalid API key" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
    ]);
    const client = new ZeffyClient({ apiKey: "bad", fetch: fetchFn as typeof fetch, maxRetries: 0 });
    await expect(client.list("/payments", PaymentSchema)).rejects.toBeInstanceOf(ZeffyApiError);
  });

  it("forwards query params including bracketed date filters", async () => {
    let capturedUrl = "";
    const fetchFn = mockFetch([
      (req) => {
        capturedUrl = req.url;
        return jsonRes({ data: [], has_more: false, next_cursor: null });
      },
    ]);
    const client = new ZeffyClient({ apiKey: "k", fetch: fetchFn as typeof fetch });
    await client.list("/payments", PaymentSchema, {
      "created[gte]": 1700000000,
      "created[lte]": 1800000000,
      status: "succeeded",
    });
    const url = new URL(capturedUrl);
    expect(url.searchParams.get("created[gte]")).toBe("1700000000");
    expect(url.searchParams.get("created[lte]")).toBe("1800000000");
    expect(url.searchParams.get("status")).toBe("succeeded");
  });
});
