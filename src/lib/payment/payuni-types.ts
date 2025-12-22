/**
 * PAYUNi 金流 SDK 類型定義
 *
 * 基於金流微服務 SDK 文檔
 * @see /Volumes/500G/Claudecode/Finished/affiliate-system/docs/sdk/payment-integration/types.ts
 */

/** SDK 初始化設定 */
export interface PayUniClientConfig {
  /** API 認證金鑰 */
  apiKey: string;
  /** 網站代碼 */
  siteCode: string;
  /** Webhook 簽名密鑰 */
  webhookSecret: string;
  /** 環境：sandbox（測試）或 production（正式） */
  environment: "sandbox" | "production";
}

/** 單次付款請求參數 */
export interface CreatePaymentParams {
  /** 訂單編號（唯一） */
  orderId: string;
  /** 付款金額（TWD） */
  amount: number;
  /** 商品描述 */
  description: string;
  /** 付款人 Email */
  email: string;
  /** 付款人姓名（選填） */
  payerName?: string;
  /** 付款人電話（選填） */
  payerPhone?: string;
  /** 付款完成後跳轉網址 */
  callbackUrl?: string;
  /** 自訂 metadata */
  metadata?: Record<string, string>;
}

/** 續期收款（訂閱）請求參數 */
export interface CreatePeriodPaymentParams {
  /** 訂單編號（唯一） */
  orderId: string;
  /** 續期收款參數 */
  periodParams: {
    /** 每期金額（>1 元） */
    periodAmt: number;
    /** 商品說明 */
    prodDesc: string;
    /** 扣款週期 */
    periodType: "week" | "month" | "year";
    /**
     * 扣款日期
     * - week: 1~7（星期一~日）
     * - month: 1~31（每月幾號）
     * - year: YYYY-MM-DD
     */
    periodDate: string;
    /** 扣款期數（上限 900） */
    periodTimes: number;
    /** 首期扣款設定 */
    firstType: "job" | "build" | "date";
    /** 首期扣款日期（firstType=date 時必填） */
    firstDate?: string;
    /** 首期金額（選填，未填則同每期金額） */
    firstAmt?: number;
    /** 付款人姓名（選填） */
    payerName?: string;
    /** 付款人電話（選填） */
    payerPhone?: string;
    /** 付款人 Email（選填） */
    payerEmail?: string;
  };
  /** 付款完成後跳轉網址 */
  callbackUrl?: string;
  /** 自訂 metadata */
  metadata?: Record<string, string>;
}

/** PAYUNi 表單資料（前端跳轉用） */
export interface PayuniFormData {
  /** 表單提交網址 */
  action: string;
  /** HTTP 方法 */
  method: "POST";
  /** 表單欄位 */
  fields: {
    MerID: string;
    Version: string;
    EncryptInfo: string;
    HashInfo: string;
  };
}

/** 建立付款回應 */
export interface CreatePaymentResponse {
  success: boolean;
  data?: {
    /** 付款記錄 ID */
    paymentId: string;
    /** PAYUNi 表單資料 */
    payuniForm: PayuniFormData;
  };
  error?: {
    code: string;
    message: string;
  };
}

/** 付款狀態 */
export type PaymentStatus =
  | "PENDING" // 待付款
  | "SUCCESS" // 付款成功
  | "FAILED" // 付款失敗
  | "EXPIRED" // 已過期
  | "CANCELLED" // 已取消
  | "REFUNDED"; // 已退款

/** 付款狀態查詢回應 */
export interface PaymentStatusResponse {
  success: boolean;
  data?: {
    paymentId: string;
    orderId: string;
    status: PaymentStatus;
    amount: number;
    currency: string;
    description: string;
    paidAt?: string;
    createdAt: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

/** Webhook 事件類型 */
export type WebhookEventType =
  | "payment.success" // 單次付款成功
  | "payment.failed" // 付款失敗
  | "period.authorized" // 續期收款授權成功
  | "period.deducted" // 續期扣款成功
  | "period.failed"; // 續期扣款失敗

/** Webhook 事件資料 */
export interface WebhookEventData {
  /** 付款記錄 ID */
  paymentId: string;
  /** 訂單編號 */
  orderId: string;
  /** 金額 */
  amount: number;
  /** 付款狀態 */
  status: PaymentStatus;
  /** PAYUNi 交易編號 */
  tradeNo?: string;
  /** 付款時間 */
  paidAt?: string;
  /** 錯誤訊息（失敗時） */
  errorMessage?: string;
  /** 續期收款單號（續期收款專用） */
  periodTradeNo?: string;
  /** 當期期數（續期收款專用） */
  currentPeriod?: number;
}

/** Webhook 事件 */
export interface WebhookEvent {
  /** 事件類型 */
  type: WebhookEventType;
  /** 事件資料 */
  data: WebhookEventData;
  /** 事件時間 */
  timestamp: string;
}

/** SDK 客戶端介面 */
export interface PayUniClient {
  /** 建立單次付款 */
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResponse>;
  /** 建立續期收款（訂閱） */
  createPeriodPayment(
    params: CreatePeriodPaymentParams,
  ): Promise<CreatePaymentResponse>;
  /** 查詢付款狀態 */
  getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse>;
  /** 驗證 Webhook 簽名並解析事件 */
  verifyWebhook(
    rawBody: string,
    signature: string,
  ): Promise<WebhookEvent | null>;
  /** 取得基礎 URL（用於測試） */
  getBaseUrl(): string;
}
