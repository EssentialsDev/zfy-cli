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

// Report module — usable from your own code, not just the CLI
export { buildEoyReport } from "../report/eoy.js";
export type { EoyReport, EoyDonor, EoyDonorPayment, EoyOptions } from "../report/eoy.js";
export { formatJson } from "../report/formats/json.js";
export { formatCsv } from "../report/formats/csv.js";
export { formatMarkdown } from "../report/formats/md.js";
export { writePdfReceipts, renderDonorPdf, validateLogo } from "../report/formats/pdf.js";
export type { PdfOptions, LogoValidation } from "../report/formats/pdf.js";

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
