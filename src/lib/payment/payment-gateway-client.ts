/**
 * 金流微服務 SDK
 *
 * 提供客戶端網站與金流微服務互動的介面。
 * 支援 sandbox（測試）和 production（正式）兩種環境。
 * 支援單次付款和定期定額付款。
 * 使用 PAYUNi（統一金流）作為金流服務商。
 *
 * ## 安裝
 *
 * ```bash
 * npm install @affiliate/payment-sdk
 * # 或
 * yarn add @affiliate/payment-sdk
 * ```
 *
 * ## 初始化
 *
 * ```typescript
 * import { PaymentGatewayClient } from '@affiliate/payment-sdk';
 *
 * const client = new PaymentGatewayClient({
 *   apiKey: 'your-api-key',
 *   siteCode: 'YOUR_SITE',
 *   webhookSecret: 'your-webhook-secret',
 *   environment: 'sandbox', // 測試環境，正式環境改為 'production'
 * });
 * ```
 *
 * ## 單次付款
 *
 * ```typescript
 * const result = await client.createPayment({
 *   orderId: 'order-123',
 *   amount: 1990,
 *   description: '專業版訂閱',
 *   email: 'user@example.com',
 * });
 *
 * // 提交表單到 PAYUNi
 * submitPaymentForm(result.paymentForm);
 * ```
 *
 * ## 定期定額付款
 *
 * ```typescript
 * const result = await client.createPayment({
 *   orderId: 'subscription-123',
 *   amount: 299,
 *   description: '月費方案',
 *   email: 'user@example.com',
 *   periodParams: {
 *     periodType: 'M',      // 每月
 *     periodPoint: '01',    // 每月 1 號
 *     periodAmt: 299,       // 每期金額
 *     periodTimes: 12,      // 共 12 期
 *   },
 * });
 *
 * // 提交表單到 PAYUNi
 * submitPaymentForm(result.paymentForm);
 * ```
 *
 * ## 驗證 Webhook
 *
 * ```typescript
 * const event = await client.parseWebhookEvent(rawBody, signature);
 * if (event.status === 'SUCCESS') {
 *   // 付款成功處理
 * }
 * ```
 *
 * ## PAYUNi Sandbox 測試
 *
 * Sandbox 環境使用 PAYUNi 測試商店，請登入 PAYUNi 後台取得測試卡號資訊。
 */

// ========================================
// 類型定義
// ========================================

/**
 * 環境類型
 */
export type Environment = "sandbox" | "production";

/**
 * SDK 配置選項
 */
export interface PaymentGatewayConfig {
  /** API Key（從 Admin 後台取得） */
  apiKey: string;
  /** 網站代碼（從 Admin 後台取得） */
  siteCode: string;
  /** Webhook Secret（用於驗證回調簽名） */
  webhookSecret?: string;
  /** 環境（預設 production） */
  environment?: Environment;
  /** 自訂 Base URL（會覆寫環境設定） */
  baseUrl?: string;
  /** 請求超時時間（毫秒，預設 30000） */
  timeout?: number;
}

/**
 * 定期定額週期類型
 */
export type PeriodType = "D" | "W" | "M" | "Y";

/**
 * 定期定額參數（PAYUNi 格式）
 */
export interface PeriodPaymentParams {
  /**
   * 週期類型
   * - D: 每日（注意：目前微服務會映射至每週）
   * - W: 每週
   * - M: 每月
   * - Y: 每年
   */
  periodType: PeriodType;
  /**
   * 扣款日期點（選填，若未提供則依首次扣款日自動計算）
   * - D/W: 1~7（星期一~日）
   * - M: 01~31（每月幾號）
   * - Y: MMDD（每年幾月幾號，如 0115）
   */
  periodPoint?: string;
  /** 授權期數（共幾期） */
  periodTimes: number;
  /** 首次扣款日（YYYY-MM-DD，選填，向下相容） */
  periodFirstdate?: string;
  /**
   * 交易模式（選填）
   * - 1: 十元授權（立即扣 10 元驗證，首期依排程）
   * - 2: 委託金額授權（立即扣首期金額）
   * - 3: 不授權
   * 預設為 2
   */
  periodStartType?: 1 | 2 | 3;
}

