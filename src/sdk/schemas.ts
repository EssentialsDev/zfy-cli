import { z } from "zod";

const dateOrUnix = z.union([z.string(), z.number()]);

export const AddressSchema = z
  .object({
    line1: z.string().nullish(),
    line2: z.string().nullish(),
    city: z.string().nullish(),
    state: z.string().nullish(),
    postal_code: z.string().nullish(),
    country: z.string().nullish(),
  })
  .partial()
  .passthrough();

export const ContactSchema = z
  .object({
    id: z.string(),
    email: z.string().nullish(),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    name: z.string().nullish(),
    phone: z.string().nullish(),
    address: AddressSchema.nullish(),
    created: dateOrUnix.nullish(),
    updated: dateOrUnix.nullish(),
  })
  .passthrough();

export const CampaignSchema = z
  .object({
    id: z.string(),
    name: z.string().nullish(),
    type: z.string().nullish(),
    status: z.string().nullish(),
    goal: z.number().nullish(),
    raised: z.number().nullish(),
    currency: z.string().nullish(),
    created: dateOrUnix.nullish(),
  })
  .passthrough();

export const PaymentLineItemSchema = z
  .object({
    id: z.string().nullish(),
    description: z.string().nullish(),
    amount: z.number().nullish(),
    quantity: z.number().nullish(),
  })
  .passthrough();

export const PaymentSchema = z
  .object({
    id: z.string(),
    amount: z.number(),
    currency: z.string().nullish(),
    status: z.string().nullish(),
    type: z.string().nullish(),
    contact_id: z.string().nullish(),
    contact: ContactSchema.nullish(),
    campaign_id: z.string().nullish(),
    campaign: CampaignSchema.nullish(),
    line_items: z.array(PaymentLineItemSchema).nullish(),
    tax_receipt_eligible_amount: z.number().nullish(),
    refunded: z.boolean().nullish(),
    refunded_amount: z.number().nullish(),
    created: dateOrUnix,
  })
  .passthrough();

export const ListResponseSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    has_more: z.boolean(),
    next_cursor: z.string().nullish(),
  });

export type Address = z.infer<typeof AddressSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type Campaign = z.infer<typeof CampaignSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type PaymentLineItem = z.infer<typeof PaymentLineItemSchema>;

export interface ListResponse<T> {
  data: T[];
  has_more: boolean;
  next_cursor?: string | null;
}
