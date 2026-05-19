import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShoplineShopPanel } from "../ShoplineShopPanel";

const fetchMock = vi.fn();
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      "shop.title": "Shop meta",
      "shop.titleTemplate.label": "Title template",
      "shop.titleTemplate.placeholder": "{{product.title}} | {{shop.name}}",
      "shop.titleTemplate.variables": "Variables",
      "shop.defaultDescription.label": "Default description",
      "shop.robots.products": "Index products",
      "shop.robots.collections": "Index collections",
      "shop.sitemap.enabled": "Sitemap enabled",
      "shop.ogImage.label": "Default OG image",
      "shop.hreflang.label": "Hreflang JSON",
      "shop.save": "Save",
      "toast.saveSuccess": "Saved",
      "toast.saveError": "Save failed",
    };

    return messages[key] ?? key;
  },
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

describe("ShoplineShopPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("loads shop meta on mount", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        seo_title_template: "{{product.title}} | Demo",
        default_description: "Default description",
        robots_index_products: true,
        robots_index_collections: false,
        sitemap_enabled: true,
        default_og_image: "https://example.com/og.jpg",
        hreflang_map: { en: "https://example.com/en" },
      }),
    });

    render(<ShoplineShopPanel websiteId="website-1" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/shopline/website-1/shop-meta",
      );
    });
    expect(screen.getByRole("textbox", { name: "Title template" })).toHaveValue(
      "{{product.title}} | Demo",
    );
    expect(
      screen.getByRole("textbox", { name: "Default description" }),
    ).toHaveValue("Default description");
  });

  it("submits shop meta with PUT and shows success toast", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          seo_title_template: "",
          default_description: "",
          robots_index_products: true,
          robots_index_collections: true,
          sitemap_enabled: true,
          default_og_image: null,
          hreflang_map: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          seo_title_template: "{{product.title}} | Demo",
          default_description: "Default",
          robots_index_products: true,
          robots_index_collections: true,
          sitemap_enabled: false,
          default_og_image: null,
          hreflang_map: null,
        }),
      });

    render(<ShoplineShopPanel websiteId="website-1" />);

    fireEvent.change(
      await screen.findByRole("textbox", { name: "Title template" }),
      {
        target: { value: "{{product.title}} | Demo" },
      },
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Default description" }),
      {
        target: { value: "Default" },
      },
    );
    fireEvent.click(screen.getByRole("switch", { name: "Sitemap enabled" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/shopline/website-1/shop-meta",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seo_title_template: "{{product.title}} | Demo",
          default_description: "Default",
          robots_index_products: true,
          robots_index_collections: true,
          sitemap_enabled: false,
          default_og_image: null,
          hreflang_map: null,
        }),
      },
    );
    expect(toastMock.success).toHaveBeenCalledWith("Saved");
  });
});