/**
 * 發票載具類型
 */
export type InvoiceCarrierType = "MOBILE" | "CERTIFICATE" | "DONATE";

/**
 * 發票輸入資訊
 */
export interface InvoiceInput {
  /** 買方名稱（預設用付款人姓名） */
  buyerName?: string;
  /** 買方統編（有填 = B2B 發票） */
  buyerTaxId?: string;
  /** 發票 Email（預設用付款人 email） */
  buyerEmail?: string;
  /** 買方地址 */
  buyerAddress?: string;
  /** 買方電話 */
  buyerPhone?: string;
  /** 載具類型：MOBILE=手機條碼, CERTIFICATE=自然人憑證, DONATE=捐贈 */
  carrierType?: InvoiceCarrierType;
  /** 載具號碼（手機條碼/自然人憑證）或捐贈碼 */
  carrierId?: string;
}

/**
 * 建立付款參數
 */
export interface CreatePaymentParams {
  /** 訂單 ID（必須唯一） */
  orderId: string;
  /** 付款金額（正整數，單位：元） */
  amount: number;
  /** 商品描述 */
  description: string;
  /** 付款人 Email */
  email: string;
  /** 付款人姓名 */
  payerName?: string;
  /** 付款人電話 */
  payerPhone?: string;
  /** 自訂回調 URL（覆寫網站配置） */
  callbackUrl?: string;
  /** 付款期限（分鐘，預設 30，僅單次付款有效） */
  expireMinutes?: number;
  /** 額外資料（會在 Webhook 中返回） */
  metadata?: Record<string, unknown>;
  /** 定期定額參數（提供此參數則為定期定額付款） */
  periodParams?: PeriodPaymentParams;
  /** 發票資訊（付款成功後自動開立） */
  invoice?: InvoiceInput;
}

/**
 * 付款結果
 */
export interface PaymentResult {
  /** 是否成功 */
  success: boolean;
  /** 付款 ID */
  paymentId: string;
  /** PAYUNi 表單資料（用於前端提交） */
  paymentForm?: {
    /** 表單提交網址 */
    action: string;
    /** HTTP 方法 */
    method: "POST";
    /**
     * 表單欄位
     * - MerID: 商店編號
     * - Version: API 版本（1.0）
     * - EncryptInfo: 加密資料
     * - HashInfo: 簽名
     */
    fields: Record<string, string>;
  };
  /**
   * PAYUNi 表單資料（別名，與後端欄位名稱一致）
   */
  payuniForm?: PaymentResult["paymentForm"];
  /** 是否為定期定額付款 */
  isPeriodPayment?: boolean;
  /** 錯誤訊息 */
  error?: string;
}

/**
 * 付款狀態
 */
export type PaymentStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

/**
 * 付款狀態查詢結果
 */
export interface PaymentStatusResult {
  /** 付款 ID */
  paymentId: string;
  /** 訂單 ID */
  orderId: string;
  /** 付款狀態 */
  status: PaymentStatus;
  /** 金額 */
  amount: number;
  /** 幣別（預設 TWD） */
  currency?: string;
  /** 付款時間（ISO 8601） */
  paidAt?: string;
  /** 金流服務商交易序號 */
  tradeNo?: string;
  /** 金流服務商名稱 */
  provider?: string;
  /** 錯誤代碼 */
  errorCode?: string;
  /** 錯誤訊息 */
  errorMessage?: string;
  /** 額外資料 */
  metadata?: Record<string, unknown>;
  /** 建立時間 */
  createdAt?: string;
}

/**
 * Webhook 事件
 */
