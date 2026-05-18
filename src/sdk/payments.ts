import type { ZeffyClient } from "./client.js";
import { PaymentSchema, type Payment } from "./schemas.js";

export interface PaymentListFilters {
  limit?: number;
  starting_after?: string;
  currency?: string;
  status?: string;
  type?: string;
  contact_id?: string;
  campaign_id?: string;
  /** Unix seconds — payments created at or after this timestamp. */
  created_gte?: number;
  /** Unix seconds — payments created at or before this timestamp. */
  created_lte?: number;
}

function toParams(f: PaymentListFilters): Record<string, string | number | undefined> {
  const out: Record<string, string | number | undefined> = {
    limit: f.limit,
    starting_after: f.starting_after,
    currency: f.currency,
    status: f.status,
    type: f.type,
    contact_id: f.contact_id,
    campaign_id: f.campaign_id,
  };
  if (f.created_gte !== undefined) out["created[gte]"] = f.created_gte;
  if (f.created_lte !== undefined) out["created[lte]"] = f.created_lte;
  return out;
}

export class PaymentsResource {
  constructor(private client: ZeffyClient) {}

  list(filters: PaymentListFilters = {}) {
    return this.client.list<Payment>("/payments", PaymentSchema, toParams(filters));
  }

  iterate(filters: Omit<PaymentListFilters, "starting_after"> = {}) {
    return this.client.iterate<Payment>("/payments", PaymentSchema, toParams(filters));
  }

  collect(filters: Omit<PaymentListFilters, "starting_after"> = {}, max?: number) {
    return this.client.collect<Payment>("/payments", PaymentSchema, toParams(filters), max);
  }
}
