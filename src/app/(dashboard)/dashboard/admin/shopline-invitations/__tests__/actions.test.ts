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

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/supabase/admin", () => supabaseAdmin);
vi.mock("next/cache", () => nextCache);

type MembershipRow = {
  company_id: string;
  role: string;
  status: string;
  user_id: string;
};

type CompanyRow = {
  id: string;
  name: string;
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

type TableName =
  | "company_members"
  | "companies"
  | "shopline_install_invitations";

type DatabaseState = {
  memberships: MembershipRow[];
  companies: CompanyRow[];
  invitations: InvitationRow[];
};

type QueryResult = { data: unknown; error: null };

class FakeQuery implements PromiseLike<QueryResult> {
  private filters: Array<{ column: string; value: unknown }> = [];
  private inFilters: Array<{ column: string; values: unknown[] }> = [];
  private insertedRow: Record<string, unknown> | null = null;
  private updatedRow: Record<string, unknown> | null = null;
  private orderColumn: string | null = null;
  private ascending = true;

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

  update(row: Record<string, unknown>) {
    this.updatedRow = row;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.inFilters.push({ column, values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderColumn = column;
    this.ascending = options?.ascending ?? true;
    return this;
  }

  async single(): Promise<QueryResult> {
    if (this.insertedRow) {
      return { data: this.insertInvitation(), error: null };
    }

    if (this.updatedRow) {
      return { data: this.updateInvitation(), error: null };
    }

    const rows = this.rows();
    return { data: rows[0] ?? null, error: null };
  }

  async maybeSingle(): Promise<QueryResult> {
    const rows = this.rows();
    return { data: rows[0] ?? null, error: null };
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.resolve().then(onfulfilled, onrejected);
  }

  private async resolve(): Promise<QueryResult> {
    return { data: this.rows(), error: null };
  }

  private rows(): Record<string, unknown>[] {
    let rows = this.tableRows();

    for (const filter of this.filters) {
      rows = rows.filter((row) => row[filter.column] === filter.value);
    }

    for (const filter of this.inFilters) {
      rows = rows.filter((row) => filter.values.includes(row[filter.column]));
    }

    if (this.orderColumn) {
      rows = [...rows].sort((a, b) => {
        const left = String(a[this.orderColumn!] ?? "");
        const right = String(b[this.orderColumn!] ?? "");
        return this.ascending
          ? left.localeCompare(right)
          : right.localeCompare(left);
      });
    }

    return rows;
  }

  private tableRows(): Record<string, unknown>[] {
    if (this.table === "company_members") return this.state.memberships;
    if (this.table === "companies") return this.state.companies;
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

  private updateInvitation(): InvitationRow {
    const tokenFilter = this.filters.find(
      (filter) => filter.column === "token",
    );
    const row = this.state.invitations.find(
      (invitation) => invitation.token === tokenFilter?.value,
    );

    if (!row) throw new Error("missing invitation");

    Object.assign(row, this.updatedRow);
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

describe("SHOPLINE invitation admin actions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T00:00:00.000Z"));
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("returns unauthorized when createInvitationAction has no user", async () => {
    auth.getUser.mockResolvedValue(null);

    const { createInvitationAction } = await loadActions();

    await expect(
      createInvitationAction(formData({ companyId: "company-1" })),
    ).resolves.toEqual({
      ok: false,
      error: "unauthorized",
    });
    expect(supabaseAdmin.createAdminClient).not.toHaveBeenCalled();
  });

  it("returns unauthorized when createInvitationAction user is not owner/admin", async () => {
    auth.getUser.mockResolvedValue({ id: "user-1" });
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
        companies: [{ id: "company-1", name: "Demo Co" }],
        invitations: [],
      }),
    );

    const { createInvitationAction } = await loadActions();

    await expect(
      createInvitationAction(formData({ companyId: "company-1" })),
    ).resolves.toEqual({
      ok: false,
      error: "unauthorized",
    });
  });

  it("creates an invitation for an owner with a 7 day link", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";
    auth.getUser.mockResolvedValue({ id: "user-1" });
    const state: DatabaseState = {
      memberships: [
        {
          company_id: "company-1",
          role: "owner",
          status: "active",
          user_id: "user-1",
        },
      ],
      companies: [{ id: "company-1", name: "Demo Co" }],
      invitations: [],
    };
    supabaseAdmin.createAdminClient.mockReturnValue(
      createFakeAdminClient(state),
    );

    const { createInvitationAction } = await loadActions();
    const result = await createInvitationAction(
      formData({
        companyId: "company-1",
        expectedShopHandle: "Demo-Shop",
        note: "new merchant",
      }),
    );

    expect(result).toEqual({
      ok: true,
      token: "token-1",
      link: "https://app.example.com/connect/shopline/token-1",
      expiresAt: "2026-05-27T00:00:00.000Z",
    });
    expect(state.invitations[0]).toMatchObject({
      company_id: "company-1",
      expected_shop_handle: "Demo-Shop",
      note: "new merchant",
      created_by: "user-1",
    });
    expect(nextCache.revalidatePath).toHaveBeenCalledWith(
      "/dashboard/admin/shopline-invitations",
    );
  });

  it("marks an invitation as revoked", async () => {
    auth.getUser.mockResolvedValue({ id: "user-1" });
    const state: DatabaseState = {
      memberships: [
        {
          company_id: "company-1",
          role: "admin",
          status: "active",
          user_id: "user-1",
        },
      ],
      companies: [{ id: "company-1", name: "Demo Co" }],
      invitations: [
        {
          token: "token-1",
          company_id: "company-1",
          expected_shop_handle: null,
          note: null,
          expires_at: "2026-05-27T00:00:00.000Z",
          last_redeemed_at: null,
          redeem_count: 0,
          revoked_at: null,
          created_at: "2026-05-20T00:00:00.000Z",
          created_by: "user-2",
        },
      ],
    };
    supabaseAdmin.createAdminClient.mockReturnValue(
      createFakeAdminClient(state),
    );

    const { revokeInvitationAction } = await loadActions();

    await expect(
      revokeInvitationAction(formData({ token: "token-1" })),
    ).resolves.toEqual({ ok: true });
    expect(state.invitations[0].revoked_at).toBe("2026-05-20T00:00:00.000Z");
    expect(nextCache.revalidatePath).toHaveBeenCalledWith(
      "/dashboard/admin/shopline-invitations",
    );
  });

  it("lists invitations with company names", async () => {
    auth.getUser.mockResolvedValue({ id: "user-1" });
    supabaseAdmin.createAdminClient.mockReturnValue(
      createFakeAdminClient({
        memberships: [
          {
            company_id: "company-1",
            role: "owner",
            status: "active",
            user_id: "user-1",
          },
          {
            company_id: "company-2",
            role: "admin",
            status: "active",
            user_id: "user-1",
          },
          {
            company_id: "company-3",
            role: "member",
            status: "active",
            user_id: "user-1",
          },
        ],
        companies: [
          { id: "company-1", name: "Alpha Co" },
          { id: "company-2", name: "Beta Co" },
          { id: "company-3", name: "Member Co" },
        ],
        invitations: [
          {
            token: "token-1",
            company_id: "company-1",
            expected_shop_handle: "alpha",
            note: null,
            expires_at: "2026-05-27T00:00:00.000Z",
            last_redeemed_at: null,
            redeem_count: 0,
            revoked_at: null,
            created_at: "2026-05-20T00:00:00.000Z",
            created_by: "user-1",
          },
          {
            token: "token-2",
            company_id: "company-2",
            expected_shop_handle: null,
            note: null,
            expires_at: "2026-05-28T00:00:00.000Z",
            last_redeemed_at: null,
            redeem_count: 1,
            revoked_at: null,
            created_at: "2026-05-21T00:00:00.000Z",
            created_by: "user-1",
          },
          {
            token: "token-3",
            company_id: "company-3",
            expected_shop_handle: "member",
            note: null,
            expires_at: "2026-05-29T00:00:00.000Z",
            last_redeemed_at: null,
            redeem_count: 0,
            revoked_at: null,
            created_at: "2026-05-22T00:00:00.000Z",
            created_by: "user-1",
          },
        ],
      }),
    );

    const { listAllInvitationsAction } = await loadActions();

    await expect(listAllInvitationsAction()).resolves.toEqual({
      invitations: [
        expect.objectContaining({
          token: "token-2",
          companyId: "company-2",
          companyName: "Beta Co",
        }),
        expect.objectContaining({
          token: "token-1",
          companyId: "company-1",
          companyName: "Alpha Co",
        }),
      ],
    });
  });
});
