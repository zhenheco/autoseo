import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TableName =
  | "audit_reports"
  | "audit_issues"
  | "article_jobs"
  | "website_configs"
  | "shopline_connections";

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserCompanies: vi.fn(),
}));

const navigationMocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  refresh: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@shared/auth", () => authMocks);
vi.mock("@shared/supabase", () => supabaseMocks);
vi.mock("next/navigation", () => ({
  notFound: navigationMocks.notFound,
  redirect: navigationMocks.redirect,
  useRouter: () => ({ refresh: navigationMocks.refresh }),
}));
vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => translate),
}));
vi.mock("sonner", () => ({
  toast: toastMocks,
}));

function translate(key: string, values?: Record<string, unknown>) {
  const messages: Record<string, string> = {
    "detail.summaryTitle": "掃描摘要",
    "detail.tabs.all": "全部 ({{count}})",
    "detail.tabs.critical": "嚴重 ({{count}})",
    "detail.tabs.warning": "警告 ({{count}})",
    "detail.tabs.info": "資訊 ({{count}})",
    "detail.issueCard.rule": "規則",
    "detail.issueCard.page": "頁面",
    "detail.issueCard.current": "目前",
    "detail.issueCard.suggested": "建議",
    "detail.issueCard.selector": "選擇器",
    "detail.issueCard.applyButton": "自動套用",
    "detail.issueCard.applySuccess": "已自動套用",
    "detail.issueCard.applyFailed": "自動套用失敗",
    "review.tabLabel": "待審 ({{count}})",
  };
  let message = messages[key] ?? key;
  for (const [name, value] of Object.entries(values ?? {})) {
    message = message.replace(`{{${name}}}`, String(value));
  }
  return message;
}

