import { describe, it, expect } from "vitest";
import { Zeffy } from "../src/sdk/index.js";
import { buildEoyReport } from "../src/report/eoy.js";
import { payment, contact } from "./fixtures.js";

function fakeFetch(pages: unknown[]) {
  let i = 0;
  return (() => {
    const body = pages[Math.min(i, pages.length - 1)];
    i++;
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }) as unknown as typeof fetch;
}

describe("buildEoyReport", () => {
  it("aggregates payments per donor and sorts by total descending", async () => {
    const jane = contact({ id: "ct_jane", name: "Jane Doe", email: "jane@example.com" });
    const bob = contact({ id: "ct_bob", name: "Bob Smith", email: "bob@example.com" });
    const data = [
      payment({ id: "p1", amount: 100, contact_id: "ct_jane", contact: jane }),
      payment({ id: "p2", amount: 250, contact_id: "ct_jane", contact: jane }),
      payment({ id: "p3", amount: 50, contact_id: "ct_bob", contact: bob }),
      payment({ id: "p4", amount: 1000, contact_id: "ct_bob", contact: bob }),
    ];
    const zeffy = new Zeffy({
      apiKey: "k",
      fetch: fakeFetch([{ data, has_more: false, next_cursor: null }]),
    });
    const report = await buildEoyReport(zeffy, { year: 2025, timezone: "UTC" });
    expect(report.donors).toHaveLength(2);
    expect(report.donors[0]?.contact_id).toBe("ct_bob");
    expect(report.donors[0]?.total_amount).toBe(1050);
    expect(report.donors[1]?.contact_id).toBe("ct_jane");
    expect(report.donors[1]?.total_amount).toBe(350);
    expect(report.totals.total_amount).toBe(1400);
    expect(report.totals.donor_count).toBe(2);
    expect(report.totals.donation_count).toBe(4);
  });

  it("excludes refunded payments by default", async () => {
    const data = [
      payment({ id: "p1", amount: 100, refunded: false }),
      payment({ id: "p2", amount: 200, refunded: true }),
    ];
    const zeffy = new Zeffy({
      apiKey: "k",
      fetch: fakeFetch([{ data, has_more: false, next_cursor: null }]),
    });
    const report = await buildEoyReport(zeffy, { year: 2025, timezone: "UTC" });
    expect(report.totals.total_amount).toBe(100);
  });

  it("respects timezone boundaries for year filter", async () => {
    let capturedGte = 0;
    let capturedLte = 0;
    const fetchFn = ((input: RequestInfo | URL) => {
      const url = new URL((input as Request).url ?? String(input));
      capturedGte = Number(url.searchParams.get("created[gte]"));
      capturedLte = Number(url.searchParams.get("created[lte]"));
      return Promise.resolve(
        new Response(JSON.stringify({ data: [], has_more: false, next_cursor: null }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }) as unknown as typeof fetch;

    const zeffy = new Zeffy({ apiKey: "k", fetch: fetchFn });
    await buildEoyReport(zeffy, { year: 2025, timezone: "America/Los_Angeles" });

    // 2025-01-01 00:00 PT = 2025-01-01 08:00 UTC = 1735718400
    expect(capturedGte).toBe(1735718400);
    // 2026-01-01 00:00 PT = 2026-01-01 08:00 UTC = 1767254400; lte is 1s before
    expect(capturedLte).toBe(1767254399);
  });
});
