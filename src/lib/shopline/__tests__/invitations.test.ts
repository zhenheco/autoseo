import { describe, expect, it } from "vitest";
import {
  createShoplineInvitation,
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
});
