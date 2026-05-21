import { afterEach, describe, expect, it, vi } from "vitest";
import { getDeepSeekBaseUrl, isGatewayEnabled } from "@shared/ai-gateway";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Cloudflare AI Gateway env mapping", () => {
  it("accepts the 1wayseo CF_AI_GATEWAY_ACCOUNT_ID variable", () => {
    vi.stubEnv("CF_AI_GATEWAY_ENABLED", "true");
    vi.stubEnv("CF_AI_GATEWAY_ACCOUNT_ID", "account-a");
    vi.stubEnv("CF_AI_GATEWAY_ID", "gateway-a");

    expect(isGatewayEnabled()).toBe(true);
    expect(getDeepSeekBaseUrl()).toBe(
      "https://gateway.ai.cloudflare.com/v1/account-a/gateway-a/deepseek",
    );
  });

  it("accepts the edgeseo CF_AI_ACCOUNT_ID alias", () => {
    vi.stubEnv("CF_AI_GATEWAY_ENABLED", "true");
    vi.stubEnv("CF_AI_ACCOUNT_ID", "account-b");
    vi.stubEnv("CF_AI_GATEWAY_ID", "gateway-b");

    expect(isGatewayEnabled()).toBe(true);
    expect(getDeepSeekBaseUrl()).toBe(
      "https://gateway.ai.cloudflare.com/v1/account-b/gateway-b/deepseek",
    );
  });
});
