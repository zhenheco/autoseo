import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShoplineSeoTabs } from "../ShoplineSeoTabs";

vi.mock("../ShoplineProductsPanel", () => ({
  ShoplineProductsPanel: () => <div>Products panel</div>,
}));

vi.mock("../ShoplineCollectionsPanel", () => ({
  ShoplineCollectionsPanel: () => <div>Collections panel</div>,
}));

vi.mock("../ShoplineRedirectsPanel", () => ({
  ShoplineRedirectsPanel: () => <div>Redirects panel</div>,
}));

vi.mock("../ShoplineShopPanel", () => ({
  ShoplineShopPanel: () => <div>Shop panel</div>,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      "tabs.products": "Products",
      "tabs.collections": "Collections",
      "tabs.redirects": "Redirects",
      "tabs.shop": "Shop",
    };

    return messages[key] ?? key;
  },
}));

describe("ShoplineSeoTabs", () => {
  it("renders products, collections, and redirects tabs", () => {
    render(<ShoplineSeoTabs websiteId="website-1" />);

    expect(screen.getByRole("tab", { name: "Products" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Collections" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Redirects" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Shop" })).toBeInTheDocument();
    expect(screen.getByText("Products panel")).toBeInTheDocument();
  });
});
