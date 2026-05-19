import { describe, expect, it } from "vitest";
import {
  ensureActiveArticleJobSubscription,
  type ArticleJobSubscriptionRepository,
} from "./subscription";

function createRepository(
  overrides: Partial<ArticleJobSubscriptionRepository> = {},
): ArticleJobSubscriptionRepository {
  return {
    findActiveSubscription: async () => null,
    ...overrides,
  };
}

describe("ensureActiveArticleJobSubscription", () => {
  it("allows generation when the billing account has an active subscription", async () => {
    const result = await ensureActiveArticleJobSubscription({
      billingId: "company-1",
      repository: createRepository({
        findActiveSubscription: async () => ({
          id: "subscription-1",
          status: "active",
        }),
      }),
    });

    expect(result).toEqual({
      success: true,
      subscription: {
        id: "subscription-1",
        status: "active",
      },
    });
  });

  it("blocks generation when no active subscription exists", async () => {
    const result = await ensureActiveArticleJobSubscription({
      billingId: "company-1",
      repository: createRepository(),
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "NO_ACTIVE_SUBSCRIPTION",
        message: "找不到有效的訂閱，請聯絡客服信箱處理",
      },
    });
  });

  it("checks the resolved billing account id", async () => {
    const seenBillingIds: string[] = [];

    await ensureActiveArticleJobSubscription({
      billingId: "company-1",
      repository: createRepository({
        findActiveSubscription: async (billingId) => {
          seenBillingIds.push(billingId);
          return null;
        },
      }),
    });

    expect(seenBillingIds).toEqual(["company-1"]);
  });
});
