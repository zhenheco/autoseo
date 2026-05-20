import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invitationQuery, supabaseMock } = vi.hoisted(() => {
  const invitationQuery = {
    select: vi.fn(() => invitationQuery),
    eq: vi.fn(() => invitationQuery),
    maybeSingle: vi.fn(
      async (): Promise<{ data: unknown | null; error: null }> => ({
        data: null,
        error: null,
      }),
    ),
  };

  const supabaseMock = {
    from: vi.fn((table: string) => {
      if (table === "shopline_install_invitations") return invitationQuery;
      throw new Error(`unexpected table: ${table}`);
    }),
  };

  return { invitationQuery, supabaseMock };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => supabaseMock),
}));

import ShoplineInvitationPage from "../page";

function props(token = "invite-token") {
  return { params: Promise.resolve({ token }) };
}

function invitationRow(overrides: Record<string, unknown> = {}) {
  return {
    token: "invite-token",
    company_id: "company-1",
    expected_shop_handle: null,
    note: null,
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    last_redeemed_at: null,
    redeem_count: 0,
    revoked_at: null,
    created_at: "2026-05-20T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  invitationQuery.select.mockClear();
  invitationQuery.eq.mockClear();
  invitationQuery.maybeSingle.mockReset();
  invitationQuery.maybeSingle.mockResolvedValue({
    data: null,
    error: null,
  });
  supabaseMock.from.mockClear();
});

describe("public SHOPLINE invitation page", () => {
  it("shows an invalid-link message without a form when invitation is not found", async () => {
    render(await ShoplineInvitationPage(props("missing-token")));

    expect(
      screen.getByRole("heading", { name: "連結無效" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(invitationQuery.eq).toHaveBeenCalledWith("token", "missing-token");
  });

  it("shows an expired-link message without a form when invitation is expired", async () => {
    invitationQuery.maybeSingle.mockResolvedValueOnce({
      data: invitationRow({
        expires_at: new Date(Date.now() - 1_000).toISOString(),
      }),
      error: null,
    });

    render(await ShoplineInvitationPage(props("expired-token")));

    expect(
      screen.getByRole("heading", { name: "連結已過期" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("連結已過期，請聯絡 1waySEO 取得新連結"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a revoked-link message without a form when invitation is revoked", async () => {
    invitationQuery.maybeSingle.mockResolvedValueOnce({
      data: invitationRow({
        revoked_at: "2026-05-20T01:00:00.000Z",
      }),
      error: null,
    });

    render(await ShoplineInvitationPage(props("revoked-token")));

    expect(
      screen.getByRole("heading", { name: "連結已撤銷" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
