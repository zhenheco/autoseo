/**
 * Token Package 支付策略
 */

import { BasePaymentStrategy } from "./base-payment-strategy";
import { PaymentContext, PaymentResult } from "./payment-strategy.interface";

export class TokenPackageStrategy extends BasePaymentStrategy {
  /**
   * 驗證 Token Package 支付
   */
  protected async validateSpecific(context: PaymentContext): Promise<boolean> {
    const { paymentData } = context;

    // 驗證是否為 token package 類型
    if (paymentData.productType !== "token_package") {
      return false;
    }

    // 驗證 token 數量
    if (!paymentData.tokenAmount || paymentData.tokenAmount <= 0) {
      console.error("Invalid token amount");
      return false;
    }

    return true;
  }

  /**
   * 處理 Token Package 支付
   */
  async process(context: PaymentContext): Promise<PaymentResult> {
    const { supabase, paymentData, userId } = context;

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

      // 更新 token usage
      const tokenUsage = await this.addTokens(
        supabase,
        userId,
        paymentData.tokenAmount!,
      );

      if (!tokenUsage) {
        await this.updateTransaction(context, transaction.id, "failed");
        return {
          success: false,
          error: "Failed to add tokens",
        };
      }

      // 更新交易狀態
      await this.updateTransaction(context, transaction.id, "completed");

      return {
        success: true,
        orderId: paymentData.MerchantOrderNo,
        tokenUsage,
        transaction,
      };
    } catch (error) {
      console.error("Token package payment failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Token Package 後處理
   */
  protected async postProcessSpecific(
    context: PaymentContext,
    result: PaymentResult,
  ): Promise<void> {
    if (!result.success) {
      return;
    }

    // 發送購買成功郵件
    await this.sendPurchaseEmail(context, result);

    // 更新用戶統計
    await this.updateUserStats(context);
  }

  /**
   * 添加 Tokens
   */
  private async addTokens(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    userId: string,
    amount: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    // 先嘗試更新現有記錄
    const { data: existing } = await supabase
      .from("token_usage")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (existing) {
      const { data, error } = await supabase
        .from("token_usage")
        .update({
          total_tokens: existing.total_tokens + amount,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        console.error("Failed to update token usage:", error);
        return null;
      }

      return data;
    }

    // 創建新記錄
    const { data, error } = await supabase
      .from("token_usage")
      .insert({
        user_id: userId,
        total_tokens: amount,
        used_tokens: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create token usage:", error);
      return null;
    }

    return data;
  }

  /**
   * 發送購買成功郵件
   */
  private async sendPurchaseEmail(
    context: PaymentContext,
    result: PaymentResult,
  ): Promise<void> {
    try {
      // 這裡應該呼叫郵件服務
      console.log("Sending purchase email:", {
        email: context.paymentData.Email,
        tokens: context.paymentData.tokenAmount,
      });
    } catch (error) {
      console.error("Failed to send purchase email:", error);
    }
  }

  /**
   * 更新用戶統計
   */
  private async updateUserStats(context: PaymentContext): Promise<void> {
    const { supabase, userId, paymentData } = context;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc("increment_user_purchase_count", {
        p_user_id: userId,
        p_amount: paymentData.Amt,
      });
    } catch (error) {
      console.error("Failed to update user stats:", error);
    }
  }
}