export interface WebhookEvent {
  /** 付款 ID */
  paymentId: string;
  /** 訂單 ID */
  orderId: string;
  /** 付款狀態 */
  status: PaymentStatus;
  /** 金額 */
  amount?: number;
  /** 付款時間 */
  paidAt?: string;
  /** 金流服務商交易序號 */
  tradeNo?: string;
  /** 付款方式 */
  paymentType?: string;
  /** 額外資料 */
  metadata?: Record<string, unknown>;
  /** 錯誤訊息（當 status 為 FAILED 時） */
  errorMessage?: string;
  /** 金流服務商 */
  provider?: string;
  /** 信用卡指紋（SHA-256，同一張卡 = 同一個值） */
  cardFingerprint?: string;
  /** 信用卡後 4 碼（供 UI 顯示） */
  cardLast4?: string;
  /** 發票資訊（若有開立） */
  invoice?: {
    /** 發票號碼 */
    invoiceNumber?: string;
    /** 發票隨機碼 */
    randomNumber?: string;
    /** 發票日期 */
    invoiceDate?: string;
    /** 發票狀態 */
    status?: string;
    /** 錯誤訊息 */
    errorMessage?: string;
  };
}

// ========================================
// 錯誤類別
// ========================================

/**
 * 金流 SDK 錯誤
 */
export class PaymentGatewayError extends Error {
  /** 錯誤代碼 */
  readonly code: string;
  /** HTTP 狀態碼 */
  readonly statusCode?: number;
  /** 原始錯誤 */
  readonly cause?: Error;

  constructor(
    message: string,
    code: string,
    options?: { statusCode?: number; cause?: Error },
  ) {
    super(message);
    this.name = "PaymentGatewayError";
    this.code = code;
    this.statusCode = options?.statusCode;
    this.cause = options?.cause;
  }
}

// ========================================
// 預設配置
// ========================================

const DEFAULT_URLS = {
  sandbox: "https://sandbox.affiliate.1wayseo.com",
  production: "https://affiliate.1wayseo.com",
} as const;

const DEFAULT_TIMEOUT = 30000;

// ========================================
// SDK 實作
// ========================================

/**
 * 金流微服務客戶端
 *
 * 提供與金流微服務互動的方法，包括：
 * - 建立付款請求
 * - 查詢付款狀態
 * - 驗證 Webhook 簽名
 */
export class PaymentGatewayClient {
  private readonly config: Required<
    Omit<PaymentGatewayConfig, "webhookSecret">
  > & { webhookSecret?: string };

  constructor(config: PaymentGatewayConfig) {
    // 驗證必填參數
    if (!config.apiKey?.trim()) {
      throw new PaymentGatewayError("apiKey 是必填參數", "MISSING_API_KEY");
    }

    if (!config.siteCode?.trim()) {
      throw new PaymentGatewayError("siteCode 是必填參數", "MISSING_SITE_CODE");
    }

    const environment = config.environment || "production";

    this.config = {
      apiKey: config.apiKey.trim(),
      siteCode: config.siteCode.trim().toUpperCase(),
      webhookSecret: config.webhookSecret?.trim(),
      environment,
      baseUrl: config.baseUrl?.trim() || DEFAULT_URLS[environment],
      timeout: config.timeout || DEFAULT_TIMEOUT,
    };
  }

  // ========================================
  // 公開方法 - 配置資訊
  // ========================================

  /**
   * 取得當前環境
   */
  getEnvironment(): Environment {
    return this.config.environment;
  }

  /**
   * 取得 Base URL
   */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  // ========================================
  // 公開方法 - 付款操作
  // ========================================

