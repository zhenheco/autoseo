import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TableName = "company_subscriptions" | "website_configs";

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserPrimaryCompany: vi.fn(),
}));

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@shared/auth", () => authMocks);
vi.mock("@shared/supabase", () => supabaseMocks);
vi.mock("next/navigation", () => ({
  redirect: navigationMocks.redirect,
  useRouter: () => ({
    push: navigationMocks.push,
    refresh: navigationMocks.refresh,
  }),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ host: "app.example.com" })),
}));
vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => translate),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => translate),
}));

function translate(key: string, values?: Record<string, unknown>) {
  const messages: Record<string, string> = {
    title: "Brands",
    description: "Manage company brands and their publishing context.",
    addBrand: "Add brand",
    noBrandsYet: "No brands yet",
    createFirstBrand: "Create your first brand",
    defaultBadge: "Default",
    websitesLinked: "Websites linked",
    socialAccountsLinked: "Social accounts linked",
    socialAccountsUnavailable: "N/A",
    created: "Created",
    edit: "Edit",
    delete: "Delete",
    quotaUsage: "Using {used} of {cap} brands ({plan} plan)",
    upgrade: "Upgrade",
    name: "Name",
    voiceTone: "Voice tone",
    valueProps: "Value props",
    valuePropsPlaceholder: "Fast setup, Expert SEO",
    create: "Create",
    creating: "Creating...",
    cancel: "Cancel",
    deleteTitle: "Delete brand?",
    deleteDescription: "This removes the brand from active lists.",
    confirmDelete: "Delete brand",
    failedToCreate: "Failed to create brand",
    failedToDelete: "Failed to delete brand",
  };
  let message = messages[key] ?? key;
  for (const [name, value] of Object.entries(values ?? {})) {
    message = message.replace(`{${name}}`, String(value));
  }
  return message;
}

const baseBrands = [
  {
    id: "brand-1",
    company_id: "company-1",
    name: "Northwind",
    voice_tone: "Clear and expert",
    target_audience: null,
    value_props: ["Fast setup"],
    brand_guidelines: null,
    logo_url: null,
    primary_color: null,
    secondary_color: null,
    is_default: true,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "brand-2",
    company_id: "company-1",
    name: "Contoso",
    voice_tone: null,
    target_audience: null,
    value_props: null,
    brand_guidelines: null,
    logo_url: null,
    primary_color: null,
    secondary_color: null,
    is_default: false,
    created_at: "2026-05-02T00:00:00.000Z",
    updated_at: "2026-05-02T00:00:00.000Z",
    deleted_at: null,
  },
];

function createSupabaseMock(input: {
  planSlug?: string;
  billingCycle?: "monthly" | "yearly";
  websiteBrandIds?: string[];
}) {
  return {
    from(table: TableName) {
      const builder = {
        table,
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        not: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => ({
          data: {
            billing_cycle: input.billingCycle ?? "monthly",
            subscription_plans: { slug: input.planSlug ?? "pro" },
          },
          error: null,
        })),
        then(resolve: (value: { data: unknown[]; error: null }) => void) {
          const data =
            table === "website_configs"
              ? (input.websiteBrandIds ?? []).map((brand_id, index) => ({
                  id: `website-${index + 1}`,
                  brand_id,
                }))
              : [];
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return builder;
    },
  };
}

function mockFetchBrands(brands = baseBrands) {
  const created = {
    ...baseBrands[0],
    id: "brand-3",
    name: "New brand",
    is_default: false,
    created_at: "2026-05-03T00:00:00.000Z",
  };

  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/brands") && init?.method === "POST") {
        return Response.json({ success: true, data: created }, { status: 201 });
      }
      if (url.includes("/api/brands")) {
        return Response.json({ success: true, data: brands });
      }
      return Response.json(
        { success: false, error: "not found" },
        { status: 404 },
      );
    },
  );

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function renderPage(input?: {
  brands?: typeof baseBrands;
  planSlug?: string;
  websiteBrandIds?: string[];
}) {
  mockFetchBrands(input?.brands ?? baseBrands);
  supabaseMocks.createClient.mockResolvedValue(
    createSupabaseMock({
      planSlug: input?.planSlug,
      websiteBrandIds: input?.websiteBrandIds ?? ["brand-1", "brand-1"],
    }),
  );
  const { default: BrandsPage } = await import("../page");
  render(await BrandsPage());
}

describe("brands dashboard page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    authMocks.getUser.mockResolvedValue({ id: "user-1" });
    authMocks.getUserPrimaryCompany.mockResolvedValue({
      id: "company-1",
      name: "Acme",
    });
  });

  it("renders brands from the /api/brands response", async () => {
    await renderPage();

    expect(screen.getByText("Northwind")).toBeInTheDocument();
    expect(screen.getByText("Contoso")).toBeInTheDocument();
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);
    expect(screen.getByText("May 1, 2026")).toBeInTheDocument();
  });

  it("opens the add brand dialog, submits, and refreshes before redirecting", async () => {
    const fetchMock = mockFetchBrands();
    supabaseMocks.createClient.mockResolvedValue(
      createSupabaseMock({ planSlug: "pro", websiteBrandIds: [] }),
    );
    const { default: BrandsPage } = await import("../page");
    render(await BrandsPage());

    fireEvent.click(screen.getByRole("button", { name: "Add brand" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "New brand" },
    });
    fireEvent.change(screen.getByLabelText("Voice tone"), {
      target: { value: "Practical and sharp" },
    });
    fireEvent.change(screen.getByLabelText("Value props"), {
      target: { value: "Fast setup, Expert SEO" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Add brand" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/brands",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(navigationMocks.refresh).toHaveBeenCalled());
    expect(navigationMocks.push).toHaveBeenCalledWith(
      "/dashboard/brands/brand-3/memory?brand=brand-3",
    );
  });

  it("shows quota usage for the current plan", async () => {
    await renderPage({ planSlug: "pro", websiteBrandIds: [] });

    expect(
      screen.getByText("Using 2 of 5 brands (Pro plan)"),
    ).toBeInTheDocument();
  });

  it("renders the EmptyState when no brands are returned", async () => {
    await renderPage({ brands: [], planSlug: "pro", websiteBrandIds: [] });

    expect(
      screen.getByRole("heading", { name: "No brands yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create your first brand" }),
    ).toBeInTheDocument();
  });

  it("disables Add brand when the company is at its cap", async () => {
    await renderPage({ brands: [baseBrands[0]], planSlug: "solo" });

    expect(screen.getByRole("button", { name: "Add brand" })).toBeDisabled();
    expect(
      screen.getByText("Using 1 of 1 brands (Solo plan)"),
    ).toBeInTheDocument();
  });
});
