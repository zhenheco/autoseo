import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShoplineCollectionsPanel } from "../ShoplineCollectionsPanel";

const fetchMock = vi.fn();
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const messages: Record<string, string> = {
      "collections.title": "SHOPLINE Collections",
      "collections.empty": "No collections",
      "collections.column.title": "Collection title",
      "collections.column.handle": "Handle",
      "collections.column.seoTitle": "SEO title",
      "collections.column.productsCount": "Products",
      "products.column.notSet": "Not set",
      "edit.collection.title": "Edit collection SEO",
      "edit.collection.titleLabel": "Collection title",
      "edit.collection.seoTitleLabel": "SEO title",
      "edit.collection.seoDescriptionLabel": "SEO description",
      "edit.collection.handleLabel": "Handle",
      "redirects.warning.autoCreated":
        "Redirects are automatically created when a handle changes.",
      "edit.charLimitExceeded": "Description must be 160 characters or less",
      "edit.charCount": `${values?.count ?? 0}/70`,
      "edit.save": "Save",
      "edit.cancel": "Cancel",
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

describe("ShoplineCollectionsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("loads collections with GET and renders collection rows", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        collections: [
          {
            id: "collection-1",
            title: "Summer Collection",
            handle: "summer",
            products_count: 12,
            seo: { title: "Summer SEO" },
          },
        ],
      }),
    });

    render(<ShoplineCollectionsPanel websiteId="website-1" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/shopline/website-1/collections",
      );
    });
    expect(await screen.findByText("Summer Collection")).toBeInTheDocument();
    expect(screen.getByText("summer")).toBeInTheDocument();
    expect(screen.getByText("Summer SEO")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("submits PATCH from the edit modal and updates the row", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          collections: [
            {
              id: "collection-1",
              title: "Summer Collection",
              handle: "summer",
              seo: { title: "Summer SEO" },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "collection-1",
          title: "Updated Collection",
          handle: "summer",
          seo: { title: "Updated SEO" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          collections: [
            {
              id: "collection-1",
              title: "Updated Collection",
              handle: "summer",
              seo: { title: "Updated SEO" },
            },
          ],
        }),
      });

    render(<ShoplineCollectionsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByText("Summer Collection"));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Collection title" }),
      {
        target: { value: "Updated Collection" },
      },
    );
    fireEvent.change(screen.getByRole("textbox", { name: "SEO title" }), {
      target: { value: "Updated SEO" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/shopline/website-1/collections/collection-1/seo",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Updated Collection",
          seo: { title: "Updated SEO", description: "" },
          handle: "summer",
        }),
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/shopline/website-1/collections",
    );
    expect(await screen.findByText("Updated Collection")).toBeInTheDocument();
    expect(toastMock.success).toHaveBeenCalledWith("Saved");
  });

  it("shows a warning banner when the handle changes", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        collections: [
          {
            id: "collection-1",
            title: "Summer Collection",
            handle: "summer",
            seo: { title: "Summer SEO" },
          },
        ],
      }),
    });

    render(<ShoplineCollectionsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByText("Summer Collection"));
    fireEvent.change(screen.getByRole("textbox", { name: "Handle" }), {
      target: { value: "summer-sale" },
    });

    expect(
      screen.getByText(
        "Redirects are automatically created when a handle changes.",
      ),
    ).toBeInTheDocument();
  });
});
