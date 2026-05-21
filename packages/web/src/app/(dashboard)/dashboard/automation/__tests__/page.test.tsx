import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const brandApiMocks = vi.hoisted(() => ({
  fetchBrandsFromApi: vi.fn(),
}));

const navigationMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("@/lib/brands/server-api", () => brandApiMocks);
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: navigationMocks.refresh,
  }),
}));

function brand(id: string, name: string, automationLevel: number) {
  return {
    id,
    company_id: "company-1",
    name,
    voice_tone: null,
    target_audience: null,
    value_props: null,
    brand_guidelines: null,
    logo_url: null,
    primary_color: null,
    secondary_color: null,
    is_default: false,
    created_at: "2026-05-21T00:00:00.000Z",
    updated_at: "2026-05-21T00:00:00.000Z",
    deleted_at: null,
    automation_level: automationLevel,
    auto_articles_per_week: 4,
    auto_publish_to_social: false,
  };
}

describe("automation dashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    brandApiMocks.fetchBrandsFromApi.mockResolvedValue([
      brand("brand-1", "Northwind", 1),
      brand("brand-2", "Contoso", 3),
    ]);
  });

  it("renders settings for the brand selected by dashboard brand context", async () => {
    const { default: AutomationPage } = await import("../page");

    render(
      await AutomationPage({
        searchParams: Promise.resolve({ brand: "brand-2" }),
      }),
    );

    expect(screen.getByText("Active brand: Contoso")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /L3 排程/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
