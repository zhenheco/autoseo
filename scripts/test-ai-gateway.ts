/**
 * AI Gateway 整合測試
 * 測試所有 AI API 是否正確透過 Cloudflare Gateway
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

import {
  isGatewayEnabled,
  getOpenAIBaseUrl,
  getGeminiBaseUrl,
  getDeepSeekBaseUrl,
  getPerplexityBaseUrl,
  buildOpenAIHeaders,
  buildGeminiHeaders,
  buildDeepSeekHeaders,
  buildPerplexityHeaders,
} from "../src/lib/cloudflare/ai-gateway";

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  responseTime?: number;
}

async function testOpenAI(): Promise<TestResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { name: "OpenAI", success: false, message: "API key not set" };
  }

  const baseUrl = getOpenAIBaseUrl();
  const headers = buildOpenAIHeaders(apiKey);
  const start = Date.now();

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Say hello" }],
        max_tokens: 10,
      }),
    });

    const responseTime = Date.now() - start;

    if (!response.ok) {
      const error = await response.text();
      return {
        name: "OpenAI",
        success: false,
        message: `Error: ${response.status} - ${error}`,
        responseTime,
      };
    }

    const data = await response.json();
    return {
      name: "OpenAI",
      success: true,
      message: `OK - ${data.model}`,
      responseTime,
    };
  } catch (error: unknown) {
    return {
      name: "OpenAI",
      success: false,
      message: `Exception: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function testDeepSeek(): Promise<TestResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return { name: "DeepSeek", success: false, message: "API key not set" };
  }

  const baseUrl = getDeepSeekBaseUrl();
  const headers = buildDeepSeekHeaders(apiKey);
  const start = Date.now();

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: "Say hello" }],
        max_tokens: 10,
      }),
    });

    const responseTime = Date.now() - start;

    if (!response.ok) {
      const error = await response.text();
      return {
        name: "DeepSeek",
        success: false,
        message: `Error: ${response.status} - ${error}`,
        responseTime,
      };
    }

    const data = await response.json();
    return {
      name: "DeepSeek",
      success: true,
      message: `OK - ${data.model}`,
      responseTime,
    };
  } catch (error: unknown) {
    return {
      name: "DeepSeek",
      success: false,
      message: `Exception: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function testPerplexity(): Promise<TestResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return { name: "Perplexity", success: false, message: "API key not set" };
  }

  const baseUrl = getPerplexityBaseUrl();
  const headers = buildPerplexityHeaders(apiKey);
  const start = Date.now();

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: "What is 2+2?" }],
        max_tokens: 10,
      }),
    });

    const responseTime = Date.now() - start;

    if (!response.ok) {
      const error = await response.text();
      return {
        name: "Perplexity",
        success: false,
        message: `Error: ${response.status} - ${error}`,
        responseTime,
      };
    }

    const data = await response.json();
    return {
      name: "Perplexity",
      success: true,
      message: `OK - ${data.model}`,
      responseTime,
    };
  } catch (error: unknown) {
    return {
      name: "Perplexity",
      success: false,
      message: `Exception: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function testGemini(): Promise<TestResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { name: "Gemini", success: false, message: "API key not set" };
  }

  const baseUrl = getGeminiBaseUrl();
  const headers = buildGeminiHeaders(apiKey);
  const start = Date.now();

  try {
    const url = isGatewayEnabled()
      ? `${baseUrl}/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
      : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Say hello" }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });

    const responseTime = Date.now() - start;

    if (!response.ok) {
      const error = await response.text();
      return {
        name: "Gemini",
        success: false,
        message: `Error: ${response.status} - ${error}`,
        responseTime,
      };
    }

    const data = await response.json();
    return {
      name: "Gemini",
      success: true,
      message: `OK - gemini-2.0-flash`,
      responseTime,
    };
  } catch (error: unknown) {
    return {
      name: "Gemini",
      success: false,
      message: `Exception: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("AI Gateway 整合測試");
  console.log("=".repeat(60));
  console.log(`Gateway 啟用: ${isGatewayEnabled()}`);
  console.log("");
  console.log("測試各 API 端點:");
  console.log(`  OpenAI:     ${getOpenAIBaseUrl()}`);
  console.log(`  DeepSeek:   ${getDeepSeekBaseUrl()}`);
  console.log(`  Perplexity: ${getPerplexityBaseUrl()}`);
  console.log(`  Gemini:     ${getGeminiBaseUrl()}`);
  console.log("=".repeat(60));
  console.log("");

  const results: TestResult[] = [];

  console.log("測試中...\n");

  results.push(await testOpenAI());
  console.log(
    `[1/4] OpenAI: ${results[results.length - 1].success ? "✅" : "❌"} ${results[results.length - 1].message}`,
  );

  results.push(await testDeepSeek());
  console.log(
    `[2/4] DeepSeek: ${results[results.length - 1].success ? "✅" : "❌"} ${results[results.length - 1].message}`,
  );

  results.push(await testPerplexity());
  console.log(
    `[3/4] Perplexity: ${results[results.length - 1].success ? "✅" : "❌"} ${results[results.length - 1].message}`,
  );

  results.push(await testGemini());
  console.log(
    `[4/4] Gemini: ${results[results.length - 1].success ? "✅" : "❌"} ${results[results.length - 1].message}`,
  );

  console.log("\n" + "=".repeat(60));
  console.log("測試結果總結:");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`通過: ${passed}/${results.length}`);
  console.log(`失敗: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log("\n失敗的測試:");
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.message}`);
      });
  }

  console.log("");
}

main().catch(console.error);
