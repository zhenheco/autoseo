/**
 * 統一結構化日誌模組
 *
 * 基於現有的 SecureLogger (log-sanitizer.ts) 建立，不引入新依賴。
 * 提供 createLogger(module) 工廠函數，每筆日誌自動附帶：
 *   - timestamp (ISO 8601)
 *   - module (呼叫模組名稱)
 *   - level (info / warn / error / debug)
 * 自動過濾敏感資訊（重用 log-sanitizer.ts 的邏輯）。
 * Development 用 pretty format，Production 用 JSON。
 */

import { sanitizeLog, sanitizeObject } from "@/lib/security/log-sanitizer";

// ============================================================================
// 類型定義
// ============================================================================

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly module: string;
  readonly message: string;
  readonly data?: unknown;
}

export interface Logger {
  readonly debug: (message: string, data?: Record<string, unknown>) => void;
  readonly info: (message: string, data?: Record<string, unknown>) => void;
  readonly warn: (message: string, data?: Record<string, unknown>) => void;
  readonly error: (message: string, data?: Record<string, unknown>) => void;
}

// ============================================================================
// 環境偵測
// ============================================================================

const isProduction = process.env.NODE_ENV === "production";

// ============================================================================
// 格式化函數
// ============================================================================

/**
 * Production 模式：輸出 JSON 格式（便於日誌聚合工具解析）
 */
function formatJson(entry: LogEntry): string {
  return JSON.stringify(entry);
}

/**
 * Development 模式：輸出人類可讀格式
 */
function formatPretty(entry: LogEntry): string {
  const time = entry.timestamp.slice(11, 23); // HH:mm:ss.SSS
  const levelTag = entry.level.toUpperCase().padEnd(5);
  const prefix = `${time} ${levelTag} [${entry.module}]`;

  if (entry.data !== undefined) {
    return `${prefix} ${entry.message} ${JSON.stringify(entry.data, null, 2)}`;
  }
  return `${prefix} ${entry.message}`;
}

const format = isProduction ? formatJson : formatPretty;

// ============================================================================
// 日誌輸出
// ============================================================================

const CONSOLE_METHODS: Record<LogLevel, (...args: unknown[]) => void> = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

function emit(entry: LogEntry): void {
  const output = format(entry);
  CONSOLE_METHODS[entry.level](output);
}

// ============================================================================
// 工廠函數
// ============================================================================

/**
 * 建立具有模組名稱標記的 Logger 實例
 *
 * @param module - 模組名稱，例如 'payment-webhook', 'oauth-callback'
 * @returns Logger 實例，所有方法都會自動附帶 timestamp, module, level
 *
 * @example
 * ```typescript
 * import { createLogger } from '@/lib/logger'
 * const logger = createLogger('payment-webhook')
 * logger.info('Payment received', { orderId, amount })
 * logger.error('Payment failed', { orderId, error: err.message })
 * ```
 */
export function createLogger(module: string): Logger {
  const log = (level: LogLevel, message: string, data?: Record<string, unknown>): void => {
    const sanitizedMessage = sanitizeLog(message);
    const sanitizedData = data !== undefined
      ? sanitizeObject(data) as Record<string, unknown>
      : undefined;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message: sanitizedMessage,
      ...(sanitizedData !== undefined ? { data: sanitizedData } : {}),
    };

    emit(entry);
  };

  return {
    debug: (message, data) => log("debug", message, data),
    info: (message, data) => log("info", message, data),
    warn: (message, data) => log("warn", message, data),
    error: (message, data) => log("error", message, data),
  };
}
