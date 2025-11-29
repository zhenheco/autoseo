/**
 * 支付策略介面定義
 */

import { Database } from "@/types/database.types";
import { SupabaseClient } from "@supabase/supabase-js";

export type PaymentProduct =
  | "token_package"
  | "subscription"
  | "lifetime"
  | "custom";

export interface PaymentData {
  MerchantOrderNo: string;
  Status: string;
  RespondCode: string;
  TimeStamp: string;
  Amt: number;
  ItemDesc: string;
  Email: string;
  MerchantID: string;
  userId?: string;
  productType?: PaymentProduct;
  subscriptionPlan?: string;
  tokenAmount?: number;
  referralCode?: string;
}

export interface PaymentResult {
  success: boolean;
  orderId?: string;
  error?: string;
  subscription?: Database["public"]["Tables"]["company_subscriptions"]["Row"];
  tokenUsage?: Database["public"]["Tables"]["token_usage_logs"]["Row"];
  transaction?: Database["public"]["Tables"]["payment_orders"]["Row"];
}

export interface PaymentContext {
  supabase: SupabaseClient<Database>;
  paymentData: PaymentData;
  userId: string;
  existingTransaction?: Database["public"]["Tables"]["payment_orders"]["Row"];
}

/**
 * 支付策略介面
 */
export interface PaymentStrategy {
  /**
   * 驗證支付資料
   */
  validate(context: PaymentContext): Promise<boolean>;

  /**
   * 處理支付邏輯
   */
  process(context: PaymentContext): Promise<PaymentResult>;

  /**
   * 支付後的處理（發送郵件、通知等）
   */
  postProcess(context: PaymentContext, result: PaymentResult): Promise<void>;
}
