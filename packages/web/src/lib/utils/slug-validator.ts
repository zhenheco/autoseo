export interface SlugValidationResult {
  original: string;
  validated: string;
  wasModified: boolean;
  modifications: string[];
}

const SUFFIX_MAP: Record<string, string[]> = {
  interior: ["design", "tips", "ideas", "guide"],
  food: ["guide", "spots", "best", "review"],
  travel: ["guide", "tips", "plan", "itinerary"],
  tech: ["guide", "review", "comparison", "tips"],
  fashion: ["trends", "guide", "tips", "style"],
  health: ["guide", "tips", "advice", "facts"],
  finance: ["guide", "tips", "strategies", "advice"],
  education: ["guide", "resources", "tips", "courses"],
  default: ["guide", "tips", "complete", "overview"],
};

const MIN_SLUG_LENGTH = 15;
const MAX_SLUG_LENGTH = 30;

function cleanSlug(slug: string): string {
  return slug
    .replace(/['"]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getSuffixForIndustry(industry?: string): string {
  if (industry) {
    const lowerIndustry = industry.toLowerCase();
    for (const [key, suffixes] of Object.entries(SUFFIX_MAP)) {
      if (lowerIndustry.includes(key)) {
        const randomIndex = Math.floor(Math.random() * suffixes.length);
        return suffixes[randomIndex];
      }
    }
  }

  const defaultSuffixes = SUFFIX_MAP.default;
  const randomIndex = Math.floor(Math.random() * defaultSuffixes.length);
  return defaultSuffixes[randomIndex];
}

function truncateToLastHyphen(slug: string, maxLength: number): string {
  if (slug.length <= maxLength) {
    return slug;
  }

  const truncated = slug.substring(0, maxLength);
  const lastHyphenIndex = truncated.lastIndexOf("-");

  if (lastHyphenIndex > maxLength * 0.5) {
    return truncated.substring(0, lastHyphenIndex);
  }

  return truncated;
}

export function validateAndAdjustSlug(
  slug: string,
  options?: { industry?: string },
): SlugValidationResult {
  const modifications: string[] = [];
  let validated = slug;

  const cleaned = cleanSlug(slug);
  if (cleaned !== slug) {
    modifications.push("cleaned-special-chars");
    validated = cleaned;
  }

  if (validated.length < MIN_SLUG_LENGTH) {
    const suffix = getSuffixForIndustry(options?.industry);
    validated = `${validated}-${suffix}`;
    modifications.push(`added-suffix-${suffix}`);
  }

  if (validated.length > MAX_SLUG_LENGTH) {
    const truncated = truncateToLastHyphen(validated, MAX_SLUG_LENGTH);
    if (truncated !== validated) {
      modifications.push("truncated-to-last-hyphen");
      validated = truncated;
    }
  }

  if (validated.length < MIN_SLUG_LENGTH) {
    const suffix = getSuffixForIndustry(options?.industry);
    validated = `${validated}-${suffix}`;
    modifications.push(`added-additional-suffix-${suffix}`);
  }

  return {
    original: slug,
    validated,
    wasModified: modifications.length > 0,
    modifications,
  };
}

export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== "string") {
    return false;
  }

  if (slug.length < MIN_SLUG_LENGTH || slug.length > MAX_SLUG_LENGTH) {
    return false;
  }

  const validPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return validPattern.test(slug);
}

export function generateSlugFromTitle(
  title: string,
  options?: { industry?: string },
): string {
  const slug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const result = validateAndAdjustSlug(slug, options);
  return result.validated;
}
