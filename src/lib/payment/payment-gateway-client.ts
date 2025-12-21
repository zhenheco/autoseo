/**
 * 金流微服務 SDK
 *
 * 提供客戶端網站與金流微服務互動的介面。
 * 支援 sandbox（測試）和 production（正式）兩種環境。
 * 支援單次付款和定期定額付款。
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
 * // 提交表單到藍新金流
 * submitNewebpayForm(result.newebpayForm);
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
 *     periodTimes: 12,      // 共 12 期
 *     periodStartType: 2,   // 立即授權
 *   },
 * });
 *
 * // 提交表單到藍新金流
 * submitNewebpayForm(result.newebpayForm);
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
 * ## 藍新測試卡號
 *
 * | 卡號 | 結果 |
 * |------|------|
 * | 4000-2211-1111-1111 | 成功 |
 * | 4000-2211-1111-1112 | 失敗 |
 *
 * 有效期：任意未過期日期，CVV：任意 3 碼
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
 * 定期定額參數
 */
export interface PeriodPaymentParams {
  /**
   * 週期類型
   * - D: 固定天期（periodPoint 為 2~999）
   * - W: 每週（periodPoint 為 1~7，1=週一）
   * - M: 每月（periodPoint 為 01~31）
   * - Y: 每年（periodPoint 為 MMDD，如 0115）
   */
  periodType: PeriodType;
  /** 週期點（格式依 periodType 而定） */
  periodPoint: string;
  /** 授權期數（共幾期） */
  periodTimes: number;
  /**
   * 交易模式
   * - 1: 立即執行十元授權（驗證卡片有效性）
   * - 2: 立即執行委託金額授權（直接扣款）
   * - 3: 不檢查信用卡資訊，不授權
   */
  periodStartType?: 1 | 2 | 3;
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
  metadata?: Record<string, string>;
  /** 定期定額參數（提供此參數則為定期定額付款） */
  periodParams?: PeriodPaymentParams;
}

/**
 * 付款結果
 */
export interface PaymentResult {
  /** 是否成功 */
  success: boolean;
  /** 付款 ID */
  paymentId: string;
  /** 藍新金流表單資料（用於前端提交） */
  newebpayForm?: {
    /** 表單提交網址 */
    action: string;
    /** HTTP 方法 */
    method: "POST";
    /**
     * 表單欄位
     *
     * MPG API（單次付款）: MerchantID, TradeInfo, TradeSha, Version
     * Period API（定期定額）: MerchantID_, PostData_（注意底線）
     */
    fields: Record<string, string>;
  };
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
  /** 付款時間（ISO 8601） */
  paidAt?: string;
  /** 藍新金流交易序號 */
  newebpayTradeNo?: string;
  /** 錯誤訊息 */
  errorMessage?: string;
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
  /** 藍新金流交易序號 */
  newebpayTradeNo?: string;
  /** 額外資料 */
  metadata?: Record<string, string>;
  /** 錯誤訊息（當 status 為 FAILED 時） */
  errorMessage?: string;
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
   * @returns 付款結果（包含藍新表單資料）
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
   * // 前端提交表單到藍新
   * if (result.newebpayForm) {
   *   const form = document.createElement('form');
   *   form.action = result.newebpayForm.action;
   *   form.method = result.newebpayForm.method;
   *   for (const [key, value] of Object.entries(result.newebpayForm.fields)) {
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
    // 允許英文、數字、底線、連字號
    return /^[a-zA-Z0-9_-]+$/.test(orderId);
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
        "orderId 格式無效（只允許英文、數字、底線、連字號，最長 50 字元）",
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

    if (!params.periodPoint?.trim()) {
      throw new PaymentGatewayError(
        "periodPoint 是必填參數",
        "VALIDATION_ERROR",
      );
    }

    // 根據週期類型驗證週期點
    switch (params.periodType) {
      case "D": {
        const days = parseInt(params.periodPoint, 10);
        if (isNaN(days) || days < 2 || days > 999) {
          throw new PaymentGatewayError(
            "D（天）週期的 periodPoint 必須是 2~999",
            "VALIDATION_ERROR",
          );
        }
        break;
      }
      case "W": {
        const weekday = parseInt(params.periodPoint, 10);
        if (isNaN(weekday) || weekday < 1 || weekday > 7) {
          throw new PaymentGatewayError(
            "W（週）週期的 periodPoint 必須是 1~7（1=週一）",
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
 * 提交藍新金流表單（瀏覽器端使用）
 *
 * 此函數會在瀏覽器中動態建立表單並提交，將用戶導向藍新金流付款頁面。
 *
 * @param formData 從 createPayment 返回的 newebpayForm 資料
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
 * if (result.newebpayForm) {
 *   submitNewebpayForm(result.newebpayForm);
 *   // 用戶會被導向藍新金流付款頁面
 * }
 * ```
 */
export function submitNewebpayForm(
  formData: PaymentResult["newebpayForm"],
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
 * 取得藍新金流測試卡號
 *
 * @returns 測試卡號資訊
 */
export function getTestCardNumbers(): {
  success: { cardNumber: string; description: string };
  failure: { cardNumber: string; description: string };
} {
  return {
    success: {
      cardNumber: "4000-2211-1111-1111",
      description: "測試成功卡號，有效期任意未過期日期，CVV 任意 3 碼",
    },
    failure: {
      cardNumber: "4000-2211-1111-1112",
      description: "測試失敗卡號，有效期任意未過期日期，CVV 任意 3 碼",
    },
  };
}
