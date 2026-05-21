import Stripe from "stripe";

type StripeApiVersion = NonNullable<
  ConstructorParameters<typeof Stripe>[1]
>["apiVersion"];

export interface StripeClient {
  createCheckoutSession(
    input: CheckoutInput,
  ): Promise<{ url: string; sessionId: string }>;
  retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session>;
  createCustomerPortalSession(input: PortalInput): Promise<{ url: string }>;
  verifyWebhookSignature(
    payload: string | Buffer,
    signatureHeader: string,
  ): Stripe.Event;
  cancelSubscription(
    stripeSubscriptionId: string,
  ): Promise<Stripe.Subscription>;
  retrieveInvoice(stripeInvoiceId: string): Promise<Stripe.Invoice>;
}

export interface CheckoutInput {
  priceId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  locale?: "auto" | "en" | "zh-TW" | "ja" | "ko" | "de" | "es" | "fr";
  trialDays?: number;
  metadata?: Record<string, string>;
}

export interface PortalInput {
  stripeCustomerId: string;
  returnUrl: string;
}

export interface StripeSdk {
  checkout: {
    sessions: {
      create(
        params: Stripe.Checkout.SessionCreateParams,
      ): Promise<Stripe.Response<Stripe.Checkout.Session>>;
      retrieve(id: string): Promise<Stripe.Response<Stripe.Checkout.Session>>;
    };
  };
  billingPortal: {
    sessions: {
      create(
        params: Stripe.BillingPortal.SessionCreateParams,
      ): Promise<Stripe.Response<Stripe.BillingPortal.Session>>;
    };
  };
  webhooks: {
    constructEvent(
      payload: string | Buffer,
      header: string,
      secret: string,
    ): Stripe.Event;
  };
  subscriptions: {
    cancel(id: string): Promise<Stripe.Response<Stripe.Subscription>>;
  };
  invoices: {
    retrieve(id: string): Promise<Stripe.Response<Stripe.Invoice>>;
  };
}

export class StripeWebhookSignatureError extends Error {
  override readonly name = "StripeWebhookSignatureError";

  constructor(cause: unknown) {
    super("Invalid Stripe webhook signature.", { cause });
  }
}

export class StripeSdkClient implements StripeClient {
  constructor(
    private readonly stripe: StripeSdk,
    private readonly webhookSecret: string,
  ) {}

  async createCheckoutSession(
    input: CheckoutInput,
  ): Promise<{ url: string; sessionId: string }> {
    const session = await this.stripe.checkout.sessions.create(
      toCheckoutSessionParams(input),
    );

    if (!session.url) {
      throw new Error("Stripe checkout session did not include a URL.");
    }

    return {
      url: session.url,
      sessionId: session.id,
    };
  }

  async retrieveCheckoutSession(
    sessionId: string,
  ): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.retrieve(sessionId);
  }

  async createCustomerPortalSession(
    input: PortalInput,
  ): Promise<{ url: string }> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: input.stripeCustomerId,
      return_url: input.returnUrl,
    });

    return {
      url: session.url,
    };
  }

  verifyWebhookSignature(
    payload: string | Buffer,
    signatureHeader: string,
  ): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signatureHeader,
        this.webhookSecret,
      );
    } catch (error) {
      throw new StripeWebhookSignatureError(error);
    }
  }

  async cancelSubscription(
    stripeSubscriptionId: string,
  ): Promise<Stripe.Subscription> {
    // Issue #57 chose immediate cancellation over cancel_at_period_end.
    return this.stripe.subscriptions.cancel(stripeSubscriptionId);
  }

  async retrieveInvoice(stripeInvoiceId: string): Promise<Stripe.Invoice> {
    return this.stripe.invoices.retrieve(stripeInvoiceId);
  }
}

export function createStripeClient(deps: {
  apiKey: string;
  webhookSecret: string;
  apiVersion?: StripeApiVersion;
}): StripeClient {
  return new StripeSdkClient(
    new Stripe(deps.apiKey, {
      apiVersion: deps.apiVersion,
    }),
    deps.webhookSecret,
  );
}

function toCheckoutSessionParams(
  input: CheckoutInput,
): Stripe.Checkout.SessionCreateParams {
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    payment_method_collection: "always",
    billing_address_collection: "required",
    customer_email: input.customerEmail,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: [
      {
        price: input.priceId,
        quantity: 1,
      },
    ],
  };

  if (input.locale !== undefined) {
    params.locale = input.locale;
  }

  if (input.metadata !== undefined) {
    params.metadata = input.metadata;
  }

  const subscriptionData: NonNullable<
    Stripe.Checkout.SessionCreateParams["subscription_data"]
  > = {};

  if (input.metadata !== undefined) {
    subscriptionData.metadata = input.metadata;
  }

  if (input.trialDays !== undefined) {
    subscriptionData.trial_period_days = input.trialDays;
  }

  if (Object.keys(subscriptionData).length > 0) {
    params.subscription_data = subscriptionData;
  }

  return params;
}
