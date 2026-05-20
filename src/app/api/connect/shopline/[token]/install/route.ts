import { NextResponse, type NextRequest } from "next/server";
import { normalizeShoplineShopHandle } from "@/lib/shopline/oauth";

type RouteContext = {
  params: Promise<{ token: string }> | { token: string };
};

export async function GET(
  req: NextRequest,
  _context: RouteContext,
): Promise<NextResponse> {
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

  return NextResponse.json({ error: "not_implemented" }, { status: 501 });
}
