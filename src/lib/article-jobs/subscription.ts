export interface ArticleJobActiveSubscription {
  id: string;
  status: "active";
}

export interface ArticleJobSubscriptionRepository {
  findActiveSubscription(
    billingId: string,
  ): Promise<ArticleJobActiveSubscription | null>;
}

export type ArticleJobSubscriptionGuardResult =
  | {
      success: true;
      subscription: ArticleJobActiveSubscription;
    }
  | {
      success: false;
      error: {
        code: "NO_ACTIVE_SUBSCRIPTION";
        message: string;
      };
    };

export async function ensureActiveArticleJobSubscription({
  billingId,
  repository,
}: {
  billingId: string;
  repository: ArticleJobSubscriptionRepository;
}): Promise<ArticleJobSubscriptionGuardResult> {
  const subscription = await repository.findActiveSubscription(billingId);

  if (!subscription) {
    return {
      success: false,
      error: {
        code: "NO_ACTIVE_SUBSCRIPTION",
        message: "找不到有效的訂閱，請聯絡客服信箱處理",
      },
    };
  }

  return {
    success: true,
    subscription,
  };
}
