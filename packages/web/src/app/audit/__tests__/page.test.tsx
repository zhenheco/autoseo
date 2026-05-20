import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: ({ onSuccess }: { onSuccess: (token: string) => void }) => (
    <button
      data-testid="turnstile-widget"
      type="button"
      onClick={() => onSuccess("turnstile-token")}
    >
      Turnstile
    </button>
  ),
}));

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
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
      "emailForm.title": "想看完整報告？",
      "emailForm.label": "您的 email",
      "emailForm.placeholder": "you@example.com",
      "emailForm.submitButton": "寄送完整報告",
      "emailForm.successToast": "完整報告已寄到您的信箱",
      "emailForm.errorToast": "寄送失敗，請稍後再試",
      "emailForm.privacyHint": "我們只會寄 SEO 健檢相關內容，可隨時退訂",
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
    vi.clearAllMocks();
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

  it("displays the public audit result after a successful submit", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        reportId: "report-1",
        healthScore: 91,
        totalIssues: 1,
        topIssues: [
          {
            rule: "meta.description.missing",
            page: "https://example.com/",
            impact: "Add a concise meta description",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(await PublicAuditPage());

    fireEvent.change(screen.getByRole("textbox", { name: "您的網站網址" }), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByTestId("turnstile-widget"));
    fireEvent.click(screen.getByRole("button", { name: "開始免費掃描" }));

    await waitFor(() => {
      expect(screen.getByText("91")).toBeInTheDocument();
    });
    expect(
      screen.getAllByText("meta.description.missing").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("Add a concise meta description"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "了解 1waySEO →" }),
    ).toHaveAttribute("href", "/signup");
    expect(
      screen.getByRole("textbox", { name: "您的 email" }),
    ).toBeInTheDocument();
  });

  it("submits the optional email form after a successful audit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          reportId: "report-1",
          healthScore: 91,
          totalIssues: 0,
          topIssues: [],
        }),
      )
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    render(await PublicAuditPage());

    fireEvent.change(screen.getByRole("textbox", { name: "您的網站網址" }), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByTestId("turnstile-widget"));
    fireEvent.click(screen.getByRole("button", { name: "開始免費掃描" }));

    await waitFor(() => {
      expect(screen.getByText("91")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("textbox", { name: "您的 email" }), {
      target: { value: "lead@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "寄送完整報告" }));

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith("完整報告已寄到您的信箱");
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/public/audit/lead-email",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          reportId: "report-1",
          email: "lead@example.com",
        }),
      }),
    );
  });
});
