import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/api/route-auth", () => ({
  withRouteAuth:
    (
      _mode: string,
      handler: (request: NextRequest, context: unknown) => unknown,
    ) =>
    (request: NextRequest) =>
      handler(request, { supabase: supabaseMock, companyId: "company-1" }),
}));

function request(url: string, cookies: Record<string, string> = {}) {
  return {
    url,
    nextUrl: new URL(url),
    cookies: {
      get: (name: string) =>
        Object.prototype.hasOwnProperty.call(cookies, name)
          ? { value: cookies[name] }
          : undefined,
    },
  } as unknown as NextRequest;
}

function brandQueryMock(brandId = "brand-1") {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data: { id: brandId }, error: null })),
  };
  supabaseMock.from.mockReturnValue(builder);
  return builder;
}

describe("Meta OAuth connect route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("META_APP_ID", "meta-app-id");
    vi.stubEnv(
      "META_REDIRECT_URI",
      "https://1wayseo.com/api/social/meta/callback",
    );
  });

  it("redirects to pending review when the public feature flag is off", async () => {
    vi.stubEnv("META_OAUTH_PUBLIC_ENABLED", "false");
    const { GET } = await import("../route");

    const response = await GET(
      request("https://1wayseo.com/api/social/meta/connect"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://1wayseo.com/dashboard/social?meta_pending_review=1",
    );
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("generates state, stores it in an httpOnly cookie, and redirects to Meta", async () => {
    vi.stubEnv("META_OAUTH_PUBLIC_ENABLED", "true");
    brandQueryMock();
    const { GET } = await import("../route");

    const response = await GET(
      request("https://1wayseo.com/api/social/meta/connect?brand_id=brand-1"),
    );
    const location = new URL(response.headers.get("location") ?? "");
    const stateCookie = response.cookies.get("meta_oauth_state");
    const brandCookie = response.cookies.get("meta_oauth_brand_id");

    expect(response.status).toBe(302);
    expect(`${location.origin}${location.pathname}`).toBe(
      "https://www.facebook.com/v19.0/dialog/oauth",
    );
    expect(location.searchParams.get("client_id")).toBe("meta-app-id");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://1wayseo.com/api/social/meta/callback",
    );
    expect(location.searchParams.get("state")).toBe(stateCookie?.value);
    expect(location.searchParams.get("scope")).toContain(
      "instagram_content_publish",
    );
    expect(stateCookie?.httpOnly).toBe(true);
    expect(stateCookie?.maxAge).toBe(600);
    expect(brandCookie?.value).toBe("brand-1");
  });
});
