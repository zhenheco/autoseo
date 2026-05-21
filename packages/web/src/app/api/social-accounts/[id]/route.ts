import { NextRequest } from "next/server";
import { z } from "zod";
import {
  internalError,
  notFound,
  successResponse,
  validationError,
} from "@/lib/api/response-helpers";
import { withRouteAuth } from "@/lib/api/route-auth";
import { revokeSocialAccountToken } from "@/lib/social/revoke";
import type { SocialAccount } from "@/lib/social/types";

type RouteParams = { params: Promise<{ id: string }> };

const accountIdSchema = z.string().uuid();

async function readAccountId(route: RouteParams): Promise<string | null> {
  const { id } = await route.params;
  const parsed = accountIdSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

type SocialAccountSelection = SocialAccount & {
  brands?:
    | { company_id?: string | null }
    | Array<{ company_id?: string | null }>;
};

export const DELETE = withRouteAuth(
  "company",
  async (
    _request: NextRequest,
    { supabase, companyId },
    route: RouteParams,
  ) => {
    const id = await readAccountId(route);
    if (!id) {
      return validationError("Invalid social account id format");
    }

    const { data: account, error: readError } = await supabase
      .from("social_accounts")
      .select(
        "id, brand_id, platform, platform_account_id, platform_username, access_token_encrypted, refresh_token_encrypted, token_expires_at, connected_at, disconnected_at, brands!inner(company_id)",
      )
      .eq("id", id)
      .eq("brands.company_id", companyId)
      .maybeSingle();

    if (readError) {
      console.error("[SocialAccounts] Delete lookup failed:", readError);
      return internalError("Failed to read social account");
    }

    if (!account) {
      return notFound("Social account");
    }

    const socialAccount = account as SocialAccountSelection;
    const disconnectedAt =
      socialAccount.disconnected_at ?? new Date().toISOString();

    if (!socialAccount.disconnected_at) {
      const { error: updateError } = await supabase
        .from("social_accounts")
        .update({ disconnected_at: disconnectedAt })
        .eq("id", id)
        .eq("brand_id", socialAccount.brand_id ?? "")
        .is("disconnected_at", null);

      if (updateError) {
        console.error("[SocialAccounts] Soft delete failed:", updateError);
        return internalError("Failed to disconnect social account");
      }
    }

    const revokeResult = await revokeSocialAccountToken(socialAccount);
    if (revokeResult.error) {
      console.warn("[SocialAccounts] Token revoke best-effort failed", {
        accountId: id,
        platform: socialAccount.platform,
        error: revokeResult.error,
      });
    }

    return successResponse({
      id,
      disconnectedAt,
      revokeAttempted: revokeResult.attempted,
    });
  },
);
