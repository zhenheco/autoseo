import { beforeEach, describe, expect, it, vi } from "vitest";

const accountId = "33333333-3333-4333-8333-333333333333";
const brandId = "22222222-2222-4222-8222-222222222222";
const companyId = "11111111-1111-4111-8111-111111111111";

const revokeMocks = vi.hoisted(() => ({
  revokeSocialAccountToken: vi.fn(async () => ({ attempted: true })),
}));

vi.mock("@/lib/social/revoke", () => revokeMocks);

const state = vi.hoisted(() => ({
  supabase: null as FakeSupabaseClient | null,
}));

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn(
    (
      _mode: string,
      handler: (
        request: Request,
        context: {
          authMode: "company";
          companyId: string;
          user: { id: string };
          supabase: FakeSupabaseClient;
        },
        route: { params: Promise<{ id: string }> },
      ) => Promise<Response> | Response,
    ) =>
      (request: Request, route: { params: Promise<{ id: string }> }) =>
        handler(
          request,
          {
            authMode: "company",
            companyId,
            user: { id: "user-1" },
            supabase: state.supabase!,
          },
          route,
        ),
  ),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);

class FakeSupabaseClient {
  readonly account = {
    id: accountId,
    brand_id: brandId,
    platform: "x",
    platform_account_id: "x-user-id",
    platform_username: "northwind",
    access_token_encrypted: "encrypted-access",
    refresh_token_encrypted: "encrypted-refresh",
    token_expires_at: "2026-06-01T00:00:00.000Z",
    connected_at: "2026-05-01T00:00:00.000Z",
    disconnected_at: null as string | null,
    brands: { company_id: companyId },
  };
  readonly updates: Array<Record<string, unknown>> = [];

  from(table: string) {
    if (table !== "social_accounts")
      throw new Error(`unexpected table ${table}`);
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: this.account, error: null }),
          }),
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        this.updates.push(payload);
        this.account.disconnected_at = payload.disconnected_at as string;
        return {
          eq: () => ({
            eq: () => ({
              is: async () => ({ error: null }),
            }),
          }),
        };
      },
    };
  }
}

describe("DELETE /api/social-accounts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    state.supabase = new FakeSupabaseClient();
  });

  it("soft-deletes the social account and attempts token revocation", async () => {
    const { DELETE } = await import("../route");

    const response = await DELETE(
      new Request(`https://1wayseo.com/api/social-accounts/${accountId}`, {
        method: "DELETE",
      }) as never,
      { params: Promise.resolve({ id: accountId }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(state.supabase?.updates[0]).toEqual({
      disconnected_at: expect.any(String),
    });
    expect(revokeMocks.revokeSocialAccountToken).toHaveBeenCalledWith(
      expect.objectContaining({
        id: accountId,
        platform: "x",
        access_token_encrypted: "encrypted-access",
      }),
    );
    expect(body.data).toEqual({
      id: accountId,
      disconnectedAt: expect.any(String),
      revokeAttempted: true,
    });
  });
});
