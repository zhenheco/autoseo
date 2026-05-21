import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserPrimaryCompany: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@shared/auth", () => authMocks);
vi.mock("@shared/supabase", () => supabaseMocks);

const brands = [
  {
    id: "brand-1",
    company_id: "company-1",
    name: "First brand",
    voice_tone: null,
    target_audience: null,
    value_props: null,
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
    name: "Cookie brand",
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
  {
    id: "brand-3",
    company_id: "company-1",
    name: "Query brand",
    voice_tone: null,
    target_audience: null,
    value_props: null,
    brand_guidelines: null,
    logo_url: null,
    primary_color: null,
    secondary_color: null,
    is_default: false,
    created_at: "2026-05-03T00:00:00.000Z",
    updated_at: "2026-05-03T00:00:00.000Z",
    deleted_at: null,
  },
];

function createSupabaseMock(rows = brands) {
  return {
    from() {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        is: vi.fn(() => builder),
        order: vi.fn(() => Promise.resolve({ data: rows, error: null })),
      };
      return builder;
    },
  };
}

function request(url: string, cookie?: string) {
  const req = new Request(url);
  if (cookie) req.headers.set("cookie", cookie);
  return req;
}

describe("resolveActiveBrand", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authMocks.getUser.mockResolvedValue({ id: "user-1" });
    authMocks.getUserPrimaryCompany.mockResolvedValue({ id: "company-1" });
    supabaseMocks.createClient.mockResolvedValue(createSupabaseMock());
  });

  it("prefers the brand query parameter over the cookie", async () => {
    const { resolveActiveBrand } = await import("../active-brand");

    await expect(
      resolveActiveBrand(
        request(
          "https://app.example.com/dashboard?brand=brand-3",
          "active_brand_id=brand-2",
        ),
      ),
    ).resolves.toMatchObject({ id: "brand-3" });
  });

  it("falls back to active_brand_id cookie when the query is absent", async () => {
    const { resolveActiveBrand } = await import("../active-brand");

    await expect(
      resolveActiveBrand(
        request("https://app.example.com/dashboard", "active_brand_id=brand-2"),
      ),
    ).resolves.toMatchObject({ id: "brand-2" });
  });

  it("falls back to the first brand when query and cookie are not usable", async () => {
    const { resolveActiveBrand } = await import("../active-brand");

    await expect(
      resolveActiveBrand(
        request(
          "https://app.example.com/dashboard?brand=missing",
          "active_brand_id=also-missing",
        ),
      ),
    ).resolves.toMatchObject({ id: "brand-1" });
  });

  it("returns null when the current company has no brands", async () => {
    supabaseMocks.createClient.mockResolvedValue(createSupabaseMock([]));
    const { resolveActiveBrand } = await import("../active-brand");

    await expect(
      resolveActiveBrand(request("https://app.example.com/dashboard")),
    ).resolves.toBeNull();
  });
});
