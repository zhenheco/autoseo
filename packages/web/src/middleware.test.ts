import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@shared/supabase", () => ({
  updateSession: vi.fn(() => NextResponse.next()),
}));

import { middleware } from "./middleware";

function request(pathname: string) {
  return new NextRequest(`https://1wayseo.com${pathname}`);
}

describe("middleware security headers", () => {
  it("returns relaxed CSP for SHOPLINE admin embedding", async () => {
    const response = await middleware(request("/shopline/admin?shop=demo"));
    const csp = response.headers.get("Content-Security-Policy") ?? "";

    expect(response.headers.get("X-Frame-Options")).toBeNull();
    expect(csp).not.toContain("frame-ancestors 'self'");
    expect(csp).toContain(
      "frame-ancestors https://*.myshopline.com https://admin.shopline.com",
    );
  });

  it("preserves strict CSP for non-SHOPLINE admin paths", async () => {
    const response = await middleware(request("/dashboard"));
    const csp = response.headers.get("Content-Security-Policy") ?? "";

    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(csp).toContain("frame-ancestors 'self'");
  });
});
