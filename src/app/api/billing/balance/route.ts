import { NextResponse } from "next/server";
import { withRouteAuth } from "@/lib/api/route-auth";
import { TokenBillingService } from "@/lib/billing/token-billing-service";

export const GET = withRouteAuth(
  "authenticated",
  async (_request, { user, supabase }) => {
    const { data: companyMember } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!companyMember) {
      return NextResponse.json({ error: "No company found" }, { status: 404 });
    }

    try {
      const billingService = new TokenBillingService(supabase);
      const balanceWithReservations =
        await billingService.getAvailableBalanceWithReservations(
          companyMember.company_id,
        );

      return NextResponse.json(balanceWithReservations);
    } catch (error) {
      console.error("Error fetching balance:", error);
      return NextResponse.json(
        {
          availableBalance: 0,
          monthlyQuotaBalance: 0,
          purchasedBalance: 0,
          reservedTokens: 0,
          pendingJobs: 0,
        },
        { status: 200 },
      );
    }
  },
);
