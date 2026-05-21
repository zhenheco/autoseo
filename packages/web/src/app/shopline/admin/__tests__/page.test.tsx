import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ShoplineAdminPage from "../page";

function props(shop?: string) {
  return {
    searchParams: Promise.resolve(shop ? { shop } : {}),
  };
}

describe("ShoplineAdminPage", () => {
  it("renders without auth and defaults to demo shop", async () => {
    render(await ShoplineAdminPage(props()));

    expect(
      screen.getByRole("heading", { name: "1waySEO Connector" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open 1waySEO Dashboard →" }),
    ).toHaveAttribute("href", "https://1wayseo.com/dashboard?shop=demo");
  });

  it("renders with shop param in dashboard link", async () => {
    render(await ShoplineAdminPage(props("brand123")));

    expect(
      screen.getByRole("link", { name: "Open 1waySEO Dashboard →" }),
    ).toHaveAttribute("href", "https://1wayseo.com/dashboard?shop=brand123");
  });

  it("opens the dashboard link in the top window", async () => {
    render(await ShoplineAdminPage(props("brand123")));

    expect(
      screen.getByRole("link", { name: "Open 1waySEO Dashboard →" }),
    ).toHaveAttribute("target", "_top");
  });

  it("shows privacy policy and FAQ links", async () => {
    render(await ShoplineAdminPage(props("brand123")));

    expect(
      screen.getByRole("link", { name: "View Privacy Policy" }),
    ).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute(
      "href",
      "/faq",
    );
  });
});
