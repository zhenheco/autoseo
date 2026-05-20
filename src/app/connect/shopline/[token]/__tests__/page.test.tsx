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
});
