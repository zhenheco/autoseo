import { NextResponse, type NextRequest } from "next/server";

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

  return NextResponse.json({ error: "not_implemented" }, { status: 501 });
}
