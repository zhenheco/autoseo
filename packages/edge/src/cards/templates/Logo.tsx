import type { CSSProperties } from "react";
import { brandLogoUrl } from "./helpers";
import type { Brand } from "../types";

export function LogoMark({
  brand,
  style,
}: {
  brand: Brand;
  style?: CSSProperties;
}) {
  const logoUrl = brandLogoUrl(brand);
  if (!logoUrl) return null;

  return (
    <img
      src={logoUrl}
      alt={`${brand.name} logo`}
      style={{
        display: "block",
        maxWidth: 180,
        maxHeight: 76,
        objectFit: "contain",
        ...style,
      }}
    />
  );
}
