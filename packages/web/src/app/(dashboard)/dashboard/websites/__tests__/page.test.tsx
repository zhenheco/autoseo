import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserPrimaryCompany: vi.fn(),
}));

const permissionMocks = vi.hoisted(() => ({
  checkPagePermission: vi.fn(),
}));

const navigationMocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@shared/auth", () => authMocks);
vi.mock("@shared/auth/permissions", () => permissionMocks);
vi.mock("@shared/supabase", () => supabaseMocks);
vi.mock("next/navigation", () => navigationMocks);
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => translate),
}));
vi.mock("@/lib/shopline/connections", () => ({
  createSupabaseShoplineConnectionStore: vi.fn(() => ({})),
  getShoplineConnectionStatus: vi.fn(async () => ({ connected: false })),
}));
vi.mock("../WebsiteAddedTracker", () => ({
  WebsiteAddedTracker: () => null,
}));

function translate(key: string) {
  const messages: Record<string, string> = {
    title: "Websites",
    manageDescription: "Manage websites.",
    addWebsite: "Add website",
    wordpressSites: "WordPress sites",
    noWebsites: "No websites added yet",
    addFirstWebsite: "Add your first website",
    createPlatformBlog: "Create platform blog",
    createPlatformBlogDesc: "Publish to the platform blog.",
    autoSchedule: "Auto schedule",
    "autoSchedule.autoScheduleLabel": "Auto schedule",
    platformBlog: "Platform blog",
    "shopline.seoEditButton": "SEO edit",
    status: "Status",
    viewArticles: "View articles",
    edit: "Edit",
    delete: "Delete",
  };
  return messages[key] ?? key;
}

function createSupabaseMock() {
  return {
    from(table: string) {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        then(resolve: (value: { data: unknown[]; error: null }) => void) {
          const data = table === "website_configs" ? [] : [];
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return builder;
    },
  };
}

describe("websites dashboard page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authMocks.getUser.mockResolvedValue({ id: "user-1" });
    authMocks.getUserPrimaryCompany.mockResolvedValue({
      id: "company-1",
      name: "Acme",
    });
    supabaseMocks.createClient.mockResolvedValue(createSupabaseMock());
    supabaseMocks.createAdminClient.mockReturnValue({});
  });

  it("renders the EmptyState when no websites are returned", async () => {
    const { default: WebsitesPage } = await import("../page");

    render(await WebsitesPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { name: "No websites added yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Add your first website" }),
    ).toHaveAttribute("href", "/dashboard/websites/new");
  });
});
