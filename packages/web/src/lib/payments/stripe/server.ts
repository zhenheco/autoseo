import { createStripeClient, type StripeClient } from "./client";

let cachedClient: StripeClient | null = null;

export function getStripeClient(): StripeClient {
  cachedClient ??= createStripeClient({
    apiKey: getStripeApiKey(),
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  });

  return cachedClient;
}

function getStripeApiKey(): string {
  const apiKey = process.env.STRIPE_API_KEY ?? process.env.STRIPE_API_KEY_TEST;
  if (!apiKey) {
    throw new Error("Missing STRIPE_API_KEY or STRIPE_API_KEY_TEST.");
  }

  return apiKey;
}
