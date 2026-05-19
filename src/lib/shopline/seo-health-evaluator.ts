export type SeoHealthFlag =
  | "missing_seo_title"
  | "seo_title_too_long"
  | "missing_seo_description"
  | "seo_description_too_long"
  | "missing_alt"
  | "duplicate_title";

export type SeoHealthFilter =
  | "missing-seo"
  | "missing-alt"
  | "title-too-long"
  | "description-too-long"
  | "duplicate-title";

export interface SeoHealthInput {
  entityType: "product" | "collection";
  entity: {
    title?: string;
    seo?: { title?: string; description?: string };
    images?: Array<{ id: string; alt?: string | null }>;
  };
}

export function evaluateSeoHealth(input: SeoHealthInput): SeoHealthFlag[] {
  const flags: SeoHealthFlag[] = [];
  const seoTitle = input.entity.seo?.title;
  const seoDescription = input.entity.seo?.description;

  if (!seoTitle || seoTitle.length === 0) {
    flags.push("missing_seo_title");
  } else if (seoTitle.length > 70) {
    flags.push("seo_title_too_long");
  }

  if (!seoDescription || seoDescription.length === 0) {
    flags.push("missing_seo_description");
  } else if (seoDescription.length > 160) {
    flags.push("seo_description_too_long");
  }

  if (
    input.entityType === "product" &&
    input.entity.images?.some((image) => !image.alt || image.alt.length === 0)
  ) {
    flags.push("missing_alt");
  }

  return flags;
}

export function evaluateBatchSeoHealth(
  items: Array<SeoHealthInput & { id: string }>,
): Map<string, SeoHealthFlag[]> {
  const titleCounts = new Map<string, number>();

  for (const item of items) {
    const title = item.entity.title;
    if (!title || title.length === 0) continue;
    titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
  }

  return new Map(
    items.map((item) => {
      const flags = evaluateSeoHealth(item);
      const title = item.entity.title;

      if (title && (titleCounts.get(title) ?? 0) >= 2) {
        flags.push("duplicate_title");
      }

      return [item.id, flags];
    }),
  );
}

export function matchesSeoHealthFilter(
  flags: SeoHealthFlag[],
  filter: string | null | undefined,
  options: { includeMissingAlt?: boolean } = {},
): boolean | null {
  if (!filter) return null;

  switch (filter) {
    case "missing-seo":
      return (
        flags.includes("missing_seo_title") ||
        flags.includes("missing_seo_description")
      );
    case "missing-alt":
      if (options.includeMissingAlt === false) return null;
      return flags.includes("missing_alt");
    case "title-too-long":
      return flags.includes("seo_title_too_long");
    case "description-too-long":
      return flags.includes("seo_description_too_long");
    case "duplicate-title":
      return flags.includes("duplicate_title");
    default:
      return null;
  }
}
