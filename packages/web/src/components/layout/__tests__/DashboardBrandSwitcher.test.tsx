import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardBrandSwitcher } from "../DashboardBrandSwitcher";

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  pathname: "/dashboard",
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: navigationMocks.push,
    refresh: navigationMocks.refresh,
  }),
  usePathname: () => navigationMocks.pathname,
  useSearchParams: () => navigationMocks.searchParams,
}));

describe("DashboardBrandSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigationMocks.pathname = "/dashboard";
    navigationMocks.searchParams = new URLSearchParams();
  });

  it("pushes the selected brand and refreshes dashboard widgets", () => {
    render(
      <DashboardBrandSwitcher
        brands={[
          { id: "brand-1", name: "Northwind" },
          { id: "brand-2", name: "Contoso" },
        ]}
        activeBrandId="brand-1"
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: /active brand/i }), {
      target: { value: "brand-2" },
    });

    expect(navigationMocks.push).toHaveBeenCalledWith(
      "/dashboard?brand=brand-2",
    );
    expect(navigationMocks.refresh).toHaveBeenCalledTimes(1);
  });
});
