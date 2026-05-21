import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TableName = "brands" | "company_members" | "brand_performance_memory";

type Filter = {
  column: string;
  value: unknown;
};

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
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
vi.mock("sonner", () => ({
  toast: toastMocks,
}));

const ids = {
  user: "00000000-0000-4000-8000-000000000001",
  company: "00000000-0000-4000-8000-000000000101",
  otherCompany: "00000000-0000-4000-8000-000000000202",
  brand: "00000000-0000-4000-8000-000000001001",
};

const brandRow = {
  id: ids.brand,
  company_id: ids.company,
  name: "Northwind",
  voice_tone: "professional",
  target_audience: {
    demographic: {
      ageRange: "30-45",
      location: "Taiwan",
      interests: ["SEO", "Automation"],
    },
    psychographic: "Wants fast proof and clear ROI.",
  },
  value_props: ["Fast setup", "Expert SEO"],
  brand_guidelines: "## Voice\n- Be concrete",
  logo_url: "https://example.com/logo.png",
  primary_color: "#2563eb",
  secondary_color: "#14b8a6",
  is_default: true,
  created_at: "2026-05-21T00:00:00.000Z",
  updated_at: "2026-05-21T00:00:00.000Z",
  deleted_at: null,
};

class FakeQueryBuilder {
  private readonly filters: Filter[] = [];

  constructor(
    private readonly rows: Record<TableName, unknown[]>,
    private readonly table: TableName,
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order() {
    return this;
  }

  async maybeSingle() {
    return { data: this.filteredRows()[0] ?? null, error: null };
  }

  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown[]; error: null }) => TResult1)
      | null,
    onrejected?: ((reason: unknown) => TResult2) | null,
  ) {
    return Promise.resolve({ data: this.filteredRows(), error: null }).then(
      onfulfilled,
      onrejected,
    );
  }

  private filteredRows() {
    return (this.rows[this.table] ?? []).filter((row) =>
      this.filters.every(
        (filter) =>
          (row as Record<string, unknown>)[filter.column] === filter.value,
      ),
    );
  }
}

function createSupabaseMock(rows: Partial<Record<TableName, unknown[]>>) {
  const data = {
    brands: [],
    company_members: [],
    brand_performance_memory: [],
    ...rows,
  } as Record<TableName, unknown[]>;

  return {
    from(table: TableName) {
      return new FakeQueryBuilder(data, table);
    },
  };
}

async function renderPage(rows?: Partial<Record<TableName, unknown[]>>) {
  supabaseMocks.createClient.mockResolvedValue(
    createSupabaseMock({
      brands: [brandRow],
      company_members: [
        {
          user_id: ids.user,
          company_id: ids.company,
          status: "active",
        },
      ],
      brand_performance_memory: [
        {
          brand_id: ids.brand,
          metric_key: "winning_topic_count",
          metric_value: 12,
          updated_at: "2026-05-21T01:00:00.000Z",
        },
      ],
      ...rows,
    }),
  );
  const { default: BrandMemoryPage } = await import("../page");
  render(
    await BrandMemoryPage({
      params: Promise.resolve({ id: ids.brand }),
    }),
  );
}

describe("brand memory page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllGlobals();
    authMocks.getUser.mockResolvedValue({ id: ids.user });
  });

  it("loads with brand data populated", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { name: "Northwind" })).toBeVisible();
    expect(screen.getByLabelText("Name")).toHaveValue("Northwind");
    expect(screen.getByLabelText("Age range")).toHaveValue("30-45");
    expect(screen.getByLabelText("Location")).toHaveValue("Taiwan");
    expect(screen.getByText("Fast setup")).toBeInTheDocument();
    expect(screen.getByLabelText("Brand guidelines")).toHaveValue(
      "## Voice\n- Be concrete",
    );
    expect(screen.getByLabelText("Logo URL")).toHaveValue(
      "https://example.com/logo.png",
    );
    expect(screen.getByLabelText("Primary color")).toHaveValue("#2563eb");
    expect(screen.getByText("winning_topic_count")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("submits changes with PATCH and confirms with a toast", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ success: true, data: { id: ids.brand } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await renderPage();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Northwind Labs" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save memory" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/brands/${ids.brand}`,
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    const calls = fetchMock.mock.calls as unknown as Array<
      [string, RequestInit]
    >;
    const [, init] = calls[0];
    expect(JSON.parse(String(init.body))).toMatchObject({
      name: "Northwind Labs",
      voiceTone: "professional",
      targetAudience: {
        demographic: {
          ageRange: "30-45",
          location: "Taiwan",
          interests: ["SEO", "Automation"],
        },
        psychographic: "Wants fast proof and clear ROI.",
      },
      valueProps: ["Fast setup", "Expert SEO"],
      logoUrl: "https://example.com/logo.png",
      primaryColor: "#2563eb",
      secondaryColor: "#14b8a6",
    });
    expect(toastMocks.success).toHaveBeenCalledWith("Brand memory saved");
    expect(navigationMocks.refresh).toHaveBeenCalled();
  });

  it("returns 404 for a cross-company brand", async () => {
    supabaseMocks.createClient.mockResolvedValue(
      createSupabaseMock({
        brands: [{ ...brandRow, company_id: ids.otherCompany }],
        company_members: [
          {
            user_id: ids.user,
            company_id: ids.company,
            status: "active",
          },
        ],
      }),
    );
    const { default: BrandMemoryPage } = await import("../page");

    await expect(
      BrandMemoryPage({
        params: Promise.resolve({ id: ids.brand }),
      }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
