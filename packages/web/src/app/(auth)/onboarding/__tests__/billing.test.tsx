import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() =>
  vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);

const checkoutMock = vi.hoisted(() =>
  vi.fn(async () => ({
    url: "https://checkout.stripe.com/c/pay/cs_test_123",
    sessionId: "cs_test_123",
  })),
);

const getUserMock = vi.hoisted(() =>
  vi.fn(async () => ({
    data: {
      user: {
        id: "user-1",
        email: "buyer@example.com",
        user_metadata: { locale: "zh-TW" },
      },
    },
  })),
);

const membershipQuery = vi.hoisted(() => ({
  select: vi.fn(() => membershipQuery),
  eq: vi.fn(() => membershipQuery),
  limit: vi.fn(() => membershipQuery),
  maybeSingle: vi.fn(async () => ({
    data: { company_id: "company-1" },
    error: null,
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ host: "app.example.com" })),
}));

vi.mock("@shared/supabase", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    from: vi.fn((table: string) => {
      if (table === "company_members") return membershipQuery;
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
}));

vi.mock("@/lib/payments/stripe/price-ids", () => ({
  getPriceId: vi.fn(() => "price_solo_monthly"),
  isStripePlanId: vi.fn((plan: string) => plan === "solo_monthly"),
}));

vi.mock("@/lib/payments/stripe/server", () => ({
  getStripeClient: vi.fn(() => ({
    createCheckoutSession: checkoutMock,
  })),
}));

import BillingPage from "../billing/page";

describe("/onboarding/billing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  });

  it("creates a Stripe Checkout session for the requested plan and redirects", async () => {
    await expect(
      BillingPage({
        searchParams: Promise.resolve({ plan: "solo_monthly" }),
      }),
    ).rejects.toThrow(
      "NEXT_REDIRECT:https://checkout.stripe.com/c/pay/cs_test_123",
    );

    expect(membershipQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(membershipQuery.eq).toHaveBeenCalledWith("status", "active");
    expect(checkoutMock).toHaveBeenCalledWith({
      priceId: "price_solo_monthly",
      customerEmail: "buyer@example.com",
      successUrl:
        "https://app.example.com/onboarding/welcome?session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://app.example.com/pricing?cancelled=1",
      locale: "zh-TW",
      trialDays: 7,
      metadata: {
        user_id: "user-1",
        company_id: "company-1",
      },
    });
  });
});
