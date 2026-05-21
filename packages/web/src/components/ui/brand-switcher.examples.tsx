import { BrandSwitcher } from "./brand-switcher";

export function BrandSwitcherExample() {
  return (
    <BrandSwitcher
      brands={[
        { id: "brand-1", name: "Northwind" },
        { id: "brand-2", name: "Contoso" },
      ]}
      activeBrandId="brand-1"
      onSwitch={() => undefined}
    />
  );
}
