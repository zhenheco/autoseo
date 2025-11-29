type GatewayProvider =
  | "openai"
  | "google-ai-studio"
  | "anthropic"
  | "groq"
  | "mistral"
  | "cohere"
  | "deepseek"
  | "perplexity-ai";

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
    const gatewayHeaders = getGatewayHeaders();
    Object.assign(headers, gatewayHeaders);
  }

  return headers;
}

export function buildOpenAIHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (isGatewayEnabled()) {
    const gatewayHeaders = getGatewayHeaders();
    Object.assign(headers, gatewayHeaders);
  }

  return headers;
}
