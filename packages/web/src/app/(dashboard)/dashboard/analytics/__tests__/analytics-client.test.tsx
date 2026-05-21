import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsClient } from "../analytics-client";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/analytics",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams("brand=brand-1"),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chart">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Line: ({ dataKey }: { dataKey: string }) => (
    <span data-testid={`line-${dataKey}`} />
  ),
}));

const analyticsResponse = {
  meta: {
    brandId: "brand-1",
    from: "2026-04-22",
    to: "2026-05-21",
    source: "all",
    plan: "pro",
    maxDays: null,
  },
  kpis: {
    totalPageviews: 4250,
    uniqueVisitors: 1900,
    topArticle: {
      articleId: "article-1",
      title: "SEO Growth Guide",
      views: 3200,
    },
    topPlatform: { source: "ga4", views: 3500 },
  },
  timeseries: [
    {
      date: "2026-05-20",
      ga4: { pageviews: 1000, sessions: 450, engagement: 180 },
      gsc: { pageviews: 350, sessions: 220, engagement: 60 },
      social: { pageviews: 150, sessions: 90, engagement: 30 },
    },
  ],
  articles: [
    {
      articleId: "article-1",
      title: "SEO Growth Guide",
      slug: "seo-growth-guide",
      source: "ga4",
      pageviews: 3200,
      uniqueVisitors: 1400,
      avgSessionSeconds: 92,
      ctr: 0.121,
      position: 4.2,
    },
    {
      articleId: "article-2",
      title: "Search Console Tips",
      slug: "search-console-tips",
      source: "gsc",
      pageviews: 1050,
      uniqueVisitors: 500,
      avgSessionSeconds: 74,
      ctr: 0.083,
      position: 7.5,
    },
  ],
};

function renderAnalytics() {
  return render(
    <AnalyticsClient
      brands={[
        { id: "brand-1", name: "Northwind" },
        { id: "brand-2", name: "Contoso" },
      ]}
      activeBrandId="brand-1"
      initialPlan="pro"
    />,
  );
}

describe("AnalyticsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(analyticsResponse)),
    );
  });

  it("renders analytics fetched from /api/analytics", async () => {
    renderAnalytics();

    expect(await screen.findByText("4,250")).toBeInTheDocument();
    expect(screen.getAllByText("SEO Growth Guide").length).toBeGreaterThan(0);
    expect(screen.getByText("Search Console Tips")).toBeInTheDocument();
    expect(screen.getByTestId("chart")).toBeInTheDocument();
    expect(screen.getByTestId("line-ga4")).toBeInTheDocument();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/analytics?"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(
      String((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]),
    ).toContain("brandId=brand-1");
  });

  it("refetches when filters change", async () => {
    renderAnalytics();
    await screen.findByText("4,250");

    fireEvent.change(screen.getByLabelText("Platform"), {
      target: { value: "gsc" },
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
    expect(
      String((fetch as ReturnType<typeof vi.fn>).mock.calls[1][0]),
    ).toContain("source=gsc");
  });
});
