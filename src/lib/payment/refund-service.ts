import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { NewebPayService } from "./newebpay-service";

type RefundRequestRow = Database["public"]["Tables"]["refund_requests"]["Row"];
type RefundRequestInsert =
  Database["public"]["Tables"]["refund_requests"]["Insert"];
type PaymentOrderRow = Database["public"]["Tables"]["payment_orders"]["Row"];

export interface CreateRefundRequestParams {
  companyId: string;
  paymentOrderId: string;
  reasonCategory: RefundRequestInsert["reason_category"];
  reasonDetail?: string;
}

export interface RefundEligibility {
  eligible: boolean;
  isAutoEligible: boolean;
  daysSincePurchase: number;
  reason: string;
  retentionCredits: number;
}

export class RefundService {
  private supabase: ReturnType<typeof createClient<Database>>;
  private newebpay: NewebPayService;

  constructor(
    supabase: ReturnType<typeof createClient<Database>>,
    newebpay: NewebPayService,
  ) {
    this.supabase = supabase;
    this.newebpay = newebpay;
  }

  /**
   * 生成退款單號
   */
  private generateRefundNo(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    return `REF${timestamp}${random}`;
  }

  /**
   * 檢查退款資格
   */
  async checkEligibility(paymentOrderId: string): Promise<RefundEligibility> {
    // 取得訂單資訊
    const { data: orderData, error } = await this.supabase
      .from("payment_orders")
      .select("*")
      .eq("id", paymentOrderId)
      .single();

    const order = orderData as PaymentOrderRow | null;

    if (error || !order) {
      return {
        eligible: false,
        isAutoEligible: false,
        daysSincePurchase: 0,
        reason: "找不到訂單",
        retentionCredits: 0,
      };
    }

    // 檢查訂單狀態（只有 success 狀態才能退款）
    if (order.status !== "success") {
      const reason =
        order.status === "refunded"
          ? "此訂單已退款"
          : "訂單尚未支付成功，無法退款";
      return {
        eligible: false,
        isAutoEligible: false,
        daysSincePurchase: 0,
        reason,
        retentionCredits: 0,
      };
    }

    // 檢查是否有進行中的退款申請
    const { data: existingRequest } = await this.supabase
      .from("refund_requests")
      .select("id, status")
      .eq("payment_order_id", paymentOrderId)
      .not("status", "in", '("rejected","failed")')
      .maybeSingle();

    if (existingRequest) {
      return {
        eligible: false,
        isAutoEligible: false,
        daysSincePurchase: 0,
        reason: "此訂單已有進行中的退款申請",
        retentionCredits: 0,
      };
    }

    // 計算購買天數
    const paidAt = order.paid_at
      ? new Date(order.paid_at)
      : new Date(order.created_at);
    const daysSincePurchase = Math.floor(
      (Date.now() - paidAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    // 檢查是否超過 90 天（信用卡退款限制）
    if (daysSincePurchase > 90) {
      return {
        eligible: false,
        isAutoEligible: false,
        daysSincePurchase,
        reason: "已超過 90 天的退款期限",
        retentionCredits: 0,
      };
    }

    // 是否符合自動退款（7 天內）
    const isAutoEligible = daysSincePurchase <= 7;

    // 計算慰留 credits（訂單金額的 50%）
    const retentionCredits = Math.floor(order.amount * 0.5);

    return {
      eligible: true,
      isAutoEligible,
      daysSincePurchase,
      reason: isAutoEligible
        ? "符合自動退款條件（購買後 7 天內）"
        : "需要人工審核（超過 7 天）",
      retentionCredits,
    };
  }

  /**
   * 創建退款申請
   */
  async createRefundRequest(params: CreateRefundRequestParams): Promise<{
    success: boolean;
    refundNo?: string;
    refundId?: string;
    eligibility?: RefundEligibility;
    error?: string;
  }> {
    // 檢查退款資格
    const eligibility = await this.checkEligibility(params.paymentOrderId);

    if (!eligibility.eligible) {
      return {
        success: false,
        error: eligibility.reason,
      };
    }

    // 取得訂單資訊
    const { data: orderData2, error: orderError } = await this.supabase
      .from("payment_orders")
      .select("*")
      .eq("id", params.paymentOrderId)
      .single();

    const order2 = orderData2 as PaymentOrderRow | null;

    if (orderError || !order2) {
      return {
        success: false,
        error: "找不到訂單",
      };
    }

    // 生成退款單號
    const refundNo = this.generateRefundNo();

    // 創建退款申請
    const refundData: RefundRequestInsert = {
      company_id: params.companyId,
      payment_order_id: params.paymentOrderId,
      refund_no: refundNo,
      original_amount: order2.amount,
      refund_amount: order2.amount,
      retention_offered: true,
      retention_credits: eligibility.retentionCredits,
      is_auto_eligible: eligibility.isAutoEligible,
      days_since_purchase: eligibility.daysSincePurchase,
      reason_category: params.reasonCategory,
      reason_detail: params.reasonDetail || null,
      status: "pending", // 等待用戶決定是否接受慰留
    };

    const { data: insertedRefundData, error: insertError } = await this.supabase
      .from("refund_requests")
      .insert(refundData)
      .select()
      .single();

    const refund = insertedRefundData as RefundRequestRow | null;

    if (insertError || !refund) {
      console.error("[RefundService] 創建退款申請失敗:", insertError);
      return {
        success: false,
        error: "創建退款申請失敗",
      };
    }

    console.log("[RefundService] ✅ 創建退款申請成功:", {
      refundNo,
      refundId: refund.id,
      isAutoEligible: eligibility.isAutoEligible,
    });

    return {
      success: true,
      refundNo,
      refundId: refund.id,
      eligibility,
    };
  }

  /**
   * 接受慰留方案
   */
  async acceptRetention(refundId: string): Promise<{
    success: boolean;
    creditsAdded?: number;
    error?: string;
  }> {
    // 取得退款申請
    const { data: refundData, error: fetchError } = await this.supabase
      .from("refund_requests")
      .select("*, payment_orders!inner(*)")
      .eq("id", refundId)
      .single();

    // Type cast for the joined query result
    const refund = refundData as
      | (RefundRequestRow & { payment_orders: PaymentOrderRow })
      | null;

    if (fetchError || !refund) {
      return {
        success: false,
        error: "找不到退款申請",
      };
    }

    if (refund.status !== "pending") {
      return {
        success: false,
        error: "此退款申請已處理",
      };
    }

    const creditsToAdd = refund.retention_credits;

    // 更新退款申請狀態
    const { error: updateRefundError } = await this.supabase
      .from("refund_requests")
      .update({
        status: "retention_accepted",
        retention_accepted: true,
        completed_at: new Date().toISOString(),
      })
      .eq("id", refundId);

    if (updateRefundError) {
      console.error("[RefundService] 更新退款申請失敗:", updateRefundError);
      return {
        success: false,
        error: "更新退款申請失敗",
      };
    }

    // 增加用戶 credits（直接查詢並更新）
    const { data: companyData } = await this.supabase
      .from("companies")
      .select("seo_token_balance")
      .eq("id", refund.company_id)
      .single();

    const balanceBefore = companyData?.seo_token_balance || 0;
    const balanceAfter = balanceBefore + creditsToAdd;

    if (companyData) {
      await this.supabase
        .from("companies")
        .update({
          seo_token_balance: balanceAfter,
        })
        .eq("id", refund.company_id);
    }

    // 記錄 token 變動
    await this.supabase.from("token_balance_changes").insert({
      company_id: refund.company_id,
      amount: creditsToAdd,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      change_type: "retention_bonus",
      description: `慰留方案贈送 credits（退款申請 ${refund.refund_no}）`,
    });

    console.log("[RefundService] ✅ 接受慰留成功:", {
      refundNo: refund.refund_no,
      creditsAdded: creditsToAdd,
    });

    return {
      success: true,
      creditsAdded: creditsToAdd,
    };
  }

  /**
   * 繼續退款（拒絕慰留）
   */
  async proceedWithRefund(refundId: string): Promise<{
    success: boolean;
    status?: string;
    error?: string;
  }> {
    // 取得退款申請
    const { data: refundData3, error: fetchError } = await this.supabase
      .from("refund_requests")
      .select("*")
      .eq("id", refundId)
      .single();

    const refund3 = refundData3 as RefundRequestRow | null;

    if (fetchError || !refund3) {
      return {
        success: false,
        error: "找不到退款申請",
      };
    }

    if (refund3.status !== "pending") {
      return {
        success: false,
        error: "此退款申請已處理",
      };
    }

    // 根據是否符合自動退款決定下一步
    if (refund3.is_auto_eligible) {
      // 自動退款：執行退款
      return this.executeRefund(refundId);
    } else {
      // 人工審核
      const { error: updateError } = await this.supabase
        .from("refund_requests")
        .update({
          status: "pending_review",
        })
        .eq("id", refundId);

      if (updateError) {
        return {
          success: false,
          error: "更新退款狀態失敗",
        };
      }

      return {
        success: true,
        status: "pending_review",
      };
    }
  }

  /**
   * 執行退款（調用藍新 API）
   */
  async executeRefund(refundId: string): Promise<{
    success: boolean;
    status?: string;
    error?: string;
  }> {
    // 取得退款申請和訂單資訊
    const { data: refundData4, error: fetchError } = await this.supabase
      .from("refund_requests")
      .select("*, payment_orders!inner(*)")
      .eq("id", refundId)
      .single();

    const refund = refundData4 as
      | (RefundRequestRow & { payment_orders: PaymentOrderRow })
      | null;

    if (fetchError || !refund) {
      return {
        success: false,
        error: "找不到退款申請",
      };
    }

    const order = refund.payment_orders as unknown as PaymentOrderRow;

    // 檢查訂單是否有藍新交易序號
    if (!order.newebpay_trade_no) {
      console.error("[RefundService] 訂單缺少藍新交易序號:", order.order_no);
      return {
        success: false,
        error: "訂單缺少藍新交易序號，無法退款",
      };
    }

    // 更新狀態為處理中
    await this.supabase
      .from("refund_requests")
      .update({
        status: "processing",
        processed_at: new Date().toISOString(),
      })
      .eq("id", refundId);

    // 調用藍新退款 API
    const refundResult = await this.newebpay.executeRefund({
      orderNo: order.order_no,
      amount: refund.refund_amount,
      tradeNo: order.newebpay_trade_no,
    });

    if (refundResult.success) {
      // 退款成功：更新狀態並執行後續處理
      await this.supabase
        .from("refund_requests")
        .update({
          status: "completed",
          newebpay_trade_no: refundResult.tradeNo,
          newebpay_status: refundResult.status,
          newebpay_message: refundResult.message,
          newebpay_response:
            refundResult.response as unknown as Database["public"]["Tables"]["refund_requests"]["Update"]["newebpay_response"],
          completed_at: new Date().toISOString(),
        })
        .eq("id", refundId);

      // 執行退款後處理
      await this.handlePostRefund(refundId);

      return {
        success: true,
        status: "completed",
      };
    } else {
      // 退款失敗
      await this.supabase
        .from("refund_requests")
        .update({
          status: "failed",
          newebpay_status: refundResult.status,
          newebpay_message: refundResult.message,
          newebpay_response:
            refundResult.response as unknown as Database["public"]["Tables"]["refund_requests"]["Update"]["newebpay_response"],
        })
        .eq("id", refundId);

      return {
        success: false,
        error: refundResult.message,
      };
    }
  }

  /**
   * 退款後處理
   */
  private async handlePostRefund(refundId: string): Promise<void> {
    const { data: refundData5, error } = await this.supabase
      .from("refund_requests")
      .select("*, payment_orders!inner(*)")
      .eq("id", refundId)
      .single();

    const refund = refundData5 as
      | (RefundRequestRow & { payment_orders: PaymentOrderRow })
      | null;

    if (error || !refund) {
      console.error("[RefundService] 找不到退款申請:", refundId);
      return;
    }

    const order = refund.payment_orders as unknown as PaymentOrderRow;

    // 1. 更新訂單狀態為已退款
    await this.supabase
      .from("payment_orders")
      .update({ status: "refunded" })
      .eq("id", order.id);

    // 2. 根據支付類型處理
    if (order.payment_type === "token_package") {
      // Token 包退款：扣除 credits
      // 查詢該訂單給的 credits（從 token_balance_changes）
      const { data: changes } = await this.supabase
        .from("token_balance_changes")
        .select("amount")
        .eq("company_id", refund.company_id)
        .eq("reference_id", order.id)
        .eq("change_type", "token_package_purchase");

      const creditsToDeduct =
        changes?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

      if (creditsToDeduct > 0) {
        // 扣除 credits（但不讓餘額變負）
        const { data: company } = await this.supabase
          .from("companies")
          .select("seo_token_balance")
          .eq("id", refund.company_id)
          .single();

        if (company) {
          const balanceBeforeDeduct = company.seo_token_balance;
          const newBalance = Math.max(0, balanceBeforeDeduct - creditsToDeduct);
          await this.supabase
            .from("companies")
            .update({ seo_token_balance: newBalance })
            .eq("id", refund.company_id);

          // 記錄 token 變動
          await this.supabase.from("token_balance_changes").insert({
            company_id: refund.company_id,
            amount: -creditsToDeduct,
            balance_before: balanceBeforeDeduct,
            balance_after: newBalance,
            change_type: "refund_deduction",
            description: `退款扣除 credits（訂單 ${order.order_no}）`,
            reference_id: order.id,
          });

          // 更新退款申請的扣除記錄
          await this.supabase
            .from("refund_requests")
            .update({ credits_deducted: creditsToDeduct })
            .eq("id", refundId);
        }
      }
    } else if (
      order.payment_type === "lifetime" ||
      order.payment_type === "subscription"
    ) {
      // 終身方案或訂閱退款：降級為 Free
      await this.supabase
        .from("companies")
        .update({
          subscription_tier: "free",
          subscription_ends_at: null,
        })
        .eq("id", refund.company_id);

      // 更新 company_subscriptions
      await this.supabase
        .from("company_subscriptions")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("company_id", refund.company_id)
        .eq("status", "active");

      // 扣除該方案給的 credits
      // 查詢該訂單給的 credits（使用 reference_id 和 amount 欄位）
      const { data: changes } = await this.supabase
        .from("token_balance_changes")
        .select("amount")
        .eq("company_id", refund.company_id)
        .eq("reference_id", order.id);

      const creditsToDeduct2 =
        changes?.reduce((sum, c) => sum + Math.max(0, c.amount || 0), 0) || 0;

      if (creditsToDeduct2 > 0) {
        const { data: company2 } = await this.supabase
          .from("companies")
          .select("seo_token_balance")
          .eq("id", refund.company_id)
          .single();

        if (company2) {
          const balanceBefore2 = company2.seo_token_balance;
          const newBalance2 = Math.max(0, balanceBefore2 - creditsToDeduct2);
          await this.supabase
            .from("companies")
            .update({ seo_token_balance: newBalance2 })
            .eq("id", refund.company_id);

          await this.supabase.from("token_balance_changes").insert({
            company_id: refund.company_id,
            amount: -creditsToDeduct2,
            balance_before: balanceBefore2,
            balance_after: newBalance2,
            change_type: "refund_deduction",
            description: `退款扣除 credits（訂單 ${order.order_no}）`,
            reference_id: order.id,
          });

          await this.supabase
            .from("refund_requests")
            .update({
              credits_deducted: creditsToDeduct2,
              subscription_downgraded: true,
            })
            .eq("id", refundId);
        }
      }

      // 3. 如果是定期定額，終止委託
      if (order.order_type === "recurring_first") {
        const { data: mandate } = await this.supabase
          .from("recurring_mandates")
          .select("id, newebpay_period_no")
          .eq("first_payment_order_id", order.id)
          .single();

        if (mandate?.newebpay_period_no) {
          // 調用藍新終止定期定額 API
          try {
            const terminateResult = this.newebpay.modifyRecurringStatus(
              mandate.newebpay_period_no,
              "terminate",
            );

            // 發送終止請求
            await fetch(terminateResult.apiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                MerchantID_: terminateResult.merchantId,
                PostData_: terminateResult.postData,
              }).toString(),
            });

            // 更新委託狀態
            await this.supabase
              .from("recurring_mandates")
              .update({
                status: "terminated",
                terminated_at: new Date().toISOString(),
                termination_reason: "refund",
              })
              .eq("id", mandate.id);

            console.log(
              "[RefundService] ✅ 已終止定期定額委託:",
              mandate.newebpay_period_no,
            );
          } catch (error) {
            console.error("[RefundService] 終止定期定額失敗:", error);
          }
        }
      }
    }

