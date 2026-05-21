import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/supabase", () => ({
  updateSession: vi.fn(() => NextResponse.next()),
}));

import { middleware } from "./middleware";

function request(pathname: string) {
  return new NextRequest(`https://1wayseo.com${pathname}`);
}

function localHttpRequest(pathname: string) {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    headers: {
      "x-forwarded-proto": "http",
    },
  });
}

describe("middleware security headers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it("persists active dashboard brand query in a fallback cookie", async () => {
    const response = await middleware(
      request("/dashboard/articles?brand=brand-1"),
    );

    expect(response.cookies.get("active_brand_id")?.value).toBe("brand-1");
  });

  it("does not force HTTPS for localhost production smoke tests", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await middleware(localHttpRequest("/"));

    expect(response.status).not.toBe(301);
    expect(response.headers.get("location")).toBeNull();
  });
});
