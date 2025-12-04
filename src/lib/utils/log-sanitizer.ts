/**
 * 日誌脫敏工具
 * 用於過濾敏感資訊，防止在日誌中洩露
 */

// 需要脫敏的敏感欄位名稱
const SENSITIVE_FIELDS = [
  // API Keys
  "apiKey",
  "api_key",
  "apikey",
  "secret",
  "secretKey",
  "secret_key",
  "hash_key",
  "hashKey",
  "hash_iv",
  "hashIv",
  "HASH_KEY",
  "HASH_IV",

  // 認證相關
  "password",
  "token",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "authorization",
  "bearer",
  "jwt",
  "session",
  "sessionId",
  "session_id",

  // 支付相關
  "cardNumber",
  "card_number",
  "cvv",
  "cvc",
  "expiry",
  "merchantId",
  "merchant_id",
  "tradeInfo",
  "trade_info",
  "tradeSha",
  "trade_sha",

  // 個人資訊
  "ssn",
  "socialSecurity",
  "bankAccount",
  "bank_account",
  "accountNumber",
  "account_number",
  "idNumber",
  "id_number",

  // Supabase
  "supabaseKey",
  "supabase_key",
  "serviceRole",
  "service_role",
  "anonKey",
  "anon_key",
];

// 需要脫敏的敏感值模式（正則表達式）
const SENSITIVE_PATTERNS = [
  // JWT tokens
  /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  // API Keys (常見格式)
  /sk-[A-Za-z0-9]{20,}/g,
  /pk-[A-Za-z0-9]{20,}/g,
  // Email (部分遮蔽)
  // /([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g,
];

/**
 * 遮蔽字串值
 * @param value 要遮蔽的值
 * @param visibleChars 保留的可見字元數（前後各半）
 */
function maskString(value: string, visibleChars = 4): string {
  if (value.length <= visibleChars * 2) {
    return "*".repeat(value.length);
  }
  const start = value.substring(0, visibleChars);
  const end = value.substring(value.length - visibleChars);
  const middle = "*".repeat(Math.min(value.length - visibleChars * 2, 8));
  return `${start}${middle}${end}`;
}

/**
 * 檢查欄位名稱是否為敏感欄位
 */
function isSensitiveField(fieldName: string): boolean {
  const lowerField = fieldName.toLowerCase();
  return SENSITIVE_FIELDS.some(
    (sensitive) =>
      lowerField === sensitive.toLowerCase() ||
      lowerField.includes(sensitive.toLowerCase()),
  );
}

/**
 * 遞迴脫敏物件中的敏感資訊
 * @param obj 要脫敏的物件
 * @param depth 當前遞迴深度（防止無限遞迴）
 */
export function sanitizeObject<T>(obj: T, depth = 0): T {
  // 防止無限遞迴
  if (depth > 10) {
    return "[MAX_DEPTH_EXCEEDED]" as T;
  }

  // null 或 undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // 字串：檢查敏感模式
  if (typeof obj === "string") {
    let sanitized: string = obj;
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match) => maskString(match));
    }
    return sanitized as unknown as T;
  }

  // 數字、布林等基本類型
  if (typeof obj !== "object") {
    return obj;
  }

  // 陣列
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1)) as T;
  }

  // 物件
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveField(key)) {
      // 敏感欄位：遮蔽值
      if (typeof value === "string") {
        sanitized[key] = maskString(value);
      } else if (value !== null && value !== undefined) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = value;
      }
    } else {
      // 非敏感欄位：遞迴處理
      sanitized[key] = sanitizeObject(value, depth + 1);
    }
  }
  return sanitized as T;
}

/**
 * 安全的日誌函數 - 自動脫敏敏感資訊
 */
export const safeLog = {
  /**
   * 安全的 console.log
   */
  log: (message: string, data?: unknown) => {
    if (data !== undefined) {
      console.log(message, sanitizeObject(data));
    } else {
      console.log(message);
    }
  },

  /**
   * 安全的 console.error
   */
  error: (message: string, data?: unknown) => {
    if (data !== undefined) {
      console.error(message, sanitizeObject(data));
    } else {
      console.error(message);
    }
  },

  /**
   * 安全的 console.warn
   */
  warn: (message: string, data?: unknown) => {
    if (data !== undefined) {
      console.warn(message, sanitizeObject(data));
    } else {
      console.warn(message);
    }
  },

  /**
   * 安全的 console.info
   */
  info: (message: string, data?: unknown) => {
    if (data !== undefined) {
      console.info(message, sanitizeObject(data));
    } else {
      console.info(message);
    }
  },
};

/**
 * 脫敏支付相關資訊
 * 專門用於支付回調日誌
 */
export function sanitizePaymentInfo(
  info: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized = { ...info };

  // 特別處理的欄位
  const fieldsToMask = [
    "TradeInfo",
    "TradeSha",
    "MerchantID",
    "Card6No",
    "Card4No",
  ];

  for (const field of fieldsToMask) {
    if (sanitized[field] && typeof sanitized[field] === "string") {
      sanitized[field] = maskString(sanitized[field] as string, 4);
    }
  }

  return sanitizeObject(sanitized);
}

export default safeLog;
