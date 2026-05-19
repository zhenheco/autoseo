import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShoplineSeoTabs } from "../ShoplineSeoTabs";

vi.mock("../ShoplineProductsPanel", () => ({
  ShoplineProductsPanel: () => <div>Products panel</div>,
}));

vi.mock("../ShoplineCollectionsPanel", () => ({
  ShoplineCollectionsPanel: () => <div>Collections panel</div>,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      "tabs.products": "Products",
      "tabs.collections": "Collections",
    };

    return messages[key] ?? key;
  },
}));

describe("ShoplineSeoTabs", () => {
  it("renders products and collections tabs", () => {
    render(<ShoplineSeoTabs websiteId="website-1" />);

    expect(screen.getByRole("tab", { name: "Products" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Collections" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Products panel")).toBeInTheDocument();
  });
});
