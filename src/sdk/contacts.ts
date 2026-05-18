import type { ZeffyClient } from "./client.js";
import { ContactSchema, type Contact } from "./schemas.js";

export interface ContactListFilters {
  limit?: number;
  starting_after?: string;
  email?: string;
  created_gte?: number;
  created_lte?: number;
  updated_gte?: number;
  updated_lte?: number;
}

function toParams(f: ContactListFilters): Record<string, string | number | undefined> {
  const out: Record<string, string | number | undefined> = {
    limit: f.limit,
    starting_after: f.starting_after,
    email: f.email,
  };
  if (f.created_gte !== undefined) out["created[gte]"] = f.created_gte;
  if (f.created_lte !== undefined) out["created[lte]"] = f.created_lte;
  if (f.updated_gte !== undefined) out["updated[gte]"] = f.updated_gte;
  if (f.updated_lte !== undefined) out["updated[lte]"] = f.updated_lte;
  return out;
}

export class ContactsResource {
  constructor(private client: ZeffyClient) {}

  list(filters: ContactListFilters = {}) {
    return this.client.list<Contact>("/contacts", ContactSchema, toParams(filters));
  }

  iterate(filters: Omit<ContactListFilters, "starting_after"> = {}) {
    return this.client.iterate<Contact>("/contacts", ContactSchema, toParams(filters));
  }

  collect(filters: Omit<ContactListFilters, "starting_after"> = {}, max?: number) {
    return this.client.collect<Contact>("/contacts", ContactSchema, toParams(filters), max);
  }
}
