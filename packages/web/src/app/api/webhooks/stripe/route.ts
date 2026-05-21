import type Stripe from "stripe";

import { createAdminClient } from "@shared/supabase";
import {
  captureTrialCardAdded,
  captureTrialConverted,
} from "@/lib/analytics/posthog-server";
import {
  enqueueTransactionalTemplateEmail,
  type TransactionalTemplateName,
} from "@/lib/email/cf-email-client";
import { getStripeClient } from "@/lib/payments/stripe/server";
import {
  transition,
  type SideEffect,
  type TrialEvent,
  type TrialState,
} from "@/lib/payments/trial/state-machine";
import type { Database, Json } from "@/types/database.types";

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;
type CompanySubscriptionRow =
  Database["public"]["Tables"]["company_subscriptions"]["Row"];
type TrialRow = Database["public"]["Tables"]["trials"]["Row"];
type SubscriptionPlanRow =
  Database["public"]["Tables"]["subscription_plans"]["Row"];

type WebhookContext = {
  userId: string;
  companyId: string;
  planId: string;
  planSlug?: string;
  trialId?: string;
  trial?: TrialRow | null;
  subscription?: CompanySubscriptionRow | null;
  email?: string;
  billingCountry?: string;
};

type Metadata = Record<string, string>;

const DUPLICATE_ERROR_CODE = "23505";
const DEFAULT_TRIAL_DAYS = 14;

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const sigHeader = req.headers.get("stripe-signature");

  if (!sigHeader) {
    return Response.json(
      { error: "missing_stripe_signature" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    event = getStripeClient().verifyWebhookSignature(rawBody, sigHeader);
  } catch (error) {
    console.warn("[stripe-webhook] signature verification failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "invalid_stripe_signature" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const inserted = await insertStripeEvent(supabase, event);
  if (!inserted) {
    return Response.json({ received: true, duplicate: true });
  }

  try {
    await processStripeEvent(supabase, event);
    await markStripeEventProcessed(supabase, event.id);
    return Response.json({ received: true });
  } catch (error) {
    await releaseStripeEventForRetry(supabase, event.id);
    console.error("[stripe-webhook] processing failed", {
      eventId: event.id,
      type: event.type,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "stripe_webhook_processing_failed" },
      { status: 500 },
    );
  }
}

async function insertStripeEvent(
  supabase: SupabaseAdminClient,
  event: Stripe.Event,
): Promise<boolean> {
  const { error } = await supabase.from("stripe_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event as unknown as Json,
  });

  if (!error) return true;
  if (isDuplicateError(error)) return false;
  throw error;
}

async function markStripeEventProcessed(
  supabase: SupabaseAdminClient,
  eventId: string,
) {
  const { error } = await supabase
    .from("stripe_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("stripe_event_id", eventId);

  if (error) throw error;
}

async function releaseStripeEventForRetry(
  supabase: SupabaseAdminClient,
  eventId: string,
) {
  await supabase.from("stripe_events").delete().eq("stripe_event_id", eventId);
}

async function processStripeEvent(
  supabase: SupabaseAdminClient,
  event: Stripe.Event,
) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(
        supabase,
        event,
        event.data.object as Stripe.Checkout.Session,
      );
      return;
    case "customer.subscription.trial_will_end":
      await handleSubscriptionTrialWillEnd(
        supabase,
        event,
        event.data.object as Stripe.Subscription,
      );
      return;
    case "invoice.paid":
      await handleInvoicePaid(
        supabase,
        event,
        event.data.object as Stripe.Invoice,
      );
      return;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(
        supabase,
        event,
        event.data.object as Stripe.Invoice,
      );
      return;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(
        supabase,
        event,
        event.data.object as Stripe.Subscription,
      );
      return;
    default:
      console.warn("[stripe-webhook] unknown event type acknowledged", {
        eventId: event.id,
        type: event.type,
      });
  }
}

async function handleCheckoutSessionCompleted(
  supabase: SupabaseAdminClient,
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
) {
  const metadata = readMetadata(session);
  const subscriptionId = getExpandableId(session.subscription);
  if (!subscriptionId) {
    throw new Error("checkout_session_missing_subscription");
  }

  const plan = await resolvePlan(supabase, metadata);
  const userId = requireMetadata(metadata, "userId", "user_id");
  const companyId = requireMetadata(metadata, "companyId", "company_id");
  const trialEndsAt = resolveTrialEndsAt(session, metadata);
  const billingCountry =
    session.customer_details?.address?.country ??
    metadata.billingCountry ??
    "unknown";
  const customerId = getExpandableId(session.customer);
  const trialId = crypto.randomUUID();
  const now = new Date().toISOString();

  const machineEvent = {
    type: "card_added",
    at: new Date(),
  } satisfies TrialEvent;
  const result = transition("pending", machineEvent);

  await assertOk(
    supabase.from("trials").insert({
      id: trialId,
      user_id: userId,
      company_id: companyId,
      plan_id: plan.id,
      ends_at: trialEndsAt,
      stripe_subscription_id: subscriptionId,
      card_brand: readCardBrand(session),
      card_last4: readCardLast4(session),
    }),
  );

  await assertOk(
    supabase.from("company_subscriptions").upsert(
      {
        company_id: companyId,
        plan_id: plan.id,
        status: "trialing",
        purchased_token_balance: 0,
        monthly_quota_balance: plan.base_tokens,
        monthly_token_quota: plan.base_tokens,
        articles_per_month: plan.articles_per_month,
        subscription_articles_remaining: plan.articles_per_month,
        provider: "stripe",
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        trial_ends_at: trialEndsAt,
        trial_card_added_at: now,
        trial_end: trialEndsAt,
        current_period_start: now,
        current_period_end: trialEndsAt,
        billing_country: billingCountry,
        currency: "USD",
      },
      { onConflict: "company_id" },
    ),
  );

  await applySideEffects(supabase, {
    event,
    context: {
      userId,
      companyId,
      planId: plan.id,
      planSlug: plan.slug,
      trialId,
      email: readCustomerEmail(session, metadata),
      billingCountry,
    },
    sideEffects: result.sideEffects,
  });

  captureTrialCardAdded({
    userId,
    trialId,
    cardBrand: readCardBrand(session) ?? "unknown",
  });
}

async function handleSubscriptionTrialWillEnd(
  supabase: SupabaseAdminClient,
  event: Stripe.Event,
  subscription: Stripe.Subscription,
) {
  const context = await resolveContextForSubscription(supabase, subscription);
  const result = transition(resolveCurrentState(context), {
    type: "trial_will_end",
    daysOut: 3,
  });

  await applySideEffects(supabase, {
    event,
    context,
    sideEffects: result.sideEffects,
  });
}

async function handleInvoicePaid(
  supabase: SupabaseAdminClient,
  event: Stripe.Event,
  invoice: Stripe.Invoice,
) {
  const subscriptionId = readInvoiceSubscriptionId(invoice);
  if (!subscriptionId) throw new Error("invoice_missing_subscription");

  const context = await resolveContextForSubscriptionId(
    supabase,
    subscriptionId,
    readMetadata(invoice),
    readInvoiceCustomerEmail(invoice),
  );
  const stripeInvoiceId = invoice.id;
  const amountUsd = centsToUsd(
    readNumber(invoice, "amount_paid") ??
      readNumber(invoice, "amount_due") ??
      0,
  );
  const billingCountry =
    readInvoiceBillingCountry(invoice) ?? context.billingCountry ?? "unknown";
  const amegoStatus = billingCountry === "TW" ? "pending" : "not_applicable";
  const paidAt =
    timestampToIso(readNumber(invoice, "status_transitions.paid_at")) ??
    new Date().toISOString();
  const result = transition(resolveCurrentState(context), {
    type: "invoice_paid",
    at: new Date(paidAt),
    stripeInvoiceId,
  });

  await assertOk(
    supabase
      .from("trials")
      .update({ converted_at: new Date().toISOString() })
      .eq("stripe_subscription_id", subscriptionId),
  );
  await assertOk(
    supabase.from("invoices").insert({
      stripe_invoice_id: stripeInvoiceId,
      user_id: context.userId,
      company_id: context.companyId,
      amount_usd: amountUsd,
      billing_country: billingCountry,
      amego_status: amegoStatus,
      paid_at: paidAt,
    }),
  );

  await applySideEffects(supabase, {
    event,
    context,
    sideEffects: result.sideEffects,
  });

  if (amegoStatus === "pending") {
    enqueueAmegoIssuePlaceholder(stripeInvoiceId);
  }

  captureTrialConverted({
    userId: context.userId,
    trialId: context.trialId ?? context.trial?.id ?? "unknown",
    planId: context.planId,
    amountUsd,
  });
}

async function handleInvoicePaymentFailed(
  supabase: SupabaseAdminClient,
  event: Stripe.Event,
  invoice: Stripe.Invoice,
) {
  const subscriptionId = readInvoiceSubscriptionId(invoice);
  if (!subscriptionId) throw new Error("invoice_missing_subscription");

  const context = await resolveContextForSubscriptionId(
    supabase,
    subscriptionId,
    readMetadata(invoice),
    readInvoiceCustomerEmail(invoice),
  );
  const stripeInvoiceId = invoice.id;
  const result = transition(resolveCurrentState(context), {
    type: "payment_failed",
    at: new Date(),
    stripeInvoiceId,
  });

  await assertOk(
    supabase
      .from("company_subscriptions")
      .update({ status: "past_due" })
      .eq("stripe_subscription_id", subscriptionId),
  );

  await applySideEffects(supabase, {
    event,
    context,
    sideEffects: result.sideEffects,
  });
}

async function handleSubscriptionDeleted(
  supabase: SupabaseAdminClient,
  event: Stripe.Event,
  subscription: Stripe.Subscription,
) {
  const context = await resolveContextForSubscription(supabase, subscription);
  const result = transition(resolveCurrentState(context), {
    type: "cancel_requested",
    at: new Date(),
  });

  await assertOk(
    supabase
      .from("company_subscriptions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("stripe_subscription_id", subscription.id),
  );

  await applySideEffects(supabase, {
    event,
    context,
    sideEffects: result.sideEffects,
  });
}

async function resolveContextForSubscription(
  supabase: SupabaseAdminClient,
  subscription: Stripe.Subscription,
) {
  return resolveContextForSubscriptionId(
    supabase,
    subscription.id,
    readMetadata(subscription),
  );
}

async function resolveContextForSubscriptionId(
  supabase: SupabaseAdminClient,
  subscriptionId: string,
  metadata: Metadata,
  email?: string,
): Promise<WebhookContext> {
  const { data: subscription, error: subscriptionError } = await supabase
    .from("company_subscriptions")
    .select("*")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;

  const { data: trial, error: trialError } = await supabase
    .from("trials")
    .select("*")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (trialError) throw trialError;

  const userId =
    readMetadataValue(metadata, "userId", "user_id") ??
    trial?.user_id ??
    undefined;
  const companyId =
    readMetadataValue(metadata, "companyId", "company_id") ??
    subscription?.company_id ??
    trial?.company_id ??
    undefined;
  const planId =
    readMetadataValue(metadata, "planId", "plan_id") ??
    subscription?.plan_id ??
    trial?.plan_id ??
    undefined;

  if (!userId || !companyId || !planId) {
    throw new Error("stripe_event_missing_internal_context");
  }

  return {
    userId,
    companyId,
    planId,
    planSlug: readMetadataValue(metadata, "planSlug", "plan_slug"),
    trialId: trial?.id,
    trial,
    subscription,
    billingCountry: subscription?.billing_country ?? undefined,
    email:
      email ??
      readMetadataValue(metadata, "userEmail", "user_email", "email") ??
      (await readUserEmail(supabase, userId)),
  };
}

async function resolvePlan(
  supabase: SupabaseAdminClient,
  metadata: Metadata,
): Promise<SubscriptionPlanRow> {
  const planId = readMetadataValue(metadata, "planId", "plan_id");
  const planSlug = readMetadataValue(metadata, "planSlug", "plan_slug");

  if (!planId && !planSlug) {
    throw new Error("stripe_checkout_missing_plan_metadata");
  }

  let query = supabase.from("subscription_plans").select("*");
  query = planId ? query.eq("id", planId) : query.eq("slug", planSlug!);
  const { data, error } = await query.single();
  if (error) throw error;
  if (!data) throw new Error("stripe_checkout_plan_not_found");

  return data;
}

async function applySideEffects(
  supabase: SupabaseAdminClient,
  input: {
    event: Stripe.Event;
    context: WebhookContext;
    sideEffects: SideEffect[];
  },
) {
  for (const sideEffect of input.sideEffects) {
    switch (sideEffect.kind) {
      case "send_email":
        await sendTemplateEmail(
          input.event,
          input.context,
          sideEffect.template,
        );
        break;
      case "mark_subscription_active":
        await assertOk(
          supabase
            .from("company_subscriptions")
            .update({ status: "active" })
            .eq("stripe_subscription_id", findSubscriptionId(input.context)),
        );
        break;
      case "start_dunning":
        // Issue #75 will expand this into the full D-3/D-7 dunning sequence.
        break;
      case "downgrade_account":
        // Read-only behavior is enforced from subscription status elsewhere.
        break;
    }
  }
}

async function sendTemplateEmail(
  event: Stripe.Event,
  context: WebhookContext,
  template: TransactionalTemplateName,
) {
  if (!context.email) {
    throw new Error("stripe_webhook_email_missing");
  }

  const result = await enqueueTransactionalTemplateEmail({
    to: context.email,
    template,
    idempotencyKey: `stripe:${event.id}:${template}`,
    context: {
      userId: context.userId,
      companyId: context.companyId,
      planId: context.planId,
      trialId: context.trialId,
    },
  });

  if (!result.ok) {
    throw new Error(result.error ?? "stripe_webhook_email_failed");
  }
}

function resolveCurrentState(context: WebhookContext): TrialState {
  if (context.trial?.cancelled_at) return "cancelled";
  if (context.trial?.converted_at) return "converted";
  if (context.trial?.ends_at && new Date(context.trial.ends_at) < new Date()) {
    return "expired";
  }
  if (context.subscription?.status === "cancelled") return "cancelled";
  if (context.subscription?.status === "active") return "converted";
  return "active";
}

function findSubscriptionId(context: WebhookContext) {
  const subscriptionId =
    context.subscription?.stripe_subscription_id ??
    context.trial?.stripe_subscription_id;
  if (!subscriptionId) throw new Error("stripe_subscription_id_missing");
  return subscriptionId;
}

function resolveTrialEndsAt(
  session: Stripe.Checkout.Session,
  metadata: Metadata,
): string {
  const expandedSubscription = readObject(session.subscription);
  const trialEnd = readNumber(expandedSubscription, "trial_end");
  if (trialEnd) return timestampToIso(trialEnd)!;

  const explicit = readMetadataValue(metadata, "trialEndsAt", "trial_ends_at");
  if (explicit) return new Date(explicit).toISOString();

  const trialDays = Number(
    readMetadataValue(metadata, "trialDays", "trial_days") ??
      DEFAULT_TRIAL_DAYS,
  );
  return new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
}

async function readUserEmail(
  supabase: SupabaseAdminClient,
  userId: string,
): Promise<string | undefined> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) throw error;
  return data.user?.email ?? undefined;
}