  /**
   * 建立付款請求
   *
   * @param params 付款參數
   * @returns 付款結果（包含 PAYUNi 表單資料）
   *
   * @example
   * ```typescript
   * const result = await client.createPayment({
   *   orderId: 'ORDER-2025-001',
   *   amount: 1990,
   *   description: '專業版訂閱',
   *   email: 'user@example.com',
   * });
   *
   * // 前端提交表單到 PAYUNi
   * if (result.paymentForm) {
   *   const form = document.createElement('form');
   *   form.action = result.paymentForm.action;
   *   form.method = result.paymentForm.method;
   *   for (const [key, value] of Object.entries(result.paymentForm.fields)) {
   *     const input = document.createElement('input');
   *     input.type = 'hidden';
   *     input.name = key;
   *     input.value = value;
   *     form.appendChild(input);
   *   }
   *   document.body.appendChild(form);
   *   form.submit();
   * }
   * ```
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    // 驗證參數
    this.validateCreatePaymentParams(params);

    const url = `${this.config.baseUrl}/api/payment/create`;

    try {
      const response = await this.fetch(url, {
        method: "POST",
        body: JSON.stringify({
          ...params,
          siteCode: this.config.siteCode,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new PaymentGatewayError(
          error.error || "建立付款失敗",
          "CREATE_PAYMENT_FAILED",
          { statusCode: response.status },
        );
      }

      const result = await response.json();

      // 向下相容處理：將後端的 payuniForm 映射至 SDK 的 paymentForm
      if (result.payuniForm && !result.paymentForm) {
        result.paymentForm = result.payuniForm;
      }

      return result;
    } catch (error) {
      if (error instanceof PaymentGatewayError) {
        throw error;
      }
      throw new PaymentGatewayError("網路請求失敗", "NETWORK_ERROR", {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * 查詢付款狀態
   *
   * @param paymentId 付款 ID
   * @returns 付款狀態
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResult> {
    if (!paymentId?.trim()) {
      throw new PaymentGatewayError(
        "paymentId 是必填參數",
        "MISSING_PAYMENT_ID",
      );
    }

    const url = `${this.config.baseUrl}/api/payment/${encodeURIComponent(paymentId)}`;

    try {
      const response = await this.fetch(url, { method: "GET" });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new PaymentGatewayError(
          error.error || "查詢付款狀態失敗",
          "GET_PAYMENT_STATUS_FAILED",
          { statusCode: response.status },
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof PaymentGatewayError) {
        throw error;
      }
      throw new PaymentGatewayError("網路請求失敗", "NETWORK_ERROR", {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  // ========================================
  // 公開方法 - Webhook 處理
  // ========================================

  /**
   * 生成 HMAC-SHA256 簽名
   *
   * @param payload 要簽名的資料
   * @returns 十六進位簽名字串
   */
  async generateSignature(payload: object): Promise<string> {
    if (!this.config.webhookSecret) {
      throw new PaymentGatewayError(
        "webhookSecret 未設定，無法生成簽名",
        "MISSING_WEBHOOK_SECRET",
      );
    }

    const data = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.config.webhookSecret);
    const messageData = encoder.encode(data);

