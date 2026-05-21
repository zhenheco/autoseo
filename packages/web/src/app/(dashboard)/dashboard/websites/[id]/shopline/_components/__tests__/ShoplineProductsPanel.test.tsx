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
      "edit.tabs.seoMeta": "SEO meta",
      "edit.tabs.images": "Images",
      "edit.tabs.categories": "Categories",
      "edit.product.titleLabel": "Product title",
      "edit.seoTitleLabel": "SEO title",
      "edit.seoDescriptionLabel": "SEO description",
      "edit.applyTemplate": "Apply template",
      "edit.templatePreview": `Preview: ${values?.preview ?? ""}`,
      "edit.handleLabel": "Handle",
      "redirects.warning.autoCreated":
        "Redirects are automatically created when a handle changes.",
      "edit.charLimitExceeded": "Description must be 160 characters or less",
      "edit.charCount": `${values?.count ?? 0}/70`,
      "edit.save": "Save",
      "edit.cancel": "Cancel",
      "edit.images.altLabel": "Alt text",
      "edit.images.altPlaceholder": "Describe this image",
      "edit.images.save": "Save",
      "edit.images.empty": "No product images",
      "edit.images.imageNumber": `Image ${values?.number ?? 0}`,
      "ai.generate.button": "AI draft",
      "ai.generate.loading": "Generating...",
      "ai.generate.error": `AI draft failed: ${values?.error ?? ""}`,
      "ai.generate.source": `AI draft (${values?.model ?? ""})`,
      "ai.image.generate": "AI alt",
      "filter.label": "SEO filter",
      "filter.all": "All",
      "filter.clear": "Clear",
      "filter.count": `${values?.filter ?? ""}: ${values?.count ?? 0} items`,
      "health.flag.missingSeoTitle": "Missing SEO title",
      "health.flag.seoTitleTooLong": "SEO title too long",
      "health.flag.missingSeoDescription": "Missing SEO description",
      "health.flag.seoDescriptionTooLong": "SEO description too long",
      "health.flag.missingAlt": "Missing alt",
      "health.flag.duplicateTitle": "Duplicate title",
      "edit.categories.addLabel": "Add collection IDs",
      "edit.categories.removeLabel": "Remove collection IDs",
      "edit.categories.placeholder": "Separate with commas or new lines",
      "edit.categories.submit": "Update categories",
      "edit.categories.successCount": `${values?.count ?? 0} succeeded`,
      "edit.categories.failedCount": `${values?.count ?? 0} failed`,
      "edit.categories.loading": "Loading collections",
      "edit.categories.selectLabel": "Collections",
      "edit.categories.advanced": "Advanced manual IDs",
      "toast.saveSuccess": "Saved",
      "toast.saveError": "Save failed",
      "error.scopeMissing.title": "Need reauthorization",
      "error.scopeMissing.description":
        "SHOPLINE permission is missing for this update.",
      "error.scopeMissing.reauthorize": "Reauthorize",
      "error.rateLimited": `Too many operations. Try again in ${
        values?.seconds ?? 0
      } seconds.`,
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

  it("loads next and previous product pages with cursor pagination", async () => {
    fetchMock
      .mockResolvedValueOnce({
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
          nextCursor: "cursor-2",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [
            {
              id: "product-2",
              title: "Product 2",
              handle: "product-2",
              seo: {},
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
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
          nextCursor: "cursor-2",
        }),
      });

    render(<ShoplineProductsPanel websiteId="website-1" />);

    expect(await screen.findByText("Product 1")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/shopline/website-1/products",
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/shopline/website-1/products?cursor=cursor-2",
      );
    });
    expect(await screen.findByText("Product 2")).toBeInTheDocument();
    expect(screen.queryByText("Product 1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        "/api/shopline/website-1/products",
      );
    });
    expect(await screen.findByText("Product 1")).toBeInTheDocument();
    expect(screen.queryByText("Product 2")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("changes and clears the SEO filter when loading products", async () => {
    fetchMock
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
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
      });

    render(<ShoplineProductsPanel websiteId="website-1" />);

    expect(await screen.findByText("Product 1")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("SEO filter"), {
      target: { value: "missing-alt" },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/shopline/website-1/products?filter=missing-alt",
      );
    });
    expect(await screen.findByText("Needs alt")).toBeInTheDocument();
    expect(screen.getByText("Missing alt: 1 items")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        "/api/shopline/website-1/products",
      );
    });
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
    expect(screen.getByRole("tab", { name: "SEO meta" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Images" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Categories" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Product title" })).toHaveValue(
      "Product 1",
    );
    expect(screen.getByRole("textbox", { name: "SEO title" })).toHaveValue(
      "Original SEO title",
    );
    expect(screen.getByText("18/70")).toBeInTheDocument();
  });

  it("shows the shop title template preview and applies it to the SEO title", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [
            {
              id: "product-1",
              title: "Product 1",
              handle: "product-1",
              vendor: "Acme",
              product_type: "Apparel",
              seo: {},
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          seo_title_template: "{{product.title}} by {{product.vendor}} | Demo",
          default_description: null,
          robots_index_products: true,
          robots_index_collections: true,
          sitemap_enabled: true,
          default_og_image: null,
          hreflang_map: null,
        }),
      });

    render(<ShoplineProductsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByText("Product 1"));

    expect(
      await screen.findByText("Preview: Product 1 by Acme | Demo"),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "SEO title" })).toHaveAttribute(
      "placeholder",
      "Product 1 by Acme | Demo",
    );

    fireEvent.click(screen.getByRole("button", { name: "Apply template" }));

    expect(screen.getByRole("textbox", { name: "SEO title" })).toHaveValue(
      "Product 1 by Acme | Demo",
    );
  });

  it("lists product images in the Images tab", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        products: [
          {
            id: "product-1",
            title: "Product 1",
            handle: "product-1",
            seo: { title: "Original SEO title" },
            images: [
              {
                id: "image-1",
                src: "https://img.myshopline.com/example-1.jpg",
                alt: "Original image alt",
                position: 1,
              },
            ],
          },
        ],
      }),
    });

    render(<ShoplineProductsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByText("Product 1"));
    fireEvent.click(screen.getByRole("tab", { name: "Images" }));

    expect(screen.getByRole("img", { name: "Image 1" })).toHaveAttribute(
      "src",
      "https://img.myshopline.com/example-1.jpg",
    );
    expect(
      screen.getByRole("textbox", { name: "Image 1 Alt text" }),
    ).toHaveValue("Original image alt");
  });

  it("loads collections and shows checkbox options in the Categories tab", async () => {
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
          collections: [
            {
              id: "collection-current",
              title: "Current Collection",
              handle: "current",
              seo: {},
            },
          ],
          nextCursor: "cursor-2",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          collections: [
            {
              id: "collection-next",
              title: "Next Collection",
              handle: "next",
              seo: {},
            },
          ],
          nextCursor: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          collects: [
            {
              id: "collect-1",
              collection_id: "collection-current",
              product_id: "product-1",
            },
          ],
        }),
      });

    render(<ShoplineProductsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByText("Product 1"));
    fireEvent.click(screen.getByRole("tab", { name: "Categories" }));

    expect(
      await screen.findByRole("checkbox", { name: "Current Collection" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Next Collection" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/shopline/website-1/collections",
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/shopline/website-1/collections?cursor=cursor-2",
    );
  });

  it("submits category PATCH from collection checkbox changes", async () => {
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
          collections: [
            {
              id: "collection-current",
              title: "Current Collection",
              handle: "current",
              seo: {},
            },
            {
              id: "collection-add",
              title: "Add Collection",
              handle: "add",
              seo: {},
            },
          ],
          nextCursor: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          collects: [
            {
              id: "collect-1",
              collection_id: "collection-current",
              product_id: "product-1",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          added: [{ collection_id: "collection-add", success: true }],
          removed: [{ collection_id: "collection-current", success: true }],
        }),
      });

    render(<ShoplineProductsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByText("Product 1"));
    fireEvent.click(screen.getByRole("tab", { name: "Categories" }));
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Current Collection" }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Add Collection" }));
    fireEvent.click(screen.getByRole("button", { name: "Update categories" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/shopline/website-1/products/product-1/categories",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          add: ["collection-add"],
          remove: ["collection-current"],
        }),
      },
    );
  });

  it("shows category success and failure counts after submit", async () => {
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
          collections: [
            {
              id: "collection-add-ok",
              title: "Collection Add OK",
              handle: "collection-add-ok",
              seo: {},
            },
            {
              id: "collection-add-fail",
              title: "Collection Add Fail",
              handle: "collection-add-fail",
              seo: {},
            },
          ],
          nextCursor: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ collects: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          added: [
            { collection_id: "collection-add-ok", success: true },
            {
              collection_id: "collection-add-fail",
              success: false,
              error: "assign failed",
            },
          ],
          removed: [],
        }),
      });

    render(<ShoplineProductsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByText("Product 1"));
    fireEvent.click(screen.getByRole("tab", { name: "Categories" }));
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Collection Add OK" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Collection Add Fail" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Update categories" }));

    expect(await screen.findByText("1 succeeded")).toBeInTheDocument();
    expect(screen.getByText("1 failed")).toBeInTheDocument();
    expect(screen.getAllByText("collection-add-ok").length).toBeGreaterThan(0);
    expect(screen.getByText("collection-add-fail")).toBeInTheDocument();
    expect(screen.getByText("assign failed")).toBeInTheDocument();
  });

  it("submits image alt PATCH with the edited alt", async () => {
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
              images: [
                {
                  id: "image-1",
                  src: "https://img.myshopline.com/example-1.jpg",
                  alt: "Original image alt",
                  position: 1,
                },
              ],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "image-1",
          src: "https://img.myshopline.com/example-1.jpg",
          alt: "Updated image alt",
          position: 1,
        }),
      });

    render(<ShoplineProductsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByText("Product 1"));
    fireEvent.click(screen.getByRole("tab", { name: "Images" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Image 1 Alt text" }),
      {
        target: { value: "Updated image alt" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Image 1" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/shopline/website-1/products/product-1/images/image-1/alt",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alt: "Updated image alt" }),
      },
    );
  });

  it("updates the edited image row alt after save succeeds", async () => {
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
              images: [
                {
                  id: "image-1",
                  src: "https://img.myshopline.com/example-1.jpg",
                  alt: "Original image alt",
                  position: 1,
                },
              ],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "image-1",
          src: "https://img.myshopline.com/example-1.jpg",
          alt: "Updated image alt",
          position: 1,
        }),
      });

    render(<ShoplineProductsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByText("Product 1"));
    fireEvent.click(screen.getByRole("tab", { name: "Images" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Image 1 Alt text" }),
      {
        target: { value: "Updated image alt" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Image 1" }));

    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: "Image 1 Alt text" }),
      ).toHaveValue("Updated image alt");
    });
    expect(toastMock.success).toHaveBeenCalledWith("Saved");
  });

  it("opens the edit modal with description and handle fields", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        products: [
          {
            id: "product-1",
            title: "Product 1",
            handle: "product-1",
            seo: {
              title: "Original SEO title",
              description: "Original SEO description",
            },
          },
        ],
      }),
    });

    render(<ShoplineProductsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByText("Product 1"));

    expect(
      screen.getByRole("textbox", { name: "SEO description" }),
    ).toHaveValue("Original SEO description");
    expect(screen.getByRole("textbox", { name: "Handle" })).toHaveValue(
      "product-1",
    );
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
        body: JSON.stringify({
          seo: { title: "Updated SEO title", description: "" },
          handle: "product-1",
          title: "Product 1",
        }),
      },
    );
    expect(await screen.findByText("Updated SEO title")).toBeInTheDocument();
    expect(toastMock.success).toHaveBeenCalledWith("Saved");
  });

  it("generates a product AI SEO draft and submits AI source metadata", async () => {
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
          drafts: {
            seoTitle: "AI SEO title",
            seoDescription: "AI SEO description",
          },
          model: "deepseek-chat",
          generatedAt: "2026-05-19T18:00:00.000Z",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "product-1",
          title: "Product 1",
          handle: "product-1",
          seo: {
            title: "AI SEO title",
            description: "AI SEO description edited",
          },
        }),
      });

    render(<ShoplineProductsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByText("Product 1"));
    fireEvent.click(screen.getByRole("button", { name: "AI draft" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/shopline/website-1/ai-seo",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "product",
          entityId: "product-1",
          fields: ["seoTitle", "seoDescription"],
        }),
      },
    );
    expect(screen.getByRole("textbox", { name: "SEO title" })).toHaveValue(
      "AI SEO title",
    );
    expect(
      screen.getByRole("textbox", { name: "SEO description" }),
    ).toHaveValue("AI SEO description");
    expect(screen.getByText("AI draft (deepseek-chat)")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "SEO description" }), {
      target: { value: "AI SEO description edited" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/shopline/website-1/products/product-1/seo",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seo: {
            title: "AI SEO title",
            description: "AI SEO description edited",
          },
          handle: "product-1",
          title: "Product 1",
          source: "ai",
          model: "deepseek-chat",
        }),
      },
    );
  });

  it("shows loading state while generating product AI SEO draft", async () => {
    let resolveAiDraft: (value: {
      ok: boolean;
      json: () => Promise<unknown>;
    }) => void = () => {};
    const aiDraftPromise = new Promise<{
      ok: boolean;
      json: () => Promise<unknown>;
    }>((resolve) => {
      resolveAiDraft = resolve;
    });

    fetchMock
      .mockResolvedValueOnce({
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
      })
      .mockReturnValueOnce(aiDraftPromise);

    render(<ShoplineProductsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByText("Product 1"));
    fireEvent.click(screen.getByRole("button", { name: "AI draft" }));

    expect(
      screen.getByRole("button", { name: "Generating..." }),
    ).toBeDisabled();

    resolveAiDraft({
      ok: true,
      json: async () => ({
        drafts: { seoTitle: "AI SEO title" },
        model: "deepseek-chat",
        generatedAt: "2026-05-19T18:00:00.000Z",
      }),
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "AI draft" })).toBeEnabled();
    });
  });

  it("shows provider errors when product AI SEO draft generation fails", async () => {
    fetchMock
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "provider unavailable" }),
      });

    render(<ShoplineProductsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByText("Product 1"));
    fireEvent.click(screen.getByRole("button", { name: "AI draft" }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        "AI draft failed: provider unavailable",
      );
    });
  });

  it("submits PATCH with the SEO description and handle", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [
            {
              id: "product-1",
              title: "Product 1",
              handle: "product-1",
              seo: {
                title: "Original SEO title",
                description: "Original description",
              },
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
          seo: {
            title: "Original SEO title",
            description: "Updated description",
          },
        }),
      });

    render(<ShoplineProductsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByText("Product 1"));
    fireEvent.change(screen.getByRole("textbox", { name: "SEO description" }), {
      target: { value: "Updated description" },
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
        body: JSON.stringify({
          seo: {
            title: "Original SEO title",
            description: "Updated description",
          },
          handle: "product-1",
          title: "Product 1",
        }),
      },
    );
  });

  it("submits PATCH with a renamed product title", async () => {
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
          title: "Updated Product",
          handle: "product-1",
          seo: { title: "Original SEO title" },
        }),
      });

    render(<ShoplineProductsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByText("Product 1"));
    fireEvent.change(screen.getByRole("textbox", { name: "Product title" }), {
      target: { value: "Updated Product" },
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
        body: JSON.stringify({
          seo: { title: "Original SEO title", description: "" },
          handle: "product-1",
          title: "Updated Product",
        }),
      },
    );
    expect(await screen.findByText("Updated Product")).toBeInTheDocument();
  });

  it("shows a reauthorization banner when SHOPLINE scope is missing", async () => {
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
        ok: false,
        status: 403,
        json: async () => ({
          error: "shopline_scope_missing",
          missing_scopes: ["write_products"],
          reauthorize_url: "/api/oauth/shopline/install?siteId=website-1",
        }),
      });

    render(<ShoplineProductsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByText("Product 1"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Need reauthorization")).toBeInTheDocument();
    expect(
      screen.getByText("SHOPLINE permission is missing for this update."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reauthorize" }),
    ).toBeInTheDocument();
    expect(toastMock.error).not.toHaveBeenCalledWith("Save failed");
  });

  it("shows a rate limit toast when SHOPLINE writes are throttled", async () => {
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
        ok: false,
        status: 429,
        json: async () => ({
          error: "shopline_rate_limited",
          retryAfter: 17,
        }),
      });

    render(<ShoplineProductsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByText("Product 1"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        "Too many operations. Try again in 17 seconds.",
      );
    });
  });

  it("shows a warning banner when the handle changes", async () => {
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
    fireEvent.change(screen.getByRole("textbox", { name: "Handle" }), {
      target: { value: "new-product-1" },
    });

    expect(
      screen.getByText(
        "Redirects are automatically created when a handle changes.",
      ),
    ).toBeInTheDocument();
  });

  it("disables save when the SEO description exceeds 160 characters", async () => {
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
    fireEvent.change(screen.getByRole("textbox", { name: "SEO description" }), {
      target: { value: "x".repeat(161) },
    });

    expect(screen.getByText("Description must be 160 characters or less"));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
