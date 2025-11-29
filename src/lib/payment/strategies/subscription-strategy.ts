/**
 * 訂閱支付策略
 */

import { BasePaymentStrategy } from "./base-payment-strategy";
import { PaymentContext, PaymentResult } from "./payment-strategy.interface";
import { SubscriptionActivationService } from "../services/subscription-activation-service";

export class SubscriptionStrategy extends BasePaymentStrategy {
  private activationService: SubscriptionActivationService;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(supabase: any) {
    super();
    this.activationService = new SubscriptionActivationService(supabase);
  }

  /**
   * 驗證訂閱支付
   */
  protected async validateSpecific(context: PaymentContext): Promise<boolean> {
    const { paymentData } = context;

    // 驗證是否為訂閱類型
    if (paymentData.productType !== "subscription") {
      return false;
    }

    // 驗證訂閱計畫
    const validPlans = ["monthly", "annual"];
    if (
      !paymentData.subscriptionPlan ||
      !validPlans.includes(paymentData.subscriptionPlan)
    ) {
      console.error("Invalid subscription plan:", paymentData.subscriptionPlan);
      return false;
    }

    // 驗證金額是否匹配計畫
    const expectedAmount = this.getExpectedAmount(paymentData.subscriptionPlan);
    if (Math.abs(paymentData.Amt - expectedAmount) > 0.01) {
      console.error("Amount mismatch:", {
        expected: expectedAmount,
        actual: paymentData.Amt,
      });
      return false;
    }

    return true;
  }

  /**
   * 處理訂閱支付
   */
  async process(context: PaymentContext): Promise<PaymentResult> {
    const { paymentData, userId } = context;

    try {
      // 檢查是否已處理
      if (await this.isTransactionProcessed(context)) {
        return {
          success: false,
          error: "Transaction already processed",
        };
      }

      // 創建交易記錄
      const transaction = await this.createTransaction(context);
      if (!transaction) {
        return {
          success: false,
          error: "Failed to create transaction",
        };
      }

      // 啟用訂閱
      const result = await this.activationService.activateSubscription({
        userId,
        plan: paymentData.subscriptionPlan as "monthly" | "annual",
        amount: paymentData.Amt,
        referralCode: paymentData.referralCode,
        transactionId: transaction.id,
      });

      if (!result.success) {
        await this.updateTransaction(context, transaction.id, "failed");
        return {
          success: false,
          error: result.error,
        };
      }

      // 更新交易狀態
      await this.updateTransaction(context, transaction.id, "completed");

      return {
        success: true,
        orderId: paymentData.MerchantOrderNo,
        subscription: result.subscription,
        tokenUsage: result.tokenUsage,
        transaction,
      };
    } catch (error) {
      console.error("Subscription payment failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 訂閱後處理
   */
  protected async postProcessSpecific(
    context: PaymentContext,
    result: PaymentResult,
  ): Promise<void> {
    if (!result.success || !result.subscription) {
      return;
    }

    // 發送歡迎郵件
    await this.sendWelcomeEmail(context, result.subscription);

    // 處理首次付費用戶獎勵
    if (await this.isFirstPayment(context)) {
      await this.processFirstPaymentRewards(context);
    }

    // 更新分析數據
    await this.trackSubscription(context, result.subscription);
  }

  /**
   * 獲取預期金額
   */
  private getExpectedAmount(plan: string): number {
    const prices: Record<string, number> = {
      monthly: 1999,
      annual: 9999,
    };

    return prices[plan] || 0;
  }

  /**
   * 檢查是否為首次付費
   */
  private async isFirstPayment(context: PaymentContext): Promise<boolean> {
    const { supabase, userId } = context;

    const { data } = await supabase
      .from("payment_transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "completed")
      .limit(2);

    return !data || data.length === 1;
  }

  /**
   * 處理首次付費獎勵
   */
  private async processFirstPaymentRewards(
    context: PaymentContext,
  ): Promise<void> {
    const { supabase, userId, paymentData } = context;
    const rules = this.getBusinessRules().referral;

    try {
      // 如果有推薦碼，發放額外獎勵
      if (paymentData.referralCode) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).rpc("add_first_payment_bonus", {
          p_user_id: userId,
          p_amount: rules.signupReward,
        });
      }
    } catch (error) {
      console.error("Failed to process first payment rewards:", error);
    }
  }

  /**
   * 發送歡迎郵件
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async sendWelcomeEmail(
    context: PaymentContext,
    subscription: any,
  ): Promise<void> {
    try {
      console.log("Sending welcome email:", {
        email: context.paymentData.Email,
        plan: subscription.plan,
      });
    } catch (error) {
      console.error("Failed to send welcome email:", error);
    }
  }

  /**
   * 追蹤訂閱分析
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async trackSubscription(
    context: PaymentContext,
    subscription: any,
  ): Promise<void> {
    try {
      console.log("Tracking subscription:", {
        userId: context.userId,
        plan: subscription.plan,
        amount: context.paymentData.Amt,
      });
    } catch (error) {
      console.error("Failed to track subscription:", error);
    }
  }
}
