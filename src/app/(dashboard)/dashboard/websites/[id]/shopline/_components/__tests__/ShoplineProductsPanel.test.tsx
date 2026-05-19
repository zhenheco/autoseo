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
      "edit.seoTitleLabel": "SEO title",
      "edit.seoDescriptionLabel": "SEO description",
      "edit.handleLabel": "Handle",
      "edit.handleChangeWarning":
        "⚠️ Changing URL slug may cause old links to 404. Slice 6 will add automatic 301 redirects.",
      "edit.charLimitExceeded": "Description must be 160 characters or less",
      "edit.charCount": `${values?.count ?? 0}/70`,
      "edit.save": "Save",
      "edit.cancel": "Cancel",
      "edit.images.altLabel": "Alt text",
      "edit.images.altPlaceholder": "Describe this image",
      "edit.images.save": "Save",
      "edit.images.empty": "No product images",
      "edit.images.imageNumber": `Image ${values?.number ?? 0}`,
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
    expect(screen.getByRole("textbox", { name: "SEO title" })).toHaveValue(
      "Original SEO title",
    );
    expect(screen.getByText("18/70")).toBeInTheDocument();
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
        }),
      },
    );
    expect(await screen.findByText("Updated SEO title")).toBeInTheDocument();
    expect(toastMock.success).toHaveBeenCalledWith("Saved");
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
        }),
      },
    );
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
        "⚠️ Changing URL slug may cause old links to 404. Slice 6 will add automatic 301 redirects.",
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
