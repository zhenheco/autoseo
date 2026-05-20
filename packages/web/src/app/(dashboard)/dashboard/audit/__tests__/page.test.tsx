import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TableName = "website_configs" | "audit_reports" | "audit_issues";

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserPrimaryCompany: vi.fn(),
}));

const navigationMocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
  })),
}));

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@shared/auth", () => authMocks);
vi.mock("@shared/supabase", () => supabaseMocks);
vi.mock("next/navigation", () => navigationMocks);
vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => translate),
}));

function translate(key: string, values?: Record<string, unknown>) {
  const messages: Record<string, string> = {
    title: "網站健檢",
    "list.newScanButton": "新掃描",
    "list.filterByWebsite": "篩選網站",
    "list.columns.url": "網址",
    "list.columns.scannedAt": "掃描時間",
    "list.columns.healthScore": "健康度",
    "list.columns.issueCount": "問題數",
    "list.columns.actions": "操作",
    "list.empty": "尚無 audit 紀錄。點「新掃描」開始第一次",
    "scan.dialogTitle": "新掃描",
    "scan.websiteLabel": "選擇網站",
    "scan.urlLabel": "或直接輸入網址",
    "scan.scopeLabel": "掃描範圍",
    "scan.scopeSinglePage": "單頁",
    "scan.submitButton": "開始掃描",
    "scan.scanning": "掃描中...",
    "scan.failed": "掃描失敗",
  };
  let message = messages[key] ?? key;
  for (const [name, value] of Object.entries(values ?? {})) {
    message = message.replace(`{{${name}}}`, String(value));
  }
  return message;
}

function createSupabaseMock(rows: Record<TableName, unknown[]>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];

  return {
    calls,
    from(table: TableName) {
      const builder = {
        table,
        filters: [] as Array<[string, unknown]>,
        select(...args: unknown[]) {
          calls.push({ table, method: "select", args });
          return builder;
        },
        eq(column: string, value: unknown) {
          calls.push({ table, method: "eq", args: [column, value] });
          builder.filters.push([column, value]);
          return builder;
        },
        or(...args: unknown[]) {
          calls.push({ table, method: "or", args });
          return builder;
        },
        order(...args: unknown[]) {
          calls.push({ table, method: "order", args });
          return builder;
        },
        range(...args: unknown[]) {
          calls.push({ table, method: "range", args });
          return builder;
        },
        in(...args: unknown[]) {
          calls.push({ table, method: "in", args });
          return builder;
        },
        then(resolve: (value: { data: unknown[]; error: null }) => void) {
          const data = (rows[table] ?? []).filter((row) =>
            builder.filters.every(
              ([column, value]) =>
                (row as Record<string, unknown>)[column] === value,
            ),
          );
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return builder;
    },
  };
}

const website = {
  id: "website-1",
  website_name: "Main site",
  wordpress_url: "https://example.com",
  company_id: "company-1",
};

const report = {
  id: "report-1",
  company_id: "company-1",
  website_id: "website-1",
  url: "https://example.com",
  scope: "single-page",
  health_score: 82,
  pages_scanned: 1,
  raw_payload: {},
  source: "dashboard",
  scanned_at: "2026-05-20T10:00:00.000Z",
  created_by: "user-1",
  created_at: "2026-05-20T10:00:00.000Z",
};

async function renderPage(rows: Record<TableName, unknown[]>) {
  const supabase = createSupabaseMock(rows);
  supabaseMocks.createClient.mockResolvedValue(supabase);
  const { default: AuditPage } = await import("../page");
  render(await AuditPage({ searchParams: Promise.resolve({}) }));
  return supabase;
}

describe("audit reports page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    authMocks.getUser.mockResolvedValue({ id: "user-1" });
    authMocks.getUserPrimaryCompany.mockResolvedValue({
      id: "company-1",
      name: "Acme",
    });
  });

  it("redirects anonymous users to login", async () => {
    authMocks.getUser.mockResolvedValueOnce(null);
    const { default: AuditPage } = await import("../page");

    await expect(
      AuditPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("shows the empty state when the user has no audit reports", async () => {
    await renderPage({
      website_configs: [website],
      audit_reports: [],
      audit_issues: [],
    });

    expect(
      screen.getAllByText("尚無 audit 紀錄。點「新掃描」開始第一次").length,
    ).toBeGreaterThan(0);
  });

  it("shows reports with health score badge colors", async () => {
    await renderPage({
      website_configs: [website],
      audit_reports: [report],
      audit_issues: [
        { report_id: "report-1", severity: "critical" },
        { report_id: "report-1", severity: "warning" },
        { report_id: "report-1", severity: "info" },
      ],
    });

    expect(screen.getByText("https://example.com")).toBeInTheDocument();
    expect(screen.getByText("1 critical")).toBeInTheDocument();
    expect(screen.getByText("1 warning")).toBeInTheDocument();
    expect(screen.getByText("1 info")).toBeInTheDocument();
    expect(screen.getByText("82")).toHaveClass("bg-green-100");
  });

  it("does not render reports outside the user's company scope", async () => {
    await renderPage({
      website_configs: [website],
      audit_reports: [
        {
          ...report,
          id: "report-2",
          company_id: "company-2",
          website_id: "website-2",
          url: "https://other.example.com",
        },
      ],
      audit_issues: [],
    });

    expect(
      screen.queryByText("https://other.example.com"),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText("尚無 audit 紀錄。點「新掃描」開始第一次").length,
    ).toBeGreaterThan(0);
  });
});
