import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  exchangeCodeForTokenMock,
  invitationStoreMock,
  persistShoplineConnectionMock,
  redeemInvitationMock,
  verifyShoplineHmacMock,
  verifyStateMock,
} = vi.hoisted(() => ({
  exchangeCodeForTokenMock: vi.fn(),
  invitationStoreMock: { invitationStore: true },
  persistShoplineConnectionMock: vi.fn(),
  redeemInvitationMock: vi.fn(),
  verifyShoplineHmacMock: vi.fn(),
  verifyStateMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ admin: true })),
}));

vi.mock("@/lib/shopline/connections", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/shopline/connections")>();
  return {
    ...actual,
    createSupabaseShoplineConnectionStore: vi.fn(() => ({ store: true })),
    persistShoplineConnection: persistShoplineConnectionMock,
  };
});

vi.mock("@/lib/shopline/invitations", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/shopline/invitations")>();
  return {
    ...actual,
    createSupabaseShoplineInvitationStore: vi.fn(() => invitationStoreMock),
    redeemInvitation: redeemInvitationMock,
  };
});

vi.mock("@/lib/shopline/oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/shopline/oauth")>();
  return {
    ...actual,
    exchangeCodeForToken: exchangeCodeForTokenMock,
    verifyShoplineHmac: verifyShoplineHmacMock,
    verifyState: verifyStateMock,
  };
});

import { GET } from "../route";

function callbackRequest(): NextRequest {
  return {
    url: "https://1wayseo.com/api/oauth/shopline/callback?code=auth-code&customField=signed-state&handle=demo-shop",
    cookies: {
      get: (name: string) =>
        name === "shopline_oauth_nonce" ? { value: "nonce-1" } : undefined,
    },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.restoreAllMocks();
  verifyStateMock.mockReset();
  verifyStateMock.mockResolvedValue({
    workspaceId: "company-1",
    siteId: "website-1",
    shopHandle: "demo-shop",
    returnTo: "/connect/shopline/invite-token/done?shop=demo-shop",
    invitationToken: "invite-token",
  });
  verifyShoplineHmacMock.mockReset();
  verifyShoplineHmacMock.mockResolvedValue(true);
  exchangeCodeForTokenMock.mockReset();
  exchangeCodeForTokenMock.mockResolvedValue({
    access_token: "token-never-returned",
    scope: "read_products",
  });
  persistShoplineConnectionMock.mockReset();
  persistShoplineConnectionMock.mockResolvedValue({
    shopHandle: "demo-shop",
  });
  redeemInvitationMock.mockReset();
  redeemInvitationMock.mockResolvedValue({
    token: "invite-token",
  });
});

describe("SHOPLINE callback invitation redemption", () => {
  it("redeems an invitation token after persisting the SHOPLINE connection", async () => {
    const resp = await GET(callbackRequest());

    expect(resp.status).toBe(302);
    expect(persistShoplineConnectionMock).toHaveBeenCalledWith(
      { store: true },
      expect.objectContaining({
        companyId: "company-1",
        websiteId: "website-1",
        shopHandle: "demo-shop",
        accessToken: "token-never-returned",
      }),
    );
    expect(redeemInvitationMock).toHaveBeenCalledWith(
      invitationStoreMock,
      "invite-token",
    );
    expect(resp.headers.get("location")).toBe(
      "https://1wayseo.com/connect/shopline/invite-token/done?shop=demo-shop&shopline=connected&shopHandle=demo-shop",
    );
  });

  it("keeps the callback successful when invitation redemption fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    redeemInvitationMock.mockRejectedValueOnce(
      new Error("shopline_invitation_revoked"),
    );

    const resp = await GET(callbackRequest());

    expect(resp.status).toBe(302);
    expect(resp.headers.get("location")).toContain("shopline=connected");
    expect(warnSpy).toHaveBeenCalledWith(
      "shopline_invitation_redeem_failed",
      expect.objectContaining({
        invitationToken: "invite-token",
        error: "shopline_invitation_revoked",
      }),
    );
  });
});
