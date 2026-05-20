import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: () => <div data-testid="turnstile-widget" />,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => {
    const messages: Record<string, string> = {
      title: "免費 SEO 健檢",
      subtitle: "輸入網址，30 秒看您網站的 SEO 健康度",
      urlLabel: "您的網站網址",
      urlPlaceholder: "https://your-shop.com",
      submitButton: "開始免費掃描",
      scanning: "掃描中…",
      "scanningSteps.fetching": "正在抓取網頁",
      "scanningSteps.analyzing": "分析中",
      "scanningSteps.scoring": "計算健康度",
      "result.scoreTitle": "您的 SEO 健康度",
      "result.topIssuesTitle": "前 5 大改善建議",
      "result.totalIssues": "共偵測到 {count} 個問題",
      "result.ctaTitle": "想看完整報告 + 自動修補？",
      "result.ctaSubtitle": "綁定 1waySEO 後，我們會自動修補商品 SEO",
      "result.ctaButton": "了解 1waySEO →",
      "errors.turnstileInvalid": "驗證失敗，請重試",
      "errors.rateLimited": "今日掃描已達上限，請明日再試",
      "errors.fetchFailed": "無法存取此網站",
      "errors.invalidUrl": "請輸入有效網址",
    };
    return (key: string, values?: Record<string, unknown>) => {
      let message = messages[key] ?? key;
      for (const [name, value] of Object.entries(values ?? {})) {
        message = message.replace(`{${name}}`, String(value));
      }
      return message;
    };
  }),
}));

import PublicAuditPage from "../page";

describe("public audit page", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "test-site-key");
  });

  it("renders the public audit form", async () => {
    render(await PublicAuditPage());

    expect(
      screen.getByRole("heading", { name: "免費 SEO 健檢" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "您的網站網址" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "開始免費掃描" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("turnstile-widget")).toBeInTheDocument();
  });
});
