import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShoplineRedirectsPanel } from "../ShoplineRedirectsPanel";

const fetchMock = vi.fn();
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      "redirects.title": "SHOPLINE Redirects",
      "redirects.empty": "No redirects",
      "redirects.add": "Add",
      "redirects.delete": "Delete",
      "redirects.column.entityType": "Type",
      "redirects.column.handleFrom": "From",
      "redirects.column.handleTo": "To",
      "redirects.column.createdAt": "Created",
      "redirects.column.hitCount": "Hits",
      "redirects.entityType.product": "Product",
      "redirects.entityType.collection": "Collection",
      "redirects.entityType.page": "Page",
      "redirects.warning.autoCreated":
        "Redirects are automatically created when a handle changes.",
      "edit.save": "Save",
      "edit.cancel": "Cancel",
      "toast.saveSuccess": "Saved",
      "toast.saveError": "Save failed",
    };

    return messages[key] ?? key;
  },
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

describe("ShoplineRedirectsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("loads redirects with GET and renders rows", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        redirects: [
          {
            id: "redirect-1",
            entity_type: "product",
            handle_from: "old-product",
            handle_to: "new-product",
            created_at: "2026-05-20T00:00:00.000Z",
            hit_count: 4,
          },
        ],
      }),
    });

    render(<ShoplineRedirectsPanel websiteId="website-1" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/shopline/website-1/redirects",
      );
    });
    expect(await screen.findByText("old-product")).toBeInTheDocument();
    expect(screen.getByText("new-product")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("opens add modal and submits POST", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ redirects: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ redirects: [] }),
      });

    render(<ShoplineRedirectsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Add" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Type" }), {
      target: { value: "collection" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "From" }), {
      target: { value: "old-collection" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "To" }), {
      target: { value: "new-collection" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/shopline/website-1/redirects",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "collection",
          handleFrom: "old-collection",
          handleTo: "new-collection",
        }),
      },
    );
  });

  it("deletes a redirect with DELETE", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          redirects: [
            {
              id: "redirect-1",
              entity_type: "page",
              handle_from: "old-page",
              handle_to: "new-page",
              created_at: "2026-05-20T00:00:00.000Z",
              hit_count: 0,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ redirects: [] }),
      });

    render(<ShoplineRedirectsPanel websiteId="website-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/shopline/website-1/redirects/redirect-1",
      { method: "DELETE" },
    );
  });
});
