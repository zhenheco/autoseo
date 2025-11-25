/**
 * API Endpoints 配置
 * 統一管理所有第三方 API URLs，避免硬編碼
 */

/**
 * OpenAI API 配置
 */
export const OPENAI_CONFIG = {
  baseURL: process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1",
  apiKey: process.env.OPENAI_API_KEY || "",
} as const;

/**
 * DeepSeek API 配置
 */
export const DEEPSEEK_CONFIG = {
  baseURL: process.env.DEEPSEEK_API_BASE_URL || "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY || "",
} as const;

/**
 * OpenRouter API 配置
 */
export const OPENROUTER_CONFIG = {
  baseURL:
    process.env.OPENROUTER_API_BASE_URL || "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
  modelsEndpoint: "/models",
  chatEndpoint: "/chat/completions",
} as const;

/**
 * Perplexity API 配置
 */
export const PERPLEXITY_CONFIG = {
  baseURL: process.env.PERPLEXITY_API_BASE_URL || "https://api.perplexity.ai",
  apiKey: process.env.PERPLEXITY_API_KEY || "",
  chatEndpoint: "/chat/completions",
} as const;

/**
 * NewebPay 金流 API 配置
 */
export const NEWEBPAY_CONFIG = {
  apiUrl:
    process.env.NEWEBPAY_API_URL ||
    "https://ccore.newebpay.com/MPG/mpg_gateway",
  periodApiUrl:
    process.env.NEWEBPAY_PERIOD_API_URL ||
    "https://ccore.newebpay.com/MPG/period",
  merchantId: process.env.NEWEBPAY_MERCHANT_ID || "",
  hashKey: process.env.NEWEBPAY_HASH_KEY || "",
  hashIV: process.env.NEWEBPAY_HASH_IV || "",
} as const;

/**
 * Google OAuth 配置
 */
export const GOOGLE_OAUTH_CONFIG = {
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scopes: {
    driveFile: "https://www.googleapis.com/auth/drive.file",
    driveReadonly: "https://www.googleapis.com/auth/drive.readonly",
  },
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
} as const;

/**
 * Google Drive 配置
 */
export const GOOGLE_DRIVE_CONFIG = {
  baseUrl: "https://www.googleapis.com/drive/v3",
  uploadUrl: "https://www.googleapis.com/upload/drive/v3",
  publicUrlTemplate: (fileId: string) =>
    `https://drive.google.com/uc?export=view&id=${fileId}`,
  downloadUrlTemplate: (fileId: string) =>
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download`,
} as const;

/**
 * Schema.org 配置
 */
export const SCHEMA_ORG_CONFIG = {
  context: "https://schema.org",
} as const;

/**
 * 應用程式 URL 配置
 */
export const APP_CONFIG = {
  url: process.env.NEXT_PUBLIC_APP_URL || "https://seo.zhenhe-dm.com",
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://seo.zhenhe-dm.com",
} as const;

/**
 * 文檔和官方網站 URLs (通常是固定的，但仍從環境變數讀取以支援鏡像)
 */
export const DOCS_CONFIG = {
  anthropic: {
    modelsOverview:
      process.env.ANTHROPIC_DOCS_URL ||
      "https://docs.anthropic.com/claude/docs/models-overview",
    pricing: "https://claude.com/pricing",
  },
  google: {
    geminiPricing: "https://ai.google.dev/gemini-api/docs/pricing",
  },
  deepseek: {
    pricing: "https://api-docs.deepseek.com/quick_start/pricing",
    docs: "https://api-docs.deepseek.com/",
  },
} as const;

/**
 * 第三方服務白名單 URLs (用於圖片來源驗證等)
 */
export const TRUSTED_SOURCES = {
  images: [
    "https://drive.google.com",
    "https://lh3.googleusercontent.com",
    "https://lh4.googleusercontent.com",
    "https://lh5.googleusercontent.com",
    "https://lh6.googleusercontent.com",
  ],
  apis: ["https://*.supabase.co", "https://api.openai.com"],
} as const;

/**
 * 取得 API endpoint 的輔助函數
 */
export function getApiEndpoint(service: string, path: string = ""): string {
  const configs: Record<string, { baseURL: string }> = {
    openai: OPENAI_CONFIG,
    deepseek: DEEPSEEK_CONFIG,
    openrouter: OPENROUTER_CONFIG,
    perplexity: PERPLEXITY_CONFIG,
  };

  const config = configs[service.toLowerCase()];
  if (!config) {
    throw new Error(`Unknown API service: ${service}`);
  }

  const baseUrl = config.baseURL.replace(/\/$/, "");
  const endpoint = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${endpoint}`;
}

/**
 * 驗證環境變數是否已設定
 */
export function validateApiConfig(
  service: "openai" | "deepseek" | "openrouter" | "perplexity",
): boolean {
  const configs = {
    openai: () => !!OPENAI_CONFIG.apiKey,
    deepseek: () => !!DEEPSEEK_CONFIG.apiKey,
    openrouter: () => !!OPENROUTER_CONFIG.apiKey,
    perplexity: () => !!PERPLEXITY_CONFIG.apiKey,
  };

  return configs[service]();
}
