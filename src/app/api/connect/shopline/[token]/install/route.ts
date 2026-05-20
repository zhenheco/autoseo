import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSupabaseShoplineInvitationStore,
  findActiveInvitation,
} from "@/lib/shopline/invitations";
import { normalizeShoplineShopHandle } from "@/lib/shopline/oauth";

type RouteContext = {
  params: Promise<{ token: string }> | { token: string };
};

export async function GET(
  req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { token } = await context.params;
  const url = new URL(req.url);
  const shopHandleParam = url.searchParams.get("shopHandle");

  if (!shopHandleParam) {
    return NextResponse.json({ error: "missing_shop_handle" }, { status: 400 });
  }

  try {
    normalizeShoplineShopHandle(shopHandleParam);
  } catch {
    return NextResponse.json({ error: "invalid_shop_handle" }, { status: 400 });
  }

  const invitationStore =
    createSupabaseShoplineInvitationStore(createAdminClient());
  try {
    await findActiveInvitation(invitationStore, token);
  } catch (error) {
    const reason =
      error instanceof Error &&
      error.message === "shopline_invitation_not_found"
        ? "invalid"
        : "invalid";
    return NextResponse.redirect(
      new URL(`/connect/shopline/${token}?error=${reason}`, req.url),
      { status: 302 },
    );
  }

  return NextResponse.json({ error: "not_implemented" }, { status: 501 });
}
