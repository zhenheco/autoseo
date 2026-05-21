"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BrandSwitcher } from "@/components/ui/brand-switcher";

interface DashboardBrandSwitcherProps {
  brands: { id: string; name: string }[];
  activeBrandId: string | null;
}

export function DashboardBrandSwitcher({
  brands,
  activeBrandId,
}: DashboardBrandSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (brands.length === 0) return null;

  const brandFromQuery = searchParams.get("brand");
  const fallbackBrandId = activeBrandId ?? brands[0]?.id;
  if (!fallbackBrandId) return null;

  const activeId =
    brandFromQuery && brands.some((brand) => brand.id === brandFromQuery)
      ? brandFromQuery
      : fallbackBrandId;

  function handleSwitch(nextBrandId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("brand", nextBrandId);
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  return (
    <BrandSwitcher
      brands={brands}
      activeBrandId={activeId}
      onSwitch={handleSwitch}
      className="static z-auto hidden border-0 bg-transparent p-0 md:flex"
    />
  );
}