function createSupabaseMock(rows: Partial<Record<TableName, unknown[]>>) {
  return {
    from(table: TableName) {
      const builder = {
        filters: [] as Array<[string, unknown]>,
        inFilters: [] as Array<[string, unknown[]]>,
        select: vi.fn(() => builder),
        eq: vi.fn((column: string, value: unknown) => {
          builder.filters.push([column, value]);
          return builder;
        }),
        in: vi.fn((column: string, values: unknown[]) => {
          builder.inFilters.push([column, values]);
          return builder;
        }),
        order: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => {
          const data = (rows[table] ?? []).find((row) =>
            builder.filters.every(
              ([column, value]) =>
                (row as Record<string, unknown>)[column] === value,
            ),
          );
          return { data: data ?? null, error: null };
        }),
        then(resolve: (value: { data: unknown[]; error: null }) => void) {
          const data = (rows[table] ?? []).filter(
            (row) =>
              builder.filters.every(
                ([column, value]) =>
                  (row as Record<string, unknown>)[column] === value,
              ) &&
              builder.inFilters.every(([column, values]) =>
                values.includes((row as Record<string, unknown>)[column]),
              ),
          );
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return builder;
    },
  };
}

const report = {
  id: "report-1",
  company_id: "company-1",
  website_id: "website-1",
  url: "https://example.com",
  scope: "single-page",
  health_score: 58,
  pages_scanned: 1,
  raw_payload: {},
  source: "dashboard",
  scanned_at: "2026-05-20T10:00:00.000Z",
  created_by: "user-1",
  created_at: "2026-05-20T10:00:00.000Z",
};

const issue = {
  id: "issue-1",
  report_id: "report-1",
  rule_id: "missing-title",
  severity: "critical",
  risk_level: "high",
  page: "https://example.com",
  selector: "head > title",
  current: "Missing title",
  suggested: "Add a page title",
  source: "html-scan",
  estimated_impact: "high",
  status: "open",
  created_at: "2026-05-20T10:00:00.000Z",
  updated_at: "2026-05-20T10:00:00.000Z",
};

async function renderPage(rows: Partial<Record<TableName, unknown[]>>) {
  supabaseMocks.createClient.mockResolvedValue(createSupabaseMock(rows));
  supabaseMocks.createAdminClient.mockReturnValue(createSupabaseMock(rows));
  const { default: AuditDetailPage } = await import("../page");
  render(
    await AuditDetailPage({
      params: Promise.resolve({ reportId: "report-1" }),
    }),
  );
}

describe("audit report detail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    authMocks.getUser.mockResolvedValue({ id: "user-1" });
    authMocks.getUserCompanies.mockResolvedValue([
      { companies: { id: "company-1" }, role: "owner", status: "active" },
    ]);
    supabaseMocks.createAdminClient.mockReturnValue(
      createSupabaseMock({ website_configs: [], shopline_connections: [] }),
    );
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders 404 when the report does not exist", async () => {
    supabaseMocks.createClient.mockResolvedValue(
      createSupabaseMock({ audit_reports: [], audit_issues: [] }),
    );
    const { default: AuditDetailPage } = await import("../page");

    await expect(
      AuditDetailPage({ params: Promise.resolve({ reportId: "missing" }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("redirects to unauthorized when the report belongs to another company", async () => {
    authMocks.getUserCompanies.mockResolvedValueOnce([
      { companies: { id: "company-1" }, role: "owner", status: "active" },
    ]);
    supabaseMocks.createClient.mockResolvedValue(
      createSupabaseMock({
        audit_reports: [{ ...report, company_id: "company-2" }],
        audit_issues: [],
      }),
    );
    const { default: AuditDetailPage } = await import("../page");

    await expect(
      AuditDetailPage({ params: Promise.resolve({ reportId: "report-1" }) }),
    ).rejects.toThrow("REDIRECT:/dashboard/unauthorized");
  });

  it("renders authorized report issues grouped by severity tabs", async () => {
    await renderPage({
      audit_reports: [report],
      audit_issues: [
        issue,
        { ...issue, id: "issue-2", severity: "warning", rule_id: "meta" },
        { ...issue, id: "issue-3", severity: "info", rule_id: "canonical" },
      ],
      article_jobs: [],
    });

    expect(screen.getByText("掃描摘要")).toBeInTheDocument();
    expect(screen.getAllByText("https://example.com").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByRole("tab", { name: "嚴重 (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "警告 (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "資訊 (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "全部 (3)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "待審 (0)" })).toBeInTheDocument();
    expect(screen.getAllByText("missing-title").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "自動套用" })[0],
    ).toBeDisabled();
  });

  it("enables auto apply for low-risk SHOPLINE issues and refreshes after applying", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        ok: true,
        route: "shopline-editor",
        before: "Short",
        after: "Better description",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await renderPage({
      audit_reports: [report],
      audit_issues: [
        {
          ...issue,
          risk_level: "low",
          rule_id: "meta.description.tooShort",
          current: "Short",
          severity: "critical",
        },
      ],
      article_jobs: [],
      website_configs: [
        {
          id: "website-1",
          company_id: "company-1",
          wordpress_url: "https://demo-shop.myshopline.com",
        },
      ],
      shopline_connections: [],
    });

    const button = screen.getByRole("button", { name: "自動套用" });
    expect(button).toBeEnabled();

    fireEvent.click(button);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/audit/issues/issue-1/apply",
        { method: "POST" },
      );
      expect(toastMocks.success).toHaveBeenCalledWith("已自動套用");
      expect(navigationMocks.refresh).toHaveBeenCalled();
    });
  });

  it("shows article dispatch status for content missing-topic issues", async () => {
    await renderPage({
      audit_reports: [report],
      audit_issues: [
        {
          ...issue,
          rule_id: "content.missing-topic",
          severity: "info",
          risk_level: "medium",
          current: "ergonomic desk",
        },
      ],
      article_jobs: [
        {
          id: "job-1",
          audit_issue_id: "issue-1",
        },
      ],
    });

    fireEvent.click(screen.getByRole("tab", { name: "資訊 (1)" }));

    expect(
      screen.getByRole("link", {
        name: "已派工到內容生成 #job-1",
      }),
    ).toHaveAttribute("href", "/dashboard/articles/job-1");
  });

  it("dispatches content missing-topic issues from the dashboard", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        ok: true,
        jobId: "job-2",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await renderPage({
      audit_reports: [report],
      audit_issues: [
        {
          ...issue,
          rule_id: "content.missing-topic",
          severity: "info",
          risk_level: "medium",
          current: "ergonomic desk",
        },
      ],
      article_jobs: [],
    });

    fireEvent.click(screen.getByRole("tab", { name: "資訊 (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "派工" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/audit/issues/issue-1/dispatch-article",
        { method: "POST" },
      );
      expect(toastMocks.success).toHaveBeenCalledWith("已派工到內容生成");
      expect(navigationMocks.refresh).toHaveBeenCalled();
    });
  });
});
