import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShoplineHealthSummary } from "../ShoplineHealthSummary";
import { ShoplineProductsPanel } from "../ShoplineProductsPanel";

const fetchMock = vi.fn();
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const messages: Record<string, string> = {
      "health.title": "SEO health",
      "health.empty": "No SEO issues",
      "health.flag.missingSeoTitle": "Missing SEO title",
      "health.flag.seoTitleTooLong": "SEO title too long",
      "health.flag.missingSeoDescription": "Missing SEO description",
      "health.flag.seoDescriptionTooLong": "SEO description too long",
      "health.flag.missingAlt": "Missing alt",
      "health.flag.duplicateTitle": "Duplicate title",
      "filter.label": "SEO filter",
      "filter.all": "All",
      "filter.clear": "Clear",
      "filter.count": `${values?.filter ?? ""}: ${values?.count ?? 0} items`,
      "products.title": "SHOPLINE Products",
      "products.empty": "No products",
      "products.column.title": "Product title",
      "products.column.handle": "Handle",
      "products.column.seoTitle": "SEO title",
      "products.column.notSet": "Not set",
      "toast.saveError": "Save failed",
      "pagination.next": "Next",
      "pagination.prev": "Previous",
    };

    return messages[key] ?? key;
  },
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

describe("ShoplineHealthSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    window.history.replaceState(null, "", "/dashboard/shopline");
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("loads the health summary and renders each flag count", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        counts: {
          missingSeoTitle: 1,
          seoTitleTooLong: 2,
          missingSeoDescription: 3,
          seoDescriptionTooLong: 4,
          missingAlt: 5,
          duplicateTitle: 6,
        },
      }),
    });

    render(<ShoplineHealthSummary websiteId="website-1" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/shopline/website-1/health-summary",
      );
    });
    expect(await screen.findByText("SEO health")).toBeInTheDocument();
    expect(screen.getByText("Missing SEO title")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("SEO title too long")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Missing SEO description")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("SEO description too long")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Missing alt")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Duplicate title")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("clicking a flag refetches the products list with the matching filter", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/health-summary")) {
        return {
          ok: true,
          json: async () => ({
            counts: {
              missingSeoTitle: 0,
              seoTitleTooLong: 0,
              missingSeoDescription: 0,
              seoDescriptionTooLong: 0,
              missingAlt: 2,
              duplicateTitle: 0,
            },
          }),
        };
      }

      if (url.endsWith("/products?filter=missing-alt")) {
        return {
          ok: true,
          json: async () => ({
            products: [
              {
                id: "product-missing-alt",
                title: "Needs alt",
                handle: "needs-alt",
                seo: {},
              },
            ],
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          products: [
            {
              id: "product-1",
              title: "Product 1",
              handle: "product-1",
              seo: {},
            },
          ],
        }),
      };
    });

    render(
      <>
        <ShoplineHealthSummary websiteId="website-1" />
        <ShoplineProductsPanel websiteId="website-1" />
      </>,
    );

    expect(await screen.findByText("Product 1")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /Missing alt/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/shopline/website-1/products?filter=missing-alt",
      );
    });
    expect(await screen.findByText("Needs alt")).toBeInTheDocument();
    expect(screen.getByText("Missing alt: 1 items")).toBeInTheDocument();
  });
});
