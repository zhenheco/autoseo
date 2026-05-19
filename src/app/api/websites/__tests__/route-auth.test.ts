import { beforeEach, describe, expect, it, vi } from "vitest";

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn((_mode, handler) => handler),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);

vi.mock("@/lib/api/auth-middleware", () => ({
  extractPathParams: vi.fn(() => ({ id: "website-1" })),
  withCompany: vi.fn((_handler) => undefined),
  withAdmin: vi.fn((_handler) => undefined),
}));

describe("website route auth classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    ["website list", "../route", "company"],
    ["website settings", "../[id]/settings/route", "company"],
    ["website agent config", "../[id]/agent-config/route", "company"],
    ["external websites", "../external/route", "admin"],
    ["external website detail", "../external/[id]/route", "admin"],
  ])("marks %s as %s", async (_name, routePath, mode) => {
    await import(routePath);

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      mode,
      expect.any(Function),
    );
  });
});
