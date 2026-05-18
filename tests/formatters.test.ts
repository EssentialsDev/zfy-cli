import { describe, it, expect } from "vitest";
import type { EoyReport } from "../src/report/eoy.js";
import { formatJson } from "../src/report/formats/json.js";
import { formatCsv } from "../src/report/formats/csv.js";
import { formatMarkdown } from "../src/report/formats/md.js";

const sample: EoyReport = {
  year: 2025,
  timezone: "UTC",
  currency: "USD",
  generated_at: "2026-01-01T00:00:00.000Z",
  totals: { total_amount: 1400, donor_count: 2, donation_count: 4 },
  donors: [
    {
      contact_id: "ct_bob",
      name: "Bob Smith",
      email: "bob@example.com",
      address: { line1: "1 Way", city: "Seattle", state: "WA", postal_code: "98101", country: "US" },
      total_amount: 1050,
      donation_count: 2,
      payments: [
        { id: "p4", date: "2025-12-01T00:00:00.000Z", amount: 1000, campaign: "Annual Fund" },
        { id: "p3", date: "2025-06-01T00:00:00.000Z", amount: 50, campaign: "Annual Fund" },
      ],
    },
    {
      contact_id: "ct_jane",
      name: "Jane Doe",
      email: "jane@example.com",
      address: null,
      total_amount: 350,
      donation_count: 2,
      payments: [
        { id: "p1", date: "2025-03-01T00:00:00.000Z", amount: 100 },
        { id: "p2", date: "2025-07-01T00:00:00.000Z", amount: 250 },
      ],
    },
  ],
};

describe("formatters", () => {
  it("produces valid JSON", () => {
    const out = formatJson(sample);
    expect(JSON.parse(out)).toEqual(sample);
  });

  it("CSV has one header row + one row per donor", () => {
    const out = formatCsv(sample);
    const lines = out.trim().split("\n");
    expect(lines).toHaveLength(3); // header + 2 donors
    expect(lines[0]).toContain("contact_id");
    expect(lines[0]).toContain("total_amount");
    expect(lines[1]).toContain("ct_bob");
    expect(lines[1]).toContain("1050.00");
  });

  it("markdown summarizes totals and top donors", () => {
    const out = formatMarkdown(sample, 25);
    expect(out).toContain("# Donation report — 2025");
    expect(out).toContain("Total raised:");
    expect(out).toContain("Bob Smith");
    expect(out).toContain("Jane Doe");
    expect(out).toMatch(/\| 1 \| Bob Smith/);
  });
});