    console.log("[RefundService] ✅ 退款後處理完成:", {
      refundNo: refund.refund_no,
      paymentType: order.payment_type,
    });
  }

  /**
   * 取得可退款的訂單列表
   */
  async getRefundableOrders(companyId: string): Promise<PaymentOrderRow[]> {
    // 計算 90 天前的日期
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: ordersData, error } = await this.supabase
      .from("payment_orders")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "success")
      .gte("paid_at", ninetyDaysAgo.toISOString())
      .order("paid_at", { ascending: false });

    if (error || !ordersData) {
      return [];
    }

    const orders = ordersData as PaymentOrderRow[];

    // 過濾掉已有進行中退款申請的訂單
    const { data: existingRequests } = await this.supabase
      .from("refund_requests")
      .select("payment_order_id")
      .eq("company_id", companyId)
      .not("status", "in", '("rejected","failed")');

    const existingOrderIds = new Set(
      existingRequests?.map((r) => r.payment_order_id) || [],
    );

    return orders.filter((order) => !existingOrderIds.has(order.id));
  }

  /**
   * 取得退款申請狀態
   */
  async getRefundStatus(refundNo: string): Promise<RefundRequestRow | null> {
    const { data, error } = await this.supabase
      .from("refund_requests")
      .select("*")
      .eq("refund_no", refundNo)
      .single();

    if (error || !data) {
      return null;
    }

    return data as RefundRequestRow;
  }

  /**
   * 管理員：取得所有退款申請
   */
  async getRefundRequests(
    status?: string,
    page = 1,
    limit = 20,
  ): Promise<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any[];
    total: number;
  }> {
    let query = this.supabase
      .from("refund_requests")
      .select("*, payment_orders!inner(*), companies!inner(name)", {
        count: "exact",
      });

    if (status && status !== "all") {
      query = query.eq("status", status as RefundRequestRow["status"]);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      console.error("[RefundService] 查詢退款申請失敗:", error);
      return { data: [], total: 0 };
    }

    return {
      data: data || [],
      total: count || 0,
    };
  }

  /**
   * 管理員：核准退款
   */
  async approveRefund(
    refundId: string,
    reviewedBy: string,
    notes?: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const { data: refundData6, error: fetchError } = await this.supabase
      .from("refund_requests")
      .select("*")
      .eq("id", refundId)
      .single();

    const refund6 = refundData6 as RefundRequestRow | null;

    if (fetchError || !refund6) {
      return { success: false, error: "找不到退款申請" };
    }

    if (refund6.status !== "pending_review") {
      return { success: false, error: "此退款申請不在待審核狀態" };
    }

    // 更新為已核准
    const { error: updateError } = await this.supabase
      .from("refund_requests")
      .update({
        status: "approved",
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
      })
      .eq("id", refundId);

    if (updateError) {
      return { success: false, error: "更新退款狀態失敗" };
    }

    // 自動執行退款
    return this.executeRefund(refundId);
  }

  /**
   * 管理員：拒絕退款
   */
  async rejectRefund(
    refundId: string,
    reviewedBy: string,
    rejectReason: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const { data: refundData7, error: fetchError } = await this.supabase
      .from("refund_requests")
      .select("*")
      .eq("id", refundId)
      .single();

    const refund7 = refundData7 as RefundRequestRow | null;

    if (fetchError || !refund7) {
      return { success: false, error: "找不到退款申請" };
    }

    if (refund7.status !== "pending_review") {
      return { success: false, error: "此退款申請不在待審核狀態" };
    }

    const { error: updateError } = await this.supabase
      .from("refund_requests")
      .update({
        status: "rejected",
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        reject_reason: rejectReason,
        completed_at: new Date().toISOString(),
      })
      .eq("id", refundId);

    if (updateError) {
      return { success: false, error: "更新退款狀態失敗" };
    }

    return { success: true };
  }

  /**
   * 創建服務實例
   */
  static createInstance(): RefundService {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase 環境變數未設定");
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
    const newebpay = NewebPayService.createInstance();

    return new RefundService(supabase, newebpay);
  }
}
