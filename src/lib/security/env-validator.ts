/**
 * 環境變數驗證工具
 * 在應用啟動時驗證所有必要的環境變數
 */

interface EnvVar {
  name: string;
  required: boolean;
  validator?: (value: string) => boolean;
  description: string;
}

/**
 * 環境變數定義
 */
const ENV_VARS: EnvVar[] = [
  {
    name: "NODE_ENV",
    required: true,
    validator: (value) => ["development", "production", "test"].includes(value),
    description: "運行環境 (development, production, test)",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    validator: (value) => value.startsWith("https://"),
    description: "Supabase 專案 URL",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    validator: (value) => value.length > 100,
    description: "Supabase 匿名金鑰",
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    validator: (value) => value.length > 100,
    description: "Supabase Service Role 金鑰",
  },
  {
    name: "OPENAI_API_KEY",
    required: true,
    validator: (value) => value.startsWith("sk-"),
    description: "OpenAI API 金鑰",
  },
  {
    name: "NEXT_PUBLIC_APP_URL",
    required: true,
    validator: (value) => value.startsWith("http"),
    description: "應用程式 URL",
  },
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 驗證所有環境變數
 *
 * @param throwOnError - 驗證失敗時是否拋出錯誤 (預設 true)
 * @returns 驗證結果
 */
export function validateEnv(throwOnError: boolean = true): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];

    if (!value) {
      if (envVar.required) {
        errors.push(
          `❌ 缺少必要環境變數: ${envVar.name} - ${envVar.description}`,
        );
      } else {
        warnings.push(
          `⚠️  缺少可選環境變數: ${envVar.name} - ${envVar.description}`,
        );
      }
      continue;
    }

    if (envVar.validator && !envVar.validator(value)) {
      errors.push(
        `❌ 環境變數格式錯誤: ${envVar.name} - ${envVar.description}`,
      );
    }
  }

  checkDevelopmentMode(warnings);

  const valid = errors.length === 0;

  if (!valid && throwOnError) {
    console.error("\n=== 環境變數驗證失敗 ===\n");
    errors.forEach((err) => console.error(err));
    console.error("\n請檢查 .env.local 檔案並設定所有必要的環境變數\n");
    throw new Error("環境變數驗證失敗");
  }

  return { valid, errors, warnings };
}

/**
 * 檢查開發模式的安全警告
 */
function checkDevelopmentMode(warnings: string[]): void {
  if (process.env.NODE_ENV === "development") {
    if (process.env.NEXT_PUBLIC_APP_URL === "http://localhost:3000") {
      warnings.push("⚠️  開發模式: 使用 localhost URL");
    }

    warnings.push("⚠️  開發模式: 請勿在生產環境使用開發金鑰");
  }

  if (process.env.NODE_ENV === "production") {
    if (process.env.NEXT_PUBLIC_APP_URL?.includes("localhost")) {
      warnings.push("❗ 警告: 生產環境使用 localhost URL");
    }
  }
}

/**
 * 取得環境變數 (帶類型檢查)
 *
 * @param name - 環境變數名稱
 * @param defaultValue - 預設值
 * @returns 環境變數值
 */
export function getEnv(name: string, defaultValue?: string): string {
  const value = process.env[name];

  if (!value && !defaultValue) {
    throw new Error(`缺少環境變數: ${name}`);
  }

  return value || defaultValue || "";
}

/**
 * 取得必要環境變數 (不存在時拋出錯誤)
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`缺少必要環境變數: ${name}`);
  }

  return value;
}

/**
 * 檢查環境是否為生產環境
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * 檢查環境是否為開發環境
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * 取得安全的環境變數資訊 (用於日誌)
 * 會遮蔽敏感資訊
 */
export function getSafeEnvInfo(): Record<string, string> {
  const info: Record<string, string> = {};

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];

    if (!value) {
      info[envVar.name] = "[NOT SET]";
      continue;
    }

    if (
      envVar.name.includes("KEY") ||
      envVar.name.includes("SECRET") ||
      envVar.name.includes("TOKEN")
    ) {
      info[envVar.name] = "[REDACTED]";
    } else {
      info[envVar.name] = value;
    }
  }

  return info;
}

/**
 * 在應用啟動時驗證環境變數
 * 這個函式應該在應用的入口點呼叫
 */
export function initEnvValidation(): void {
  console.log("🔍 驗證環境變數...");

  const result = validateEnv(true);

  if (result.warnings.length > 0) {
    console.warn("\n⚠️  環境變數警告:");
    result.warnings.forEach((warning) => console.warn(warning));
  }

  console.log("✅ 環境變數驗證通過\n");
}
