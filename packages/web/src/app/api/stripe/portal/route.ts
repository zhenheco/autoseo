import { NextRequest, NextResponse } from "next/server";

import { withRouteAuth } from "@/lib/api/route-auth";
import { canUserManageCompanyBilling } from "@/lib/billing/customer-portal-access";
import { getStripeClient } from "@/lib/payments/stripe/server";

type StripeSubscriptionCustomer = {
  stripe_customer_id: string | null;
};

const SETTINGS_RETURN_URL = "/dashboard/settings";

export const POST = withRouteAuth(
  "company",
  async (_request: NextRequest, { user, companyId, supabase }) => {
    try {
      const canManageBilling = await canUserManageCompanyBilling(supabase, {
        companyId,
        userId: user.id,
      });

      if (!canManageBilling) {
        return NextResponse.json(
          { error: "Only the company owner can manage billing." },
          { status: 403 },
        );
      }

      const { data: subscription, error: subscriptionError } = await supabase
        .from("company_subscriptions")
        .select("stripe_customer_id")
        .eq("company_id", companyId)
        .not("stripe_customer_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle<StripeSubscriptionCustomer>();

      if (subscriptionError) {
        throw subscriptionError;
      }

      if (!subscription?.stripe_customer_id) {
        return NextResponse.json(
          { error: "No Stripe subscription customer found." },
          { status: 404 },
        );
      }

      const { url } = await getStripeClient().createCustomerPortalSession({
        stripeCustomerId: subscription.stripe_customer_id,
        returnUrl: SETTINGS_RETURN_URL,
      });

      return NextResponse.json({ url });
    } catch (error) {
      console.error("[stripe-portal] failed to create portal session", error);
      return NextResponse.json(
        { error: "Failed to create Stripe Customer Portal session." },
        { status: 500 },
      );
    }
  },
);
