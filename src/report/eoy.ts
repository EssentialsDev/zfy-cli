import { fromZonedTime } from "date-fns-tz";
import type { Payment, Contact } from "../sdk/schemas.js";
import type { Zeffy } from "../sdk/index.js";

export interface EoyDonorPayment {
  id: string;
  date: string;
  amount: number;
  campaign?: string | null;
  campaign_id?: string | null;
  status?: string | null;
}

export interface EoyDonor {
  contact_id: string | null;
  name: string | null;
  email: string | null;
  address: Contact["address"] | null;
  total_amount: number;
  donation_count: number;
  payments: EoyDonorPayment[];
}

export interface EoyReport {
  year: number;
  timezone: string;
  currency: string;
  generated_at: string;
  totals: {
    total_amount: number;
    donor_count: number;
    donation_count: number;
  };
  donors: EoyDonor[];
}

export interface EoyOptions {
  year: number;
  /** IANA tz (e.g. "America/Los_Angeles"). Defaults to local system tz. */
  timezone?: string;
  /** Filter payments to a single currency code. */
  currency?: string;
  /** Filter payments to a single status (e.g. "succeeded"). Defaults to including all. */
  status?: string;
  /** Skip refunded payments entirely. Defaults to true. */
  excludeRefunded?: boolean;
}

export async function buildEoyReport(zeffy: Zeffy, opts: EoyOptions): Promise<EoyReport> {
  const tz = opts.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const start = fromZonedTime(`${opts.year}-01-01T00:00:00`, tz);
  const end = fromZonedTime(`${opts.year + 1}-01-01T00:00:00`, tz);

  const created_gte = Math.floor(start.getTime() / 1000);
  const created_lte = Math.floor(end.getTime() / 1000) - 1;

  const excludeRefunded = opts.excludeRefunded ?? true;
  const payments: Payment[] = [];
  for await (const p of zeffy.payments.iterate({
    created_gte,
    created_lte,
    currency: opts.currency,
    status: opts.status,
  })) {
    if (excludeRefunded && p.refunded) continue;
    payments.push(p);
  }

  const donorMap = new Map<string, EoyDonor>();
  let currency = opts.currency ?? "USD";

  for (const p of payments) {
    if (p.currency) currency = p.currency;
    const contactId = p.contact_id ?? p.contact?.id ?? null;
    const key = contactId ?? `__anon__:${p.id}`;
    const dateIso = toIsoString(p.created);

    let donor = donorMap.get(key);
    if (!donor) {
      const c = p.contact;
      donor = {
        contact_id: contactId,
        name: contactName(c),
        email: c?.email ?? null,
        address: c?.address ?? null,
        total_amount: 0,
        donation_count: 0,
        payments: [],
      };
      donorMap.set(key, donor);
    }
    donor.total_amount += p.amount;
    donor.donation_count += 1;
    donor.payments.push({
      id: p.id,
      date: dateIso,
      amount: p.amount,
      campaign: p.campaign?.name ?? null,
      campaign_id: p.campaign_id ?? p.campaign?.id ?? null,
      status: p.status ?? null,
    });
  }

  const donors = [...donorMap.values()].sort((a, b) => b.total_amount - a.total_amount);
  const totals = donors.reduce(
    (acc, d) => {
      acc.total_amount += d.total_amount;
      acc.donation_count += d.donation_count;
      acc.donor_count += 1;
      return acc;
    },
    { total_amount: 0, donor_count: 0, donation_count: 0 },
  );

  return {
    year: opts.year,
    timezone: tz,
    currency,
    generated_at: new Date().toISOString(),
    totals,
    donors,
  };
}

function contactName(c: Contact | null | undefined): string | null {
  if (!c) return null;
  if (c.name) return c.name;
  const parts = [c.first_name, c.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

function toIsoString(v: string | number | null | undefined): string {
  if (v == null) return "";
  if (typeof v === "number") return new Date(v * 1000).toISOString();
  const n = Number(v);
  if (Number.isFinite(n) && String(n) === v) return new Date(n * 1000).toISOString();
  return new Date(v).toISOString();
}
