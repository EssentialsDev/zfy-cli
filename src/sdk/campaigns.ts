import type { ZeffyClient } from "./client.js";
import { CampaignSchema, type Campaign } from "./schemas.js";

export interface CampaignListFilters {
  limit?: number;
  starting_after?: string;
  created_gte?: number;
  created_lte?: number;
}

function toParams(f: CampaignListFilters): Record<string, string | number | undefined> {
  const out: Record<string, string | number | undefined> = {
    limit: f.limit,
    starting_after: f.starting_after,
  };
  if (f.created_gte !== undefined) out["created[gte]"] = f.created_gte;
  if (f.created_lte !== undefined) out["created[lte]"] = f.created_lte;
  return out;
}

export class CampaignsResource {
  constructor(private client: ZeffyClient) {}

  list(filters: CampaignListFilters = {}) {
    return this.client.list<Campaign>("/campaigns", CampaignSchema, toParams(filters));
  }

  iterate(filters: Omit<CampaignListFilters, "starting_after"> = {}) {
    return this.client.iterate<Campaign>("/campaigns", CampaignSchema, toParams(filters));
  }

  collect(filters: Omit<CampaignListFilters, "starting_after"> = {}, max?: number) {
    return this.client.collect<Campaign>("/campaigns", CampaignSchema, toParams(filters), max);
  }
}