    // 使用 Web Crypto API（相容 Cloudflare Workers）
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);

    // 轉換為十六進位字串
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * 驗證 Webhook 簽名
   *
   * @param payload Webhook 資料
   * @param signature 請求中的簽名
   * @returns 是否有效
   */
  async verifyWebhookSignature(
    payload: object,
    signature: string,
  ): Promise<boolean> {
    if (!this.config.webhookSecret) {
      throw new PaymentGatewayError(
        "webhookSecret 未設定，無法驗證簽名",
        "MISSING_WEBHOOK_SECRET",
      );
    }

    try {
      const expectedSignature = await this.generateSignature(payload);
      return this.timingSafeEqual(expectedSignature, signature);
    } catch {
      return false;
    }
  }

  /**
   * 解析並驗證 Webhook 事件
   *
   * @param rawBody 原始請求 body（JSON 字串）
   * @param signature 請求中的簽名（從 X-Webhook-Signature header 取得）
   * @returns 驗證後的 Webhook 事件
   *
   * @example
   * ```typescript
   * // 在 API route 中
   * export async function POST(request: Request) {
   *   const rawBody = await request.text();
   *   const signature = request.headers.get('X-Webhook-Signature');
   *
   *   try {
   *     const event = await client.parseWebhookEvent(rawBody, signature);
   *
   *     switch (event.status) {
   *       case 'SUCCESS':
   *         await handlePaymentSuccess(event);
   *         break;
   *       case 'FAILED':
   *         await handlePaymentFailed(event);
   *         break;
   *     }
   *
   *     return new Response('OK', { status: 200 });
   *   } catch (error) {
   *     return new Response('Unauthorized', { status: 401 });
   *   }
   * }
   * ```
   */
  async parseWebhookEvent(
    rawBody: string,
    signature: string | null,
  ): Promise<WebhookEvent> {
    if (!signature) {
      throw new PaymentGatewayError("缺少 Webhook 簽名", "MISSING_SIGNATURE");
    }

    let payload: WebhookEvent;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new PaymentGatewayError("無效的 JSON 格式", "INVALID_JSON");
    }

    const isValid = await this.verifyWebhookSignature(payload, signature);
    if (!isValid) {
      throw new PaymentGatewayError(
        "Webhook 簽名驗證失敗",
        "INVALID_SIGNATURE",
      );
    }

    return payload;
  }

  // ========================================
  // 靜態工具方法
  // ========================================

  /**
   * 格式化金額（加上千分位和幣別）
   */
  static formatAmount(amount: number, currency = "TWD"): string {
    const symbol = currency === "TWD" ? "NT$" : currency;
    return `${symbol}${amount.toLocaleString("zh-TW")}`;
  }

  /**
   * 驗證訂單 ID 格式
   */
  static isValidOrderId(orderId: string): boolean {
    if (!orderId || orderId.length > 50) {
      return false;
    }
    // 只允許英文、數字、連字號（符合 PAYUNi 規範）
    return /^[a-zA-Z0-9-]+$/.test(orderId);
  }

  /**
   * 驗證 Email 格式
   */
  static isValidEmail(email: string): boolean {
    if (!email) {
      return false;
    }
    // 基本 Email 格式驗證
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // ========================================
  // 私有方法
  // ========================================

  /**
   * 驗證建立付款參數
   */
  private validateCreatePaymentParams(params: CreatePaymentParams): void {
    if (!params.orderId?.trim()) {
      throw new PaymentGatewayError("orderId 是必填參數", "VALIDATION_ERROR");
    }

    if (!PaymentGatewayClient.isValidOrderId(params.orderId)) {
      throw new PaymentGatewayError(
        "orderId 格式無效（只允許英文、數字、連字號，最長 50 字元）",
        "VALIDATION_ERROR",
      );
    }

    if (!Number.isInteger(params.amount) || params.amount <= 0) {
      throw new PaymentGatewayError("amount 必須是正整數", "VALIDATION_ERROR");
    }

    if (!params.description?.trim()) {
      throw new PaymentGatewayError(
        "description 是必填參數",
        "VALIDATION_ERROR",
      );
    }

    if (!PaymentGatewayClient.isValidEmail(params.email)) {
      throw new PaymentGatewayError("email 格式無效", "VALIDATION_ERROR");
    }

    // 驗證定期定額參數
    if (params.periodParams) {
      this.validatePeriodParams(params.periodParams);
    }
  }

  /**
   * 驗證定期定額參數
   */
  private validatePeriodParams(params: PeriodPaymentParams): void {
    const validPeriodTypes = ["D", "W", "M", "Y"];
    if (!validPeriodTypes.includes(params.periodType)) {
      throw new PaymentGatewayError(
        "periodType 必須是 D（天）、W（週）、M（月）或 Y（年）",
        "VALIDATION_ERROR",
      );
    }

    // 驗證週期點（若有提供）
    if (params.periodPoint?.trim()) {
      switch (params.periodType) {
        case "D":
        case "W": {
          const weekday = parseInt(params.periodPoint, 10);
          if (isNaN(weekday) || weekday < 1 || weekday > 7) {
            throw new PaymentGatewayError(
              "W（週）或 D（天）週期的 periodPoint 必須是 1~7（1=週一）",
              "VALIDATION_ERROR",
            );
          }
          break;
        }
        case "M": {
          const day = parseInt(params.periodPoint, 10);
          if (isNaN(day) || day < 1 || day > 31) {
            throw new PaymentGatewayError(
              "M（月）週期的 periodPoint 必須是 01~31",
              "VALIDATION_ERROR",
            );
          }
          break;
        }
        case "Y": {
          if (!/^\d{4}$/.test(params.periodPoint)) {
            throw new PaymentGatewayError(
              "Y（年）週期的 periodPoint 必須是 MMDD 格式（如 0115 表示 1 月 15 日）",
              "VALIDATION_ERROR",
            );
          }
          const month = parseInt(params.periodPoint.substring(0, 2), 10);
          const day = parseInt(params.periodPoint.substring(2, 4), 10);
          if (month < 1 || month > 12 || day < 1 || day > 31) {
            throw new PaymentGatewayError(
              "Y（年）週期的 periodPoint MMDD 格式無效",
              "VALIDATION_ERROR",
            );
          }
          break;
        }
      }
    } else if (!params.periodFirstdate?.trim()) {
      // 若無 periodPoint 也無 periodFirstdate，報錯（除非後端會自動補，但前端最好報錯）
      // 不過為了向下相容，這裡暫不強求，交由後端處理
    }

    if (!Number.isInteger(params.periodTimes) || params.periodTimes < 1) {
      throw new PaymentGatewayError(
        "periodTimes 必須是正整數",
        "VALIDATION_ERROR",
      );
    }

    if (
      params.periodStartType !== undefined &&
      ![1, 2, 3].includes(params.periodStartType)
    ) {
      throw new PaymentGatewayError(
        "periodStartType 必須是 1、2 或 3",
        "VALIDATION_ERROR",
      );
    }
  }

  /**
   * 封裝 fetch，加入通用 headers
   */
  private async fetch(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.config.apiKey,
          "X-Site-Code": this.config.siteCode,
          ...options.headers,
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 時間安全的字串比較（防止 timing attack）
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}

// ========================================
// 便利函數
// ========================================

/**
 * 建立 SDK 實例的工廠函數
 *
 * @example
 * ```typescript
 * // 從環境變數建立 SDK
 * const client = createPaymentGatewayClient({
 *   apiKey: process.env.PAYMENT_API_KEY!,
 *   siteCode: process.env.PAYMENT_SITE_CODE!,
 *   webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET,
 *   environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
 * });
 * ```
 */
export function createPaymentGatewayClient(
  config: PaymentGatewayConfig,
): PaymentGatewayClient {
  return new PaymentGatewayClient(config);
}

/**
 * 提交金流表單（瀏覽器端使用）
 *
 * 此函數會在瀏覽器中動態建立表單並提交，將用戶導向 PAYUNi 付款頁面。
 *
 * @param formData 從 createPayment 返回的 paymentForm 資料
 * @throws 如果 formData 無效或不在瀏覽器環境中
 *
 * @example
 * ```typescript
 * const result = await client.createPayment({
 *   orderId: 'order-123',
 *   amount: 1990,
 *   description: '專業版訂閱',
 *   email: 'user@example.com',
 * });
 *
 * if (result.paymentForm) {
 *   submitPaymentForm(result.paymentForm);
 *   // 用戶會被導向 PAYUNi 付款頁面
 * }
 * ```
 */
export function submitPaymentForm(
  formData: PaymentResult["paymentForm"],
): void {
  if (!formData) {
    throw new PaymentGatewayError("表單資料無效", "INVALID_FORM_DATA");
  }

  if (typeof document === "undefined") {
    throw new PaymentGatewayError(
      "此函數只能在瀏覽器環境中使用",
      "BROWSER_ONLY",
    );
  }

  const form = document.createElement("form");
  form.method = formData.method;
  form.action = formData.action;
  form.style.display = "none";

  for (const [key, value] of Object.entries(formData.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}

/**
 * 提交金流表單（舊版名稱，向下相容）
 * @deprecated 請使用 submitPaymentForm
 */
export const submitNewebpayForm = submitPaymentForm;

/**
 * 取得 PAYUNi 測試卡號
 *
 * @returns 測試卡號資訊（請登入 PAYUNi 後台取得最新測試卡號）
 */
export function getTestCardNumbers(): {
  success: { cardNumber: string; description: string };
  failure: { cardNumber: string; description: string };
} {
  return {
    success: {
      cardNumber: "4000-2211-1111-1111",
      description: "PAYUNi 測試卡號，請登入 PAYUNi 後台查看最新測試資訊",
    },
    failure: {
      cardNumber: "4000-2211-1111-1112",
      description: "PAYUNi 測試失敗卡號，請登入 PAYUNi 後台查看最新測試資訊",
    },
  };
}
