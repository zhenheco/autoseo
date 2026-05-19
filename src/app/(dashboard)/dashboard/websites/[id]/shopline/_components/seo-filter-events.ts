export type ShoplineSeoFilter =
  | "missing-seo"
  | "missing-alt"
  | "title-too-long"
  | "description-too-long"
  | "duplicate-title";

export const SHOPLINE_SEO_FILTER_EVENT = "shopline-seo-filter-change";
export const SHOPLINE_SEO_FILTER_QUERY_PARAM = "filter";

const productFilters: ShoplineSeoFilter[] = [
  "missing-seo",
  "missing-alt",
  "title-too-long",
  "description-too-long",
  "duplicate-title",
];

const collectionFilters: ShoplineSeoFilter[] = [
  "missing-seo",
  "title-too-long",
  "description-too-long",
  "duplicate-title",
];

export function getSeoFilterOptions(
  entityType: "product" | "collection",
): ShoplineSeoFilter[] {
  return entityType === "product" ? productFilters : collectionFilters;
}

export function normalizeShoplineSeoFilter(
  value: string | null | undefined,
  entityType: "product" | "collection",
): ShoplineSeoFilter | "" {
  if (!value) return "";

  const options = getSeoFilterOptions(entityType);
  return options.includes(value as ShoplineSeoFilter)
    ? (value as ShoplineSeoFilter)
    : "";
}

export function readShoplineSeoFilterFromUrl(
  entityType: "product" | "collection",
): ShoplineSeoFilter | "" {
  if (typeof window === "undefined") return "";

  return normalizeShoplineSeoFilter(
    new URLSearchParams(window.location.search).get(
      SHOPLINE_SEO_FILTER_QUERY_PARAM,
    ),
    entityType,
  );
}

export function updateShoplineSeoFilterUrl(filter: ShoplineSeoFilter | "") {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  if (filter) {
    url.searchParams.set(SHOPLINE_SEO_FILTER_QUERY_PARAM, filter);
  } else {
    url.searchParams.delete(SHOPLINE_SEO_FILTER_QUERY_PARAM);
  }

  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

export function dispatchShoplineSeoFilterChange(filter: ShoplineSeoFilter) {
  updateShoplineSeoFilterUrl(filter);
  window.dispatchEvent(
    new CustomEvent(SHOPLINE_SEO_FILTER_EVENT, {
      detail: { filter },
    }),
  );
}
