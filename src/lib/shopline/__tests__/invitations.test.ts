import { describe, expect, it } from "vitest";
import {
  createShoplineInvitation,
  findActiveInvitation,
  redeemInvitation,
  type ShoplineInvitation,
  type ShoplineInvitationStore,
} from "../invitations";

function invitation(
  patch: Partial<ShoplineInvitation> = {},
): ShoplineInvitation {
  return {
    token: "00000000-0000-4000-8000-000000000001",
    companyId: "company-1",
    expectedShopHandle: null,
    note: null,
    expiresAt: "2026-05-28T00:00:00.000Z",
    lastRedeemedAt: null,
    redeemCount: 0,
    revokedAt: null,
    createdAt: "2026-05-21T00:00:00.000Z",
    ...patch,
  };
}

function createMemoryStore(
  seed: ShoplineInvitation[] = [],
): ShoplineInvitationStore {
  const invitations = new Map(seed.map((item) => [item.token, item] as const));

  return {
    async insert(input) {
      const item = invitation({
        companyId: input.companyId,
        expectedShopHandle: input.expectedShopHandle,
        note: input.note,
        expiresAt: input.expiresAt,
      });
      invitations.set(item.token, item);
      return item;
    },
    async findByToken(token) {
      return invitations.get(token) ?? null;
    },
    async redeem(token) {
      const current = invitations.get(token);
      if (!current) throw new Error("shopline_invitation_not_found");
      const next = invitation({
        ...current,
        redeemCount: current.redeemCount + 1,
        lastRedeemedAt: new Date().toISOString(),
      });
      invitations.set(token, next);
      return next;
    },
    async revoke(token) {
      const current = invitations.get(token);
      if (!current) throw new Error("shopline_invitation_not_found");
      const next = invitation({
        ...current,
        revokedAt: new Date().toISOString(),
      });
      invitations.set(token, next);
      return next;
    },
    async listByCompany(companyId) {
      return [...invitations.values()].filter(
        (item) => item.companyId === companyId,
      );
    },
  };
}

describe("SHOPLINE install invitations", () => {
  it("creates an invitation with the default 7-day TTL", async () => {
    const before = Date.now();
    const result = await createShoplineInvitation(createMemoryStore(), {
      companyId: "company-1",
    });
    const after = Date.now();

    expect(result.companyId).toBe("company-1");
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThanOrEqual(
      before + 6 * 86_400_000,
    );
    expect(new Date(result.expiresAt).getTime()).toBeLessThanOrEqual(
      after + 8 * 86_400_000,
    );
    expect(result.redeemCount).toBe(0);
    expect(result.revokedAt).toBeNull();
  });

  it("normalizes the expected shop handle when creating an invitation", async () => {
    const result = await createShoplineInvitation(createMemoryStore(), {
      companyId: "company-1",
      expectedShopHandle: "Brand.MyShopLine.com",
    });

    expect(result.expectedShopHandle).toBe("Brand");
  });

  it("rejects a missing token as not found", async () => {
    await expect(
      findActiveInvitation(createMemoryStore(), "missing-token"),
    ).rejects.toThrow("shopline_invitation_not_found");
  });

  it("rejects an expired invitation", async () => {
    const expired = invitation({
      token: "expired-token",
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    });

    await expect(
      findActiveInvitation(createMemoryStore([expired]), "expired-token"),
    ).rejects.toThrow("shopline_invitation_expired");
  });

  it("rejects a revoked invitation", async () => {
    const revoked = invitation({
      token: "revoked-token",
      revokedAt: new Date().toISOString(),
    });

    await expect(
      findActiveInvitation(createMemoryStore([revoked]), "revoked-token"),
    ).rejects.toThrow("shopline_invitation_revoked");
  });

  it("increments redeem count and records the last redeemed timestamp", async () => {
    const token = "redeem-token";
    const store = createMemoryStore([
      invitation({
        token,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    ]);

    const result = await redeemInvitation(store, token);

    expect(result.redeemCount).toBe(1);
    expect(result.lastRedeemedAt).not.toBeNull();
  });

  it("allows the same invitation to be redeemed repeatedly", async () => {
    const token = "reusable-token";
    const store = createMemoryStore([
      invitation({
        token,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    ]);

    await redeemInvitation(store, token);
    const second = await redeemInvitation(store, token);

    expect(second.redeemCount).toBe(2);
    expect(second.revokedAt).toBeNull();
  });
});
