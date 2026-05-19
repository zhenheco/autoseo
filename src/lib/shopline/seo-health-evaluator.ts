export type SeoHealthFlag =
  | "missing_seo_title"
  | "seo_title_too_long"
  | "missing_seo_description"
  | "seo_description_too_long"
  | "missing_alt"
  | "duplicate_title";

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
