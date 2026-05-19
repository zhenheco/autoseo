import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShoplineProductsPanel } from "../ShoplineProductsPanel";

const fetchMock = vi.fn();
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const messages: Record<string, string> = {
      "products.title": "SHOPLINE Products",
      "products.empty": "No products",
      "products.column.title": "Product title",
      "products.column.handle": "Handle",
      "products.column.seoTitle": "SEO title",
      "products.column.notSet": "未設定",
      "edit.title": "Edit SEO",
      "edit.seoTitleLabel": "SEO title",
      "edit.charCount": `${values?.count ?? 0}/70`,
      "edit.save": "Save",
      "edit.cancel": "Cancel",
      "toast.saveSuccess": "Saved",
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

describe("ShoplineProductsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("loads products with GET and renders product rows", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        products: [
          {
            id: "product-1",
            title: "Product 1",
            handle: "product-1",
            seo: { title: "Original SEO title" },
          },
          {
            id: "product-2",
            title: "Product 2",
            handle: "product-2",
            seo: {},
          },
        ],
      }),
    });

    render(<ShoplineProductsPanel websiteId="website-1" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/shopline/website-1/products",
      );
    });
    expect(await screen.findByText("Product 1")).toBeInTheDocument();
    expect(screen.getByText("product-1")).toBeInTheDocument();
    expect(screen.getByText("Original SEO title")).toBeInTheDocument();
    expect(screen.getByText("未設定")).toBeInTheDocument();
  });

  it("opens the edit modal with the current SEO title when a row is clicked", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        products: [
          {
            id: "product-1",
            title: "Product 1",
            handle: "product-1",
            seo: { title: "Original SEO title" },
          },
        ],
      }),
    });

    render(<ShoplineProductsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByText("Product 1"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "SEO title" })).toHaveValue(
      "Original SEO title",
    );
    expect(screen.getByText("18/70")).toBeInTheDocument();
  });

  it("submits PATCH with the SEO title and updates the row after success", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [
            {
              id: "product-1",
              title: "Product 1",
              handle: "product-1",
              seo: { title: "Original SEO title" },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "product-1",
          title: "Product 1",
          handle: "product-1",
          seo: { title: "Updated SEO title" },
        }),
      });

    render(<ShoplineProductsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByText("Product 1"));
    fireEvent.change(screen.getByRole("textbox", { name: "SEO title" }), {
      target: { value: "Updated SEO title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/shopline/website-1/products/product-1/seo",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seo: { title: "Updated SEO title" } }),
      },
    );
    expect(await screen.findByText("Updated SEO title")).toBeInTheDocument();
    expect(toastMock.success).toHaveBeenCalledWith("Saved");
  });
});
