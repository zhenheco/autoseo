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

  if (input.issue.ruleId !== "meta.description.tooShort") {
    return failure(input.issue.current, "", "rule_not_supported");
  }

  try {
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
  } catch (error) {
    return failure(input.issue.current, "", errorMessage(error));
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