function readMetadata(value: unknown): Metadata {
  const object = readObject(value);
  const metadata = object?.metadata;
  if (!metadata || typeof metadata !== "object") return {};

  return Object.fromEntries(
    Object.entries(metadata).filter((entry): entry is [string, string] => {
      return typeof entry[1] === "string";
    }),
  );
}

function readMetadataValue(metadata: Metadata, ...keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (value) return value;
  }
  return undefined;
}

function requireMetadata(metadata: Metadata, ...keys: string[]) {
  const value = readMetadataValue(metadata, ...keys);
  if (!value) {
    throw new Error(`stripe_checkout_missing_metadata:${keys.join("|")}`);
  }
  return value;
}

function getExpandableId(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  const object = readObject(value);
  return typeof object?.id === "string" ? object.id : undefined;
}

function readCustomerEmail(
  session: Stripe.Checkout.Session,
  metadata: Metadata,
) {
  return (
    session.customer_details?.email ??
    session.customer_email ??
    readMetadataValue(metadata, "userEmail", "user_email", "email")
  );
}

function readInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  return getExpandableId(readObject(invoice)?.subscription);
}

function readInvoiceCustomerEmail(invoice: Stripe.Invoice) {
  const object = readObject(invoice);
  return typeof object?.customer_email === "string"
    ? object.customer_email
    : undefined;
}

