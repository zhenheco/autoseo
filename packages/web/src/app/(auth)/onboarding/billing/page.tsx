import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@shared/supabase";
import { CreditCard, Loader2 } from "lucide-react";

import type { CheckoutInput } from "@/lib/payments/stripe/client";
import { getStripeClient } from "@/lib/payments/stripe/server";
import {
  getPriceId,
  isStripePlanId,
  type StripePlanId,
} from "@/lib/payments/stripe/price-ids";

const DEFAULT_PLAN_ID: StripePlanId = "solo_monthly";

type BillingPageProps = {
  searchParams: Promise<{ plan?: string }>;
};

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = await searchParams;
  const planId = normalizePlanId(params.plan);

  await startCheckout(planId);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
          <CreditCard className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold">正在前往安全結帳</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          我們正在建立您的 7 天試用結帳頁面。
        </p>
        <Loader2 className="mt-8 h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </main>
  );
}

async function createCheckoutSession(planId: string) {
  "use server";

  await startCheckout(normalizePlanId(planId));
}

async function startCheckout(planId: StripePlanId): Promise<never> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect(`/login?mode=signup&plan=${encodeURIComponent(planId)}`);
  }

  const { data: membership, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  const companyId =
    typeof membership?.company_id === "string" ? membership.company_id : null;

  if (membershipError || !companyId) {
    redirect(
      `/login?mode=signup&plan=${encodeURIComponent(planId)}&error=${encodeURIComponent("找不到公司資料，請重新登入")}`,
    );
  }

  const baseUrl = await getAppBaseUrl();
  const result = await getStripeClient().createCheckoutSession({
    priceId: getPriceId(planId),
    customerEmail: user.email,
    successUrl: `${baseUrl}/onboarding/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl}/pricing?cancelled=1`,
    locale: stripeLocaleFromUser(user.user_metadata),
    trialDays: 7,
    metadata: {
      user_id: user.id,
      company_id: companyId,
    },
  });

  redirect(result.url);
}

function normalizePlanId(plan?: string): StripePlanId {
  return plan && isStripePlanId(plan) ? plan : DEFAULT_PLAN_ID;
}

async function getAppBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "http";

  return host ? `${protocol}://${host}` : "https://1wayseo.com";
}

function stripeLocaleFromUser(
  metadata: Record<string, unknown> | null | undefined,
): CheckoutInput["locale"] {
  const locale =
    metadata?.locale ?? metadata?.ui_locale ?? metadata?.language ?? "auto";

  if (
    locale === "auto" ||
    locale === "en" ||
    locale === "zh-TW" ||
    locale === "ja" ||
    locale === "ko" ||
    locale === "de" ||
    locale === "es" ||
    locale === "fr"
  ) {
    return locale;
  }

  return "auto";
}
