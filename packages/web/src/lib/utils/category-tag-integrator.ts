export interface CategorySelection {
  ids: number[];
  names: string[];
}

export interface TagSelection {
  ids: number[];
  names: string[];
}

export interface AISelectionResult {
  categories?: number[] | string[] | { id: number; name: string }[];
  tags?: number[] | string[] | { id: number; name: string }[];
  category?: number | string | { id: number; name: string };
  tag?: number | string | { id: number; name: string };
  categoryIds?: number[];
  tagIds?: number[];
}

const DEFAULT_CATEGORY_ID = 1;

function extractIds(
  input: number[] | string[] | { id: number; name: string }[] | undefined,
): number[] {
  if (!input || !Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (typeof item === "number") {
        return item;
      }
      if (typeof item === "string") {
        const parsed = parseInt(item, 10);
        return isNaN(parsed) ? null : parsed;
      }
      if (typeof item === "object" && item !== null && "id" in item) {
        return item.id;
      }
      return null;
    })
    .filter((id): id is number => id !== null && id > 0);
}

function extractSingleId(
  input: number | string | { id: number; name: string } | undefined,
): number | null {
  if (input === undefined || input === null) {
    return null;
  }

  if (typeof input === "number") {
    return input > 0 ? input : null;
  }

  if (typeof input === "string") {
    const parsed = parseInt(input, 10);
    return isNaN(parsed) || parsed <= 0 ? null : parsed;
  }

  if (typeof input === "object" && "id" in input) {
    return input.id > 0 ? input.id : null;
  }

  return null;
}

export function integrateCategorySelection(
  aiResult: AISelectionResult,
): number[] {
  if (aiResult.categoryIds && aiResult.categoryIds.length > 0) {
    return aiResult.categoryIds;
  }

  const fromCategories = extractIds(aiResult.categories);
  if (fromCategories.length > 0) {
    return fromCategories;
  }

  const singleCategory = extractSingleId(aiResult.category);
  if (singleCategory !== null) {
    return [singleCategory];
  }

  return [DEFAULT_CATEGORY_ID];
}

export function integrateTagSelection(aiResult: AISelectionResult): number[] {
  if (aiResult.tagIds && aiResult.tagIds.length > 0) {
    return aiResult.tagIds;
  }

  const fromTags = extractIds(aiResult.tags);
  if (fromTags.length > 0) {
    return fromTags;
  }

  const singleTag = extractSingleId(aiResult.tag);
  if (singleTag !== null) {
    return [singleTag];
  }

  return [];
}

export function integrateCategoryAndTagSelection(aiResult: AISelectionResult): {
  categoryIds: number[];
  tagIds: number[];
} {
  return {
    categoryIds: integrateCategorySelection(aiResult),
    tagIds: integrateTagSelection(aiResult),
  };
}

export function validateCategoryIds(
  selectedIds: number[],
  availableIds: number[],
): number[] {
  const validIds = selectedIds.filter((id) => availableIds.includes(id));

  if (validIds.length === 0 && availableIds.includes(DEFAULT_CATEGORY_ID)) {
    return [DEFAULT_CATEGORY_ID];
  }

  return validIds.length > 0 ? validIds : [];
}

export function validateTagIds(
  selectedIds: number[],
  availableIds: number[],
): number[] {
  return selectedIds.filter((id) => availableIds.includes(id));
}
