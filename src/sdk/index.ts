import { ZeffyClient, type ZeffyClientOptions } from "./client.js";
import { PaymentsResource } from "./payments.js";
import { ContactsResource } from "./contacts.js";
import { CampaignsResource } from "./campaigns.js";

export { ZeffyClient, ZeffyApiError } from "./client.js";
export type { ZeffyClientOptions } from "./client.js";
export { PaymentsResource } from "./payments.js";
export { ContactsResource } from "./contacts.js";
export { CampaignsResource } from "./campaigns.js";
export type { PaymentListFilters } from "./payments.js";
export type { ContactListFilters } from "./contacts.js";
export type { CampaignListFilters } from "./campaigns.js";
export * from "./schemas.js";

export class Zeffy {
  readonly client: ZeffyClient;
  readonly payments: PaymentsResource;
  readonly contacts: ContactsResource;
  readonly campaigns: CampaignsResource;

  constructor(opts: ZeffyClientOptions | string) {
    const options = typeof opts === "string" ? { apiKey: opts } : opts;
    this.client = new ZeffyClient(options);
    this.payments = new PaymentsResource(this.client);
    this.contacts = new ContactsResource(this.client);
    this.campaigns = new CampaignsResource(this.client);
  }
}
