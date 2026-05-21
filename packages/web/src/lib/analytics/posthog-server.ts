import { PostHog } from "posthog-node";

import type { FunnelEvent } from "./events";

type AnalyticsProperties = Record<string, unknown>;

let client: PostHog | null | undefined;

function getPostHogServerClient(): PostHog | null {
  if (client !== undefined) return client;

  const apiKey =
    process.env.POSTHOG_PERSONAL_API_KEY ||
    process.env.NEXT_PUBLIC_POSTHOG_API_KEY;

  if (!apiKey) {
    client = null;
    return client;
  }

  client = new PostHog(apiKey, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
  });

  return client;
}

export function capture(
  distinctId: string,
  event: FunnelEvent,
  properties: AnalyticsProperties = {},
): void {
  const posthog = getPostHogServerClient();
  if (!posthog) return;

  posthog.capture({
    distinctId,
    event: event.name,
    properties: {
      ...event.properties,
      ...properties,
    },
  });
}

export function identify(
  distinctId: string,
  properties: AnalyticsProperties = {},
): void {
  const posthog = getPostHogServerClient();
  if (!posthog) return;

  posthog.identify({
    distinctId,
    properties,
  });
}

// TRACKING TODO (#72): call this from the Stripe checkout.session.completed
// webhook after the trial record and payment method details are available.
export function captureTrialCardAdded(properties: {
  userId: string;
  trialId: string;
  cardBrand: string;
}): void {
  capture(properties.userId, {
    name: "trial_card_added",
    properties,
  });
}

// TRACKING TODO (#72): call this from invoice.paid after trials.converted_at is
// persisted, with amountUsd converted from Stripe minor units.
export function captureTrialConverted(properties: {
  userId: string;
  trialId: string;
  planId: string;
  amountUsd: number;
}): void {
  capture(properties.userId, {
    name: "trial_converted",
    properties,
  });
}
