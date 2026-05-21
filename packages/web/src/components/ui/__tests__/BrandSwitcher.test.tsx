import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BrandSwitcher } from "../brand-switcher";

describe("BrandSwitcher", () => {
  it("renders active brand and triggers switching", () => {
    const onSwitch = vi.fn();

    render(
      <BrandSwitcher
        brands={[
          { id: "brand-1", name: "Northwind" },
          { id: "brand-2", name: "Contoso" },
        ]}
        activeBrandId="brand-1"
        onSwitch={onSwitch}
      />,
    );

    expect(screen.getByRole("combobox", { name: /active brand/i })).toHaveValue(
      "brand-1",
    );

    fireEvent.change(screen.getByRole("combobox", { name: /active brand/i }), {
      target: { value: "brand-2" },
    });

    expect(onSwitch).toHaveBeenCalledWith("brand-2");
  });
});
