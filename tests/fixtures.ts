import type { Payment, Contact, Campaign } from "../src/sdk/schemas.js";

export function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: `pay_${Math.random().toString(36).slice(2, 10)}`,
    amount: 100,
    currency: "USD",
    status: "succeeded",
    type: "donation",
    contact_id: "ct_1",
    contact: contact(),
    campaign_id: "cm_1",
    campaign: campaign(),
    line_items: null,
    tax_receipt_eligible_amount: 100,
    refunded: false,
    refunded_amount: 0,
    created: "2025-06-15T12:00:00Z",
    ...overrides,
  } as Payment;
}

export function contact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "ct_1",
    email: "jane@example.com",
    first_name: "Jane",
    last_name: "Doe",
    name: "Jane Doe",
    phone: null,
    address: {
      line1: "100 Main St",
      city: "Portland",
      state: "OR",
      postal_code: "97201",
      country: "US",
    },
    created: "2024-01-15T00:00:00Z",
    updated: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

export function campaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: "cm_1",
    name: "Annual Fund 2025",
    type: "fundraiser",
    status: "active",
    goal: 50000,
    raised: 12345,
    currency: "USD",
    created: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}
