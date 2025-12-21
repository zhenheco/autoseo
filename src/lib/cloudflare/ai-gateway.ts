type GatewayProvider =
  | "openai"
  | "google-ai-studio"
  | "anthropic"
  | "groq"
  | "mistral"
  | "cohere"
  | "deepseek"
  | "perplexity-ai"
  | "openrouter"
  | "fal";

interface GatewayConfig {
  accountId: string;
  gatewayId: string;
  token: string;
  enabled: boolean;
}

function getGatewayConfig(): GatewayConfig {
  return {
    accountId: process.env.CF_AI_GATEWAY_ACCOUNT_ID || "",
    gatewayId: process.env.CF_AI_GATEWAY_ID || "",
    token: process.env.CF_AI_GATEWAY_TOKEN || "",
    enabled: process.env.CF_AI_GATEWAY_ENABLED === "true",
  };
}

export function isGatewayEnabled(): boolean {
  const config = getGatewayConfig();
  return config.enabled && !!config.accountId && !!config.gatewayId;
}

export function getGatewayBaseUrl(provider: GatewayProvider): string {
  const config = getGatewayConfig();
  return `https://gateway.ai.cloudflare.com/v1/${config.accountId}/${config.gatewayId}/${provider}`;
}

export function getGatewayToken(): string {
  return getGatewayConfig().token;
}

export function getGatewayHeaders(): Record<string, string> {
  const token = getGatewayToken();
  if (!token) return {};
  return {
    "cf-aig-authorization": `Bearer ${token}`,
  };
}

export function getOpenAIBaseUrl(): string {
  if (isGatewayEnabled()) {
    return getGatewayBaseUrl("openai");
  }
  return process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1";
}

export function getGeminiBaseUrl(): string {
  if (isGatewayEnabled()) {
    return getGatewayBaseUrl("google-ai-studio");
  }
  return "https://generativelanguage.googleapis.com";
}

export function getAnthropicBaseUrl(): string {
  if (isGatewayEnabled()) {
    return getGatewayBaseUrl("anthropic");
  }
  return "https://api.anthropic.com";
}

export function getDeepSeekBaseUrl(): string {
  if (isGatewayEnabled()) {
    return getGatewayBaseUrl("deepseek");
  }
  return process.env.DEEPSEEK_API_BASE_URL || "https://api.deepseek.com";
}

export function getPerplexityBaseUrl(): string {
  if (isGatewayEnabled()) {
    return getGatewayBaseUrl("perplexity-ai");
  }
  return process.env.PERPLEXITY_API_BASE_URL || "https://api.perplexity.ai";
}

export function getOpenRouterBaseUrl(): string {
  if (isGatewayEnabled()) {
    return getGatewayBaseUrl("openrouter");
  }
  return "https://openrouter.ai/api/v1";
}

export function buildOpenRouterHeaders(
  apiKey?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Gateway BYOK 模式：只需要 cf-aig-authorization，Gateway 會使用存儲的 API Key
  // 非 Gateway 模式：需要 Authorization header
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  if (isGatewayEnabled()) {
    Object.assign(headers, getGatewayHeaders());
  }

  return headers;
}

export function buildDeepSeekHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (isGatewayEnabled()) {
    Object.assign(headers, getGatewayHeaders());
  }

  return headers;
}

export function buildPerplexityHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (isGatewayEnabled()) {
    Object.assign(headers, getGatewayHeaders());
  }

  return headers;
}

export function buildGeminiApiUrl(model: string, action: string): string {
  const baseUrl = getGeminiBaseUrl();
  if (isGatewayEnabled()) {
    return `${baseUrl}/v1beta/models/${model}:${action}`;
  }
  return `${baseUrl}/v1beta/models/${model}:${action}`;
}

export function buildGeminiHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,
  };

  if (isGatewayEnabled()) {
    Object.assign(headers, getGatewayHeaders());
  }

  return headers;
}

export function buildOpenAIHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (isGatewayEnabled()) {
    Object.assign(headers, getGatewayHeaders());
  }

  return headers;
}

/**
 * 取得 fal.ai Gateway Base URL
 * 格式：https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/fal
 */
export function getFalBaseUrl(): string {
  if (isGatewayEnabled()) {
    return getGatewayBaseUrl("fal");
  }
  return "https://fal.run";
}

/**
 * 建構 fal.ai API 的完整 URL
 * Gateway 模式：.../fal/{model}
 * 直連模式：https://fal.run/{model}
 */
export function buildFalApiUrl(model: string): string {
  const baseUrl = getFalBaseUrl();
  return `${baseUrl}/${model}`;
}

/**
 * 建構 fal.ai Headers（BYOK 模式只需 Gateway token）
 */
export function buildFalHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (isGatewayEnabled()) {
    Object.assign(headers, getGatewayHeaders());
  }

  return headers;
}
