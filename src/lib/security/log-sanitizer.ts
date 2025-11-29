/**
 * 日誌安全過濾器
 * 防止敏感資訊(API 金鑰、密碼、Token)洩漏到日誌中
 */

type ReplacerFn = (match: string, ...args: string[]) => string;

interface SensitivePattern {
  pattern: RegExp;
  replacement: string | ReplacerFn;
}

/**
 * 敏感資訊模式定義
 */
const SENSITIVE_PATTERNS: SensitivePattern[] = [
  // API Keys
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: "[REDACTED_API_KEY]" },
  { pattern: /sk-proj-[a-zA-Z0-9_-]{20,}/g, replacement: "[REDACTED_API_KEY]" },

  // Bearer Tokens
  {
    pattern: /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,
    replacement: "Bearer [REDACTED_TOKEN]",
  },

  // JWT Tokens
  {
    pattern: /eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    replacement: "[REDACTED_JWT]",
  },

  // Passwords
  {
    pattern: /password["\s:=]+["']?[^"'\s]+["']?/gi,
    replacement: "password=[REDACTED]",
  },
  { pattern: /pwd["\s:=]+["']?[^"'\s]+["']?/gi, replacement: "pwd=[REDACTED]" },

  // API Keys (generic)
  {
    pattern: /api[_-]?key["\s:=]+["']?[^"'\s]{20,}["']?/gi,
    replacement: "api_key=[REDACTED]",
  },

  // Secrets
  {
    pattern: /secret["\s:=]+["']?[^"'\s]{20,}["']?/gi,
    replacement: "secret=[REDACTED]",
  },

  // Tokens (generic)
  {
    pattern: /token["\s:=]+["']?[^"'\s]{20,}["']?/gi,
    replacement: "token=[REDACTED]",
  },

  // Email addresses (部分遮蔽)
  {
    pattern: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    replacement: (_match: string, user: string, domain: string) => {
      const maskedUser = user.length > 3 ? user.substring(0, 3) + "***" : "***";
      return `${maskedUser}@${domain}`;
    },
  },
];

/**
 * 清理單一日誌訊息
 */
export function sanitizeLog(message: string): string {
  if (typeof message !== "string") {
    return String(message);
  }

  let sanitized = message;

  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    if (typeof replacement === "function") {
      sanitized = sanitized.replace(pattern, replacement);
    } else {
      sanitized = sanitized.replace(pattern, replacement);
    }
  }

  return sanitized;
}

/**
 * 清理物件中的敏感資訊
 */
export function sanitizeObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    return sanitizeLog(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // 檢查 key 名稱是否包含敏感欄位
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        (lowerKey.includes("key") &&
          (lowerKey.includes("api") || lowerKey.includes("auth")))
      ) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * 建立安全的 logger
 */
export function createSecureLogger() {
  return {
    log: (message: string, ...args: unknown[]) => {
      console.log(sanitizeLog(message), ...args.map(sanitizeObject));
    },

    info: (message: string, ...args: unknown[]) => {
      console.info(sanitizeLog(message), ...args.map(sanitizeObject));
    },

    warn: (message: string, ...args: unknown[]) => {
      console.warn(sanitizeLog(message), ...args.map(sanitizeObject));
    },

    error: (message: string, ...args: unknown[]) => {
      console.error(sanitizeLog(message), ...args.map(sanitizeObject));
    },

    debug: (message: string, ...args: unknown[]) => {
      console.debug(sanitizeLog(message), ...args.map(sanitizeObject));
    },
  };
}

/**
 * 全域安全 logger 實例
 */
export const logger = createSecureLogger();
