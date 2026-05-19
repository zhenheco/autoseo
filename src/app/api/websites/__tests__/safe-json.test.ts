import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  supabaseFrom: vi.fn(),
  adminFrom: vi.fn(),
}));

vi.mock("@/lib/api/auth-middleware", () => ({
  extractPathParams: vi.fn(() => ({ id: "website-1" })),
  withCompany: vi.fn(
    (handler) =>
      (request: Request, ...args: unknown[]) =>
        handler(
          request,
          {
            user: { id: "user-1", email: "user@example.com" },
            companyId: "company-1",
            supabase: { from: db.supabaseFrom },
          },
          ...args,
        ),
  ),
  withAdmin: vi.fn(
    (handler) =>
      (request: Request, ...args: unknown[]) =>
        handler(
          request,
          {
            user: { id: "admin-1", email: "admin@example.com" },
            adminClient: { from: db.adminFrom },
          },
          ...args,
        ),
  ),
}));

describe("websites JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    [
      "agent config update",
      "../[id]/agent-config/route",
      "PUT",
      "https://example.com/api/websites/website-1/agent-config",
      { params: Promise.resolve({ id: "website-1" }) },
      db.supabaseFrom,
    ],
    [
      "external website create",
      "../external/route",
      "POST",
      "https://example.com/api/websites/external",
      undefined,
      db.adminFrom,
    ],
    [
      "external website update",
      "../external/[id]/route",
      "PATCH",
      "https://example.com/api/websites/external/website-1",
      { params: Promise.resolve({ id: "website-1" }) },
      db.adminFrom,
    ],
  ])(
    "returns 400 for malformed %s body",
    async (_name, routePath, method, url, contextArg, fromSpy) => {
      const route = await import(routePath);

      const response = await route[method](
        new Request(url, {
          method,
          body: "{",
        }) as never,
        contextArg as never,
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Request body must be valid JSON",
        code: "INVALID_JSON",
      });
      expect(fromSpy).not.toHaveBeenCalled();
    },
  );
});
