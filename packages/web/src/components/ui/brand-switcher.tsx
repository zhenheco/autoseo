"use client";

import { cn } from "@/lib/utils";

export interface BrandSwitcherProps {
  brands: { id: string; name: string }[];
  activeBrandId: string;
  onSwitch(id: string): void;
}

export function BrandSwitcher({
  brands,
  activeBrandId,
  onSwitch,
}: BrandSwitcherProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-header flex items-center gap-2 border-b",
        "border-border-subtle bg-bg-surface px-4 py-3",
      )}
    >
      <label htmlFor="brand-switcher" className="sr-only">
        Active brand
      </label>
      <select
        id="brand-switcher"
        value={activeBrandId}
        className={cn(
          "h-9 min-w-48 rounded-md border border-input bg-background px-3",
          "text-small font-medium text-text-primary shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        onChange={(event) => onSwitch(event.target.value)}
      >
        {brands.map((brand) => (
          <option key={brand.id} value={brand.id}>
            {brand.name}
          </option>
        ))}
      </select>
    </div>
  );
}
