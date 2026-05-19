import { beforeEach, describe, expect, it, vi } from "vitest";

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn((_mode, handler) => handler),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);

vi.mock("@/lib/analytics/google-api-client", () => ({
  callGoogleApi: vi.fn(),
  getWebsiteOAuthToken: vi.fn(),
  getDefaultDateRange: vi.fn(() => ({
    startDate: "2026-04-01",
    endDate: "2026-04-30",
  })),
  updateLastSyncTime: vi.fn(),
}));

describe("GSC analytics route auth classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    ["performance", "../performance/route"],
    ["queries", "../queries/route"],
    ["sites", "../sites/route"],
  ])("marks %s as authenticated", async (_name, routePath) => {
    await import(routePath);

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "authenticated",
      expect.any(Function),
    );
  });
});
