import type { NextRequest } from "next/server";
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

import { GET } from "../route";

function request(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest;
}

function context(token = "invite-token") {
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

describe("public SHOPLINE invitation install route", () => {
  it("returns missing_shop_handle when shopHandle is absent", async () => {
    const resp = await GET(
      request("https://1wayseo.com/api/connect/shopline/invite-token/install"),
      context(),
    );

    expect(resp.status).toBe(400);
    await expect(resp.json()).resolves.toEqual({
      error: "missing_shop_handle",
    });
  });

  it("returns invalid_shop_handle when shopHandle cannot be normalized", async () => {
    const resp = await GET(
      request(
        "https://1wayseo.com/api/connect/shopline/invite-token/install?shopHandle=bad%20shop",
      ),
      context(),
    );

    expect(resp.status).toBe(400);
    await expect(resp.json()).resolves.toEqual({
      error: "invalid_shop_handle",
    });
  });

  it("redirects to the public page with invalid when the token does not exist", async () => {
    const resp = await GET(
      request(
        "https://1wayseo.com/api/connect/shopline/missing-token/install?shopHandle=demo-shop",
      ),
      context("missing-token"),
    );

    expect(resp.status).toBe(302);
    expect(resp.headers.get("location")).toBe(
      "https://1wayseo.com/connect/shopline/missing-token?error=invalid",
    );
    expect(supabaseMock.from).toHaveBeenCalledWith(
      "shopline_install_invitations",
    );
    expect(invitationQuery.eq).toHaveBeenCalledWith("token", "missing-token");
  });
});
