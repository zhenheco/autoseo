import type { AuditIssue } from "./types";

export interface ApplyShoplineFixDeps {
  shoplineUpdate: (input: ApplyShoplineFixInput) => Promise<{
    productId?: string;
    collectionId?: string;
    seo?: { title?: string; description?: string };
    image?: { id: string; alt: string };
  }>;
  generateMetaDescription: (input: {
    current: string;
    pageUrl: string;
  }) => Promise<string>;
  generateImageAlt: (input: { imageUrl: string }) => Promise<string>;
  getShopHandleForReport: (reportId: string) => Promise<string | null>;
}

export interface ApplyShoplineFixInput {
  issue: AuditIssue;
  reportId: string;
  shopHandle: string;
}

export interface ApplyShoplineFixResult {
  ok: boolean;
  route: "shopline-editor";
  before: string;
  after: string;
  error?: string;
}

export async function applyAuditFixToShopline(
  input: ApplyShoplineFixInput,
  deps: ApplyShoplineFixDeps,
): Promise<ApplyShoplineFixResult> {
  const shopHandle =
    input.shopHandle.trim() ||
    (await deps.getShopHandleForReport(input.reportId)) ||
    "";

  if (!shopHandle) {
    return failure(input.issue.current, "", "shopline_handle_not_found");
  }

  try {
    switch (input.issue.ruleId) {
      case "meta.description.tooShort":
        return await applyMetaDescriptionFix(input, deps, shopHandle);
      case "og.image.missing":
        return await applyOgImageFix(input, deps, shopHandle);
      case "alt.missing":
        return await applyImageAltFix(input, deps, shopHandle);
      default:
        return failure(input.issue.current, "", "rule_not_supported");
    }
  } catch (error) {
    return failure(input.issue.current, "", errorMessage(error));
  }
}

async function applyImageAltFix(
  input: ApplyShoplineFixInput,
  deps: ApplyShoplineFixDeps,
  shopHandle: string,
): Promise<ApplyShoplineFixResult> {
  const imageUrl = resolveImageUrl(input.issue);
  const generatedAlt = await deps.generateImageAlt({ imageUrl });
  const normalizedAlt = generatedAlt.trim();
  const updated = await deps.shoplineUpdate({
    ...input,
    shopHandle,
    issue: {
      ...input.issue,
      suggested: normalizedAlt,
    },
  });

  return {
    ok: true,
    route: "shopline-editor",
    before: input.issue.current,
    after: updated.image?.alt ?? normalizedAlt,
  };
}

async function applyMetaDescriptionFix(
  input: ApplyShoplineFixInput,
  deps: ApplyShoplineFixDeps,
  shopHandle: string,
): Promise<ApplyShoplineFixResult> {
  const suggestion = await deps.generateMetaDescription({
    current: input.issue.current,
    pageUrl: input.issue.page,
  });
  const normalizedSuggestion = suggestion.trim();
  const updated = await deps.shoplineUpdate({
    ...input,
    shopHandle,
    issue: {
      ...input.issue,
      suggested: normalizedSuggestion,
    },
  });

  return {
    ok: true,
    route: "shopline-editor",
    before: input.issue.current,
    after: updated.seo?.description ?? normalizedSuggestion,
  };
}

async function applyOgImageFix(
  input: ApplyShoplineFixInput,
  deps: ApplyShoplineFixDeps,
  shopHandle: string,
): Promise<ApplyShoplineFixResult> {
  const fallbackImage = resolveOgImageFallback(input.issue);
  const updated = await deps.shoplineUpdate({
    ...input,
    shopHandle,
    issue: {
      ...input.issue,
      suggested: fallbackImage,
    },
  });

  return {
    ok: true,
    route: "shopline-editor",
    before: input.issue.current,
    after: updated.image?.alt ?? fallbackImage,
  };
}

function resolveOgImageFallback(issue: AuditIssue): string {
  const suggestedRecord = parseJsonRecord(issue.suggested);
  const candidates = [
    suggestedRecord?.siteLogo,
    suggestedRecord?.logo,
    suggestedRecord?.firstContentImage,
    suggestedRecord?.imageUrl,
    suggestedRecord?.url,
    issue.suggested,
    issue.current,
    ...extractUrls(issue.selector ?? ""),
  ];
  const imageUrl = candidates.find(isUsableUrl);
  if (imageUrl) return imageUrl;

  try {
    return new URL("/favicon.ico", issue.page).href;
  } catch {
    return "";
  }
}

function parseJsonRecord(value: string | undefined): Record<string, unknown> | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function extractUrls(value: string): string[] {
  return Array.from(value.matchAll(/https?:\/\/[^\s"'<>]+/g), ([match]) => match);
}

function isUsableUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function resolveImageUrl(issue: AuditIssue): string {
  const selectorSrc = issue.selector?.match(/img\[src="([^"]+)"\]/)?.[1];
  const candidate =
    selectorSrc ?? extractUrls(issue.current)[0] ?? extractUrls(issue.page)[0];

  if (!candidate) return "";

  try {
    return new URL(candidate, issue.page).href;
  } catch {
    return candidate;
  }
}

function failure(
  before: string,
  after: string,
  error: string,
): ApplyShoplineFixResult {
  return {
    ok: false,
    route: "shopline-editor",
    before,
    after,
    error,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
