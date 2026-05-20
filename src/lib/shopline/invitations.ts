import { normalizeShoplineShopHandle } from "./oauth";

export type ShoplineInvitationStatus = "active" | "expired" | "revoked";

export interface ShoplineInvitation {
  token: string;
  companyId: string;
  expectedShopHandle: string | null;
  note: string | null;
  expiresAt: string;
  lastRedeemedAt: string | null;
  redeemCount: number;
  revokedAt: string | null;
  createdAt: string;
}

export interface ShoplineInvitationStore {
  insert(input: {
    companyId: string;
    expectedShopHandle: string | null;
    note: string | null;
    expiresAt: string;
    createdBy: string | null;
  }): Promise<ShoplineInvitation>;
  findByToken(token: string): Promise<ShoplineInvitation | null>;
  redeem(token: string): Promise<ShoplineInvitation>;
  revoke(token: string): Promise<ShoplineInvitation>;
  listByCompany(companyId: string): Promise<ShoplineInvitation[]>;
}

export interface CreateShoplineInvitationInput {
  companyId: string;
  expectedShopHandle?: string;
  note?: string;
  ttlDays?: number;
  createdBy?: string | null;
}

export type SupabaseClientLike = {
  from: (table: string) => unknown;
};

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type QueryLike = PromiseLike<QueryResult> & {
  insert: (row: unknown) => QueryLike;
  update: (row: unknown) => QueryLike;
  select: (columns?: string) => QueryLike;
  eq: (column: string, value: unknown) => QueryLike;
  order: (column: string, options?: unknown) => QueryLike;
  single: () => Promise<QueryResult>;
  maybeSingle: () => Promise<QueryResult>;
};

type ShoplineInvitationRow = {
  token: string;
  company_id: string;
  expected_shop_handle: string | null;
  note: string | null;
  expires_at: string;
  last_redeemed_at: string | null;
  redeem_count: number;
  revoked_at: string | null;
  created_at: string;
};

const INVITATION_SELECT =
  "token, company_id, expected_shop_handle, note, expires_at, last_redeemed_at, redeem_count, revoked_at, created_at";

function toInvitation(row: ShoplineInvitationRow): ShoplineInvitation {
  return {
    token: row.token,
    companyId: row.company_id,
    expectedShopHandle: row.expected_shop_handle,
    note: row.note,
    expiresAt: row.expires_at,
    lastRedeemedAt: row.last_redeemed_at,
    redeemCount: row.redeem_count,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

export function getInvitationStatus(
  inv: ShoplineInvitation,
): ShoplineInvitationStatus {
  if (inv.revokedAt) return "revoked";
  if (new Date(inv.expiresAt).getTime() < Date.now()) return "expired";
  return "active";
}

export async function createShoplineInvitation(
  store: ShoplineInvitationStore,
  input: CreateShoplineInvitationInput,
): Promise<ShoplineInvitation> {
  const ttlDays = input.ttlDays ?? 7;
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000).toISOString();
  const expectedShopHandle = input.expectedShopHandle
    ? normalizeShoplineShopHandle(input.expectedShopHandle)
    : null;

  return store.insert({
    companyId: input.companyId,
    expectedShopHandle,
    note: input.note ?? null,
    expiresAt,
    createdBy: input.createdBy ?? null,
  });
}

export async function findActiveInvitation(
  store: ShoplineInvitationStore,
  token: string,
): Promise<ShoplineInvitation> {
  const invitation = await store.findByToken(token);
  if (!invitation) throw new Error("shopline_invitation_not_found");
  if (invitation.revokedAt) throw new Error("shopline_invitation_revoked");
  if (new Date(invitation.expiresAt).getTime() < Date.now()) {
    throw new Error("shopline_invitation_expired");
  }
  return invitation;
}

export async function redeemInvitation(
  store: ShoplineInvitationStore,
  token: string,
): Promise<ShoplineInvitation> {
  await findActiveInvitation(store, token);
  return store.redeem(token);
}

export function createSupabaseShoplineInvitationStore(
  client: SupabaseClientLike,
): ShoplineInvitationStore {
  return {
    async insert(input): Promise<ShoplineInvitation> {
      const query = client.from("shopline_install_invitations") as QueryLike;
      const { data, error } = await query
        .insert({
          company_id: input.companyId,
          expected_shop_handle: input.expectedShopHandle,
          note: input.note,
          expires_at: input.expiresAt,
          created_by: input.createdBy,
        })
        .select(INVITATION_SELECT)
        .single();

      if (error) {
        throw new Error(`shopline_invitation_insert_failed: ${error.message}`);
      }

      return toInvitation(data as ShoplineInvitationRow);
    },

    async findByToken(token): Promise<ShoplineInvitation | null> {
      const query = client.from("shopline_install_invitations") as QueryLike;
      const { data, error } = await query
        .select(INVITATION_SELECT)
        .eq("token", token)
        .maybeSingle();

      if (error) {
        throw new Error(`shopline_invitation_lookup_failed: ${error.message}`);
      }

      return data ? toInvitation(data as ShoplineInvitationRow) : null;
    },

    async redeem(token): Promise<ShoplineInvitation> {
      const current = await this.findByToken(token);
      if (!current) throw new Error("shopline_invitation_not_found");

      const now = new Date().toISOString();
      const query = client.from("shopline_install_invitations") as QueryLike;
      const { data, error } = await query
        .update({
          redeem_count: current.redeemCount + 1,
          last_redeemed_at: now,
          updated_at: now,
        })
        .eq("token", token)
        .select(INVITATION_SELECT)
        .single();

      if (error) {
        throw new Error(`shopline_invitation_redeem_failed: ${error.message}`);
      }

      return toInvitation(data as ShoplineInvitationRow);
    },

    async revoke(token): Promise<ShoplineInvitation> {
      const now = new Date().toISOString();
      const query = client.from("shopline_install_invitations") as QueryLike;
      const { data, error } = await query
        .update({ revoked_at: now, updated_at: now })
        .eq("token", token)
        .select(INVITATION_SELECT)
        .single();

      if (error) {
        throw new Error(`shopline_invitation_revoke_failed: ${error.message}`);
      }

      return toInvitation(data as ShoplineInvitationRow);
    },

    async listByCompany(companyId): Promise<ShoplineInvitation[]> {
      const query = client.from("shopline_install_invitations") as QueryLike;
      const { data, error } = await query
        .select(INVITATION_SELECT)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`shopline_invitation_list_failed: ${error.message}`);
      }

      return ((data as ShoplineInvitationRow[] | null) ?? []).map(toInvitation);
    },
  };
}
