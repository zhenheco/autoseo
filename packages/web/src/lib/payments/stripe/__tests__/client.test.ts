import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  StripeSdkClient,
  StripeWebhookSignatureError,
  type StripeSdk,
} from "../client";

class MockStripeSdk implements StripeSdk {
  readonly checkoutSessionsCreate =
    vi.fn<
      (
        params: Stripe.Checkout.SessionCreateParams,
      ) => Promise<Stripe.Response<Stripe.Checkout.Session>>
    >();

  readonly billingPortalSessionsCreate =
    vi.fn<
      (
        params: Stripe.BillingPortal.SessionCreateParams,
      ) => Promise<Stripe.Response<Stripe.BillingPortal.Session>>
    >();

  readonly webhooksConstructEvent =
    vi.fn<
      (payload: string | Buffer, header: string, secret: string) => Stripe.Event
    >();

  readonly subscriptionsCancel =
    vi.fn<(id: string) => Promise<Stripe.Response<Stripe.Subscription>>>();

  readonly invoicesRetrieve =
    vi.fn<(id: string) => Promise<Stripe.Response<Stripe.Invoice>>>();

  readonly checkout = {
    sessions: {
      create: this.checkoutSessionsCreate,
    },
  };

  readonly billingPortal = {
    sessions: {
      create: this.billingPortalSessionsCreate,
    },
  };

  readonly webhooks = {
    constructEvent: this.webhooksConstructEvent,
  };

  readonly subscriptions = {
    cancel: this.subscriptionsCancel,
  };

  readonly invoices = {
    retrieve: this.invoicesRetrieve,
  };
}

describe("StripeSdkClient", () => {
  const webhookSecret = "whsec_test_secret";
  let stripe: MockStripeSdk;
  let client: StripeSdkClient;

  beforeEach(() => {
    stripe = new MockStripeSdk();
    client = new StripeSdkClient(stripe, webhookSecret);
  });

  it("creates a subscription checkout session and returns the public URL plus session id", async () => {
    stripe.checkoutSessionsCreate.mockResolvedValue(
      stripeResponse({
        id: "cs_test_123",
        object: "checkout.session",
        url: "https://checkout.stripe.com/c/pay/cs_test_123",
      } as Stripe.Checkout.Session),
    );

    const result = await client.createCheckoutSession({
      priceId: "price_solo_monthly",
      customerEmail: "buyer@example.com",
      successUrl: "https://app.example.com/success",
      cancelUrl: "https://app.example.com/cancel",
      locale: "zh-TW",
      trialDays: 14,
      metadata: {
        companyId: "company_123",
        planSlug: "solo",
      },
    });

    expect(result).toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
      sessionId: "cs_test_123",
    });
    expect(stripe.checkoutSessionsCreate).toHaveBeenCalledWith({
      mode: "subscription",
      payment_method_collection: "always",
      billing_address_collection: "required",
      customer_email: "buyer@example.com",
      success_url: "https://app.example.com/success",
      cancel_url: "https://app.example.com/cancel",
      locale: "zh-TW",
      line_items: [
        {
          price: "price_solo_monthly",
          quantity: 1,
        },
      ],
      metadata: {
        companyId: "company_123",
        planSlug: "solo",
      },
      subscription_data: {
        metadata: {
          companyId: "company_123",
          planSlug: "solo",
        },
        trial_period_days: 14,
      },
    });
  });

  it("creates a customer portal session and returns the portal URL", async () => {
    stripe.billingPortalSessionsCreate.mockResolvedValue(
      stripeResponse({
        id: "bps_test_123",
        object: "billing_portal.session",
        url: "https://billing.stripe.com/p/session/bps_test_123",
      } as Stripe.BillingPortal.Session),
    );

    await expect(
      client.createCustomerPortalSession({
        stripeCustomerId: "cus_test_123",
        returnUrl: "https://app.example.com/dashboard/billing",
      }),
    ).resolves.toEqual({
      url: "https://billing.stripe.com/p/session/bps_test_123",
    });
    expect(stripe.billingPortalSessionsCreate).toHaveBeenCalledWith({
      customer: "cus_test_123",
      return_url: "https://app.example.com/dashboard/billing",
    });
  });

  it("propagates Stripe SDK failures while creating a customer portal session", async () => {
    stripe.billingPortalSessionsCreate.mockRejectedValue(
      new Error("Stripe API unavailable"),
    );

    await expect(
      client.createCustomerPortalSession({
        stripeCustomerId: "cus_test_123",
        returnUrl: "https://app.example.com/dashboard/billing",
      }),
    ).rejects.toThrow("Stripe API unavailable");
  });

  it("returns the parsed event when webhook signature verification succeeds", () => {
    const payload = JSON.stringify({ id: "evt_test_123", object: "event" });
    const event = {
      id: "evt_test_123",
      object: "event",
      type: "checkout.session.completed",
    } as Stripe.Event;

    stripe.webhooksConstructEvent.mockReturnValue(event);

    expect(
      client.verifyWebhookSignature(payload, "valid-signature-header"),
    ).toBe(event);
    expect(stripe.webhooksConstructEvent).toHaveBeenCalledWith(
      payload,
      "valid-signature-header",
      webhookSecret,
    );
  });

  it("throws StripeWebhookSignatureError when the webhook payload string does not match the signature", () => {
    const stripeError = new Error(
      "No signatures found matching the expected signature for payload.",
    );
    stripe.webhooksConstructEvent.mockImplementation(() => {
      throw stripeError;
    });

    expect(() =>
      client.verifyWebhookSignature("tampered-payload", "bad-signature"),
    ).toThrow(StripeWebhookSignatureError);

    try {
      client.verifyWebhookSignature("tampered-payload", "bad-signature");
    } catch (error) {
      expect(error).toBeInstanceOf(StripeWebhookSignatureError);
      expect((error as StripeWebhookSignatureError).cause).toBe(stripeError);
    }
  });

  it("throws StripeWebhookSignatureError when the webhook timestamp is out of tolerance", () => {
    const stripeError = new Error("Timestamp outside the tolerance zone");
    stripe.webhooksConstructEvent.mockImplementation(() => {
      throw stripeError;
    });

    expect(() =>
      client.verifyWebhookSignature("{}", "old-timestamp-header"),
    ).toThrow(StripeWebhookSignatureError);
  });

  it("cancels a Stripe subscription immediately", async () => {
    const subscription = stripeResponse({
      id: "sub_test_123",
      object: "subscription",
      status: "canceled",
    } as Stripe.Subscription);
    stripe.subscriptionsCancel.mockResolvedValue(subscription);

    await expect(client.cancelSubscription("sub_test_123")).resolves.toBe(
      subscription,
    );
    expect(stripe.subscriptionsCancel).toHaveBeenCalledWith("sub_test_123");
  });

  it("retrieves a Stripe invoice by id", async () => {
    const invoice = stripeResponse({
      id: "in_test_123",
      object: "invoice",
      status: "paid",
    } as Stripe.Invoice);
    stripe.invoicesRetrieve.mockResolvedValue(invoice);

    await expect(client.retrieveInvoice("in_test_123")).resolves.toBe(invoice);
    expect(stripe.invoicesRetrieve).toHaveBeenCalledWith("in_test_123");
  });
});

function stripeResponse<T extends object>(resource: T): Stripe.Response<T> {
  return {
    ...resource,
    lastResponse: {
      headers: {},
      requestId: "req_test",
      statusCode: 200,
    },
  };
}
