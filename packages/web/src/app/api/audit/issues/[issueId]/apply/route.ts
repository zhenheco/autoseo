import { NextResponse } from "next/server";
import { withCompany } from "@/lib/api/auth-middleware";

type RouteContext = {
  params: Promise<{ issueId: string }>;
};

export const POST = withCompany(
  async (_request, _context, route: RouteContext) => {
    const { issueId } = await route.params;

    return NextResponse.json(
      { ok: false, error: `not_implemented:${issueId}` },
      { status: 501 },
    );
  },
);