function readInvoiceBillingCountry(invoice: Stripe.Invoice) {
  const object = readObject(invoice);
  const customerAddress = readObject(object?.customer_address);
  return typeof customerAddress?.country === "string"
    ? customerAddress.country
    : undefined;
}

function readCardBrand(session: Stripe.Checkout.Session) {
  return readString(session, "payment_method_details.card.brand");
}

function readCardLast4(session: Stripe.Checkout.Session) {
  return readString(session, "payment_method_details.card.last4");
}

function readString(value: unknown, path: string) {
  const result = readPath(value, path);
  return typeof result === "string" ? result : undefined;
}

function readNumber(value: unknown, path: string) {
  const result = readPath(value, path);
  return typeof result === "number" ? result : undefined;
}

function readPath(value: unknown, path: string) {
  return path.split(".").reduce<unknown>((acc, key) => {
    const object = readObject(acc);
    return object ? object[key] : undefined;
  }, value);
}

function readObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function timestampToIso(timestamp: number | undefined) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : undefined;
}

function centsToUsd(amount: number) {
  return Number((amount / 100).toFixed(2));
}

async function assertOk<T extends { error?: unknown }>(
  result: PromiseLike<T> | T,
) {
  const resolved = await result;
  if (resolved.error) throw resolved.error;
}

function isDuplicateError(error: unknown) {
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === DUPLICATE_ERROR_CODE ||
    candidate.message?.includes("duplicate key") === true
  );
}

function enqueueAmegoIssuePlaceholder(stripeInvoiceId: string) {
  // Issue #73 will enqueue the real Amego invoice job from here.
  console.info("[stripe-webhook] Amego invoice pending", { stripeInvoiceId });
}
