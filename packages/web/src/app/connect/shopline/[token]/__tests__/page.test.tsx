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

vi.mock("@shared/supabase", () => ({
  createAdminClient: vi.fn(() => supabaseMock),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => {
    const messages: Record<string, string> = {
      title: "綁定您的 SHOPLINE 商店",
      subtitle: "授權後 1waySEO 將可代您管理商品 SEO",
      shopHandleLabel: "SHOPLINE 商店網址",
      shopHandlePlaceholder: "brandname.myshopline.com",
      authorizeButton: "授權綁定",
      "errors.invalid": "此連結無效，請聯絡 1waySEO 取得新連結",
      "errors.expired": "此連結已過期，請聯絡 1waySEO 取得新連結",
      "errors.revoked": "此連結已撤銷",
    };

    return (key: string) => messages[key] ?? key;
  }),
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
      screen.getByRole("heading", {
        name: "此連結無效，請聯絡 1waySEO 取得新連結",
      }),
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
      screen.getByRole("heading", {
        name: "此連結已過期，請聯絡 1waySEO 取得新連結",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("此連結已過期，請聯絡 1waySEO 取得新連結"),
    ).toHaveLength(2);
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
      screen.getByRole("heading", { name: "此連結已撤銷" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the install form with expected shop handle when invitation is active", async () => {
    invitationQuery.maybeSingle.mockResolvedValueOnce({
      data: invitationRow({
        expected_shop_handle: "demo-shop",
      }),
      error: null,
    });

    const { container } = render(
      await ShoplineInvitationPage(props("active-token")),
    );

    expect(
      screen.getByRole("heading", { name: "綁定您的 SHOPLINE 商店" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "SHOPLINE 商店網址" }),
    ).toHaveValue("demo-shop");
    expect(
      screen.getByRole("button", { name: "授權綁定" }),
    ).toBeInTheDocument();
    expect(container.querySelector("form")).toHaveAttribute(
      "action",
      "/api/connect/shopline/active-token/install",
    );
    expect(container.querySelector("form")).toHaveAttribute("method", "GET");
  });
});
