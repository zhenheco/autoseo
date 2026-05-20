import { beforeEach, describe, expect, it, vi } from "vitest";

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn(
    (_mode, handler) => (request: Request) =>
      handler(request, {
        authMode: "company",
        companyId: "company-1",
        user: { id: "user-1" },
        supabase: {},
      }),
  ),
}));

const supabaseAdmin = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@shared/supabase", () => supabaseAdmin);

function createFakeAdminClient(response: { data?: unknown; error?: unknown }) {
  const calls: Array<{
    table: string;
    method: string;
    args: unknown[];
  }> = [];

  const client = {
    calls,
    from(table: string) {
      const builder = {
        select(...args: unknown[]) {
          calls.push({ table, method: "select", args });
          return builder;
        },
        eq(...args: unknown[]) {
          calls.push({ table, method: "eq", args });
          return builder;
        },
        order(...args: unknown[]) {
          calls.push({ table, method: "order", args });
          return Promise.resolve(response);
        },
      };

      return builder;
    },
  };

  return client;
}

describe("sync targets route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("declares company auth and scopes external sync targets to the company", async () => {
    const adminClient = createFakeAdminClient({
      data: [{ id: "target-1", website_name: "External" }],
      error: null,
    });
    supabaseAdmin.createAdminClient.mockReturnValue(adminClient);

    const { GET } = await import("../route");

    const response = await GET({} as never);

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "company",
      expect.any(Function),
    );
    expect(adminClient.calls).toContainEqual({
      table: "website_configs",
      method: "eq",
      args: ["company_id", "company-1"],
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: [{ id: "target-1", website_name: "External" }],
    });
  });
});
