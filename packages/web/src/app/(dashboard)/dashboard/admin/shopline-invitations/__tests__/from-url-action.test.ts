import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserPrimaryCompany: vi.fn(),
}));

const supabaseAdmin = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

const nextCache = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

const shoplineParser = vi.hoisted(() => ({
  parseShoplineShopHandleFromUrl: vi.fn(),
}));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/supabase/admin", () => supabaseAdmin);
vi.mock("next/cache", () => nextCache);
vi.mock("@/lib/shopline/parse-shop-handle", () => shoplineParser);

type MembershipRow = {
  company_id: string;
  role: string;
  status: string;
  user_id: string;
};

type InvitationRow = {
  token: string;
  company_id: string;
  expected_shop_handle: string | null;
  note: string | null;
  expires_at: string;
  last_redeemed_at: string | null;
  redeem_count: number;
  revoked_at: string | null;
  created_at: string;
  created_by: string | null;
  updated_at?: string;
};

type TableName = "company_members" | "shopline_install_invitations";

type DatabaseState = {
  memberships: MembershipRow[];
  invitations: InvitationRow[];
};

type QueryResult = { data: unknown; error: null };

class FakeQuery implements PromiseLike<QueryResult> {
  private filters: Array<{ column: string; value: unknown }> = [];
  private insertedRow: Record<string, unknown> | null = null;

  constructor(
    private readonly state: DatabaseState,
    private readonly table: TableName,
  ) {}

  select() {
    return this;
  }

  insert(row: Record<string, unknown>) {
    this.insertedRow = row;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  async single(): Promise<QueryResult> {
    if (this.insertedRow) {
      return { data: this.insertInvitation(), error: null };
    }

    const rows = this.rows();
    return { data: rows[0] ?? null, error: null };
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.rows(), error: null }).then(
      onfulfilled,
      onrejected,
    );
  }

  private rows(): Record<string, unknown>[] {
    let rows = this.tableRows();

    for (const filter of this.filters) {
      rows = rows.filter((row) => row[filter.column] === filter.value);
    }

    return rows;
  }

  private tableRows(): Record<string, unknown>[] {
    if (this.table === "company_members") return this.state.memberships;
    return this.state.invitations;
  }

  private insertInvitation(): InvitationRow {
    const row: InvitationRow = {
      token: `token-${this.state.invitations.length + 1}`,
      company_id: String(this.insertedRow?.company_id),
      expected_shop_handle:
        (this.insertedRow?.expected_shop_handle as string | null) ?? null,
      note: (this.insertedRow?.note as string | null) ?? null,
      expires_at: String(this.insertedRow?.expires_at),
      last_redeemed_at: null,
      redeem_count: 0,
      revoked_at: null,
      created_at: new Date().toISOString(),
      created_by: (this.insertedRow?.created_by as string | null) ?? null,
    };
    this.state.invitations.unshift(row);
    return row;
  }
}

function createFakeAdminClient(state: DatabaseState) {
  return {
    from(table: TableName) {
      return new FakeQuery(state, table);
    },
  };
}

function formData(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

async function loadActions() {
  return import("../actions");
}

describe("createInvitationFromUrlAction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T00:00:00.000Z"));
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("returns unauthorized when user is not logged in", async () => {
    auth.getUser.mockResolvedValue(null);

    const { createInvitationFromUrlAction } = await loadActions();

    await expect(
      createInvitationFromUrlAction(
        formData({ storeUrl: "https://shop.test" }),
      ),
    ).resolves.toEqual({ ok: false, error: "unauthorized" });
  });

  it("returns unauthorized when user is not owner/admin of the primary company", async () => {
    auth.getUser.mockResolvedValue({ id: "user-1" });
    auth.getUserPrimaryCompany.mockResolvedValue({ id: "company-1" });
    supabaseAdmin.createAdminClient.mockReturnValue(
      createFakeAdminClient({
        memberships: [
          {
            company_id: "company-1",
            role: "member",
            status: "active",
            user_id: "user-1",
          },
        ],
        invitations: [],
      }),
    );

    const { createInvitationFromUrlAction } = await loadActions();

    await expect(
      createInvitationFromUrlAction(
        formData({ storeUrl: "https://shop.test" }),
      ),
    ).resolves.toEqual({ ok: false, error: "unauthorized" });
    expect(
      shoplineParser.parseShoplineShopHandleFromUrl,
    ).not.toHaveBeenCalled();
  });

  it("creates an invitation for an owner with a parsed handle", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";
    auth.getUser.mockResolvedValue({ id: "user-1" });
    auth.getUserPrimaryCompany.mockResolvedValue({ id: "company-1" });
    shoplineParser.parseShoplineShopHandleFromUrl.mockResolvedValue(
      "renoir199063",
    );
    const state: DatabaseState = {
      memberships: [
        {
          company_id: "company-1",
          role: "owner",
          status: "active",
          user_id: "user-1",
        },
      ],
      invitations: [],
    };
    supabaseAdmin.createAdminClient.mockReturnValue(
      createFakeAdminClient(state),
    );

    const { createInvitationFromUrlAction } = await loadActions();

    await expect(
      createInvitationFromUrlAction(
        formData({
          storeUrl: "https://newweb.renoirpuzzle.com.tw/",
          note: "Renoir",
        }),
      ),
    ).resolves.toEqual({
      ok: true,
      token: "token-1",
      link: "https://app.example.com/connect/shopline/token-1",
      expiresAt: "2026-05-27T00:00:00.000Z",
      parsedHandle: "renoir199063",
    });
    expect(state.invitations[0]).toMatchObject({
      company_id: "company-1",
      expected_shop_handle: "renoir199063",
      note: "Renoir",
      created_by: "user-1",
    });
  });

  it("returns parse_failed with the submitted URL when parsing fails", async () => {
    auth.getUser.mockResolvedValue({ id: "user-1" });
    auth.getUserPrimaryCompany.mockResolvedValue({ id: "company-1" });
    shoplineParser.parseShoplineShopHandleFromUrl.mockRejectedValue(
      new Error("shopline_shop_handle_parse_failed"),
    );
    supabaseAdmin.createAdminClient.mockReturnValue(
      createFakeAdminClient({
        memberships: [
          {
            company_id: "company-1",
            role: "admin",
            status: "active",
            user_id: "user-1",
          },
        ],
        invitations: [],
      }),
    );

    const { createInvitationFromUrlAction } = await loadActions();

    await expect(
      createInvitationFromUrlAction(
        formData({ storeUrl: "https://not-shop.example.com/" }),
      ),
    ).resolves.toEqual({
      ok: false,
      error: "parse_failed",
      detail: "shopline_shop_handle_parse_failed",
      suggestUrl: "https://not-shop.example.com/",
    });
  });
});
