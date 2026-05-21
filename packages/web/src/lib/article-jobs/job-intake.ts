export type ArticleJobReservationStatus = "reserved" | "failed" | "not_needed";

export type ArticleJobSkipReason =
  | "duplicate_pending_job"
  | "duplicate_processing_job";

export type ArticleJobFailureReason =
  | "invalid_input"
  | "insufficient_quota"
  | "quota_reservation_failed"
  | "competitor_quota_exceeded"
  | "job_insert_failed"
  | "unknown";

export interface ArticleJobIntakeCreatedJob {
  id: string;
  keyword: string;
  title: string;
  reservationStatus: ArticleJobReservationStatus;
}

export interface ArticleJobIntakeSkippedJob {
  id: string;
  keyword: string;
  reason: ArticleJobSkipReason;
}

export interface ArticleJobIntakeFailedItem {
  keyword: string;
  reason: ArticleJobFailureReason;
  message: string;
}

export interface ArticleJobIntakeQuotaSummary {
  requiredArticles: number;
  reservedArticles: number;
  availableArticles: number;
}

export type ArticleJobDispatchStatus =
  | "not_needed"
  | "triggered"
  | "failed"
  | "skipped";

export interface ArticleJobIntakeDispatchSummary {
  attempted: boolean;
  status: ArticleJobDispatchStatus;
  message?: string;
}

export interface ArticleJobIntakeCounts {
  created: number;
  skipped: number;
  failed: number;
}

export interface ArticleJobIntakeResult {
  success: boolean;
  createdJobs: ArticleJobIntakeCreatedJob[];
  skippedJobs: ArticleJobIntakeSkippedJob[];
  failedItems: ArticleJobIntakeFailedItem[];
  counts: ArticleJobIntakeCounts;
  quota: ArticleJobIntakeQuotaSummary;
  dispatch: ArticleJobIntakeDispatchSummary;
}

export interface BuildArticleJobIntakeResultInput {
  createdJobs: ArticleJobIntakeCreatedJob[];
  skippedJobs: ArticleJobIntakeSkippedJob[];
  failedItems: ArticleJobIntakeFailedItem[];
  quota: ArticleJobIntakeQuotaSummary;
  dispatch: ArticleJobIntakeDispatchSummary;
}

export interface ArticleJobIntakeItem {
  keyword: string;
  title: string;
  metadata: {
    mode: string;
    title: string;
    industry: string | null;
    region: string | null;
    language: string | null;
    competitors: string[];
    writing_style: string | null;
    batchIndex?: number;
    totalBatch?: number;
    targetLanguage?: string;
    wordCount?: string;
    brandId?: string;
    brand_id?: string;
    sourceTrendSignalId?: string;
    topicTemplate?: string | null;
    structureTemplate?: string;
    translateLocales?: string[];
  };
}

export interface NormalizedArticleJobIntakeInput {
  items: ArticleJobIntakeItem[];
  websiteId: string | null;
  hasWebsiteIdField: boolean;
  brandId: string | null;
  hasBrandIdField: boolean;
}

export type ArticleJobInputNormalizationResult =
  | { success: true; data: NormalizedArticleJobIntakeInput }
  | {
      success: false;
      error: {
        code: "VALIDATION_ERROR";
        message: string;
      };
    };

export type ArticleJobBillingPolicy =
  | "fallback_to_user_id"
  | "ensure_personal_company";

export interface ArticleJobBillingUser {
  id: string;
  email?: string | null;
}

export interface ArticleJobCompanyRepository {
  findActiveMembershipCompanyId(userId: string): Promise<string | null>;
  companyExists(companyId: string): Promise<boolean>;
  findOwnedCompanyId(userId: string): Promise<string | null>;
  createPersonalCompany(input: {
    userId: string;
    name: string;
    slug: string;
  }): Promise<string>;
  upsertOwnerMembership(input: {
    companyId: string;
    userId: string;
  }): Promise<void>;
}

export type ArticleJobBillingSource =
  | "active_membership"
  | "user_id_fallback"
  | "owned_company"
  | "created_personal_company";

export interface ArticleJobBillingAccount {
  billingId: string;
  source: ArticleJobBillingSource;
  membershipUpserted: boolean;
}

export interface ResolveArticleJobBillingAccountInput {
  user: ArticleJobBillingUser;
  policy: ArticleJobBillingPolicy;
  repository: ArticleJobCompanyRepository;
  slugSuffix?: string;
}

export type ArticleJobWebsitePolicy =
  | "select_existing_or_none"
  | "ensure_default";

export interface ArticleJobWebsiteRepository {
  findFirstWebsiteId(companyId: string): Promise<string | null>;
  createDefaultWebsite(companyId: string): Promise<string>;
  createDefaultAgentConfig(websiteId: string): Promise<void>;
}

export type ArticleJobWebsiteSource =
  | "explicit"
  | "explicit_none"
  | "first_existing"
  | "none_available"
  | "created_default";

export interface ArticleJobWebsiteSelection {
  websiteId: string | null;
  source: ArticleJobWebsiteSource;
  createdDefaultWebsite: boolean;
}

export interface ResolveArticleJobWebsiteInput {
  billingId: string;
  requestedWebsiteId: string | null;
  hasWebsiteIdField: boolean;
  policy: ArticleJobWebsitePolicy;
  repository: ArticleJobWebsiteRepository;
}

export interface ExistingArticleJobForDuplicateCheck {
  id: string;
  status: "pending" | "processing";
}

export interface ArticleJobInsertRecord {
  id: string;
  jobId: string;
  companyId: string;
  websiteId: string | null;
  brandId: string;
  userId: string;
  keywords: string[];
  status: "pending";
  metadata: Record<string, unknown>;
}

export interface ArticleJobRecordRepository {
  findPendingOrProcessingJobs(companyId: string): Promise<
    Array<
      ExistingArticleJobForDuplicateCheck & {
        keywords: string[];
      }
    >
  >;
  insertArticleJob(input: ArticleJobInsertRecord): Promise<void>;
  updateArticleJobMetadata(
    jobId: string,
    metadata: Record<string, unknown>,
  ): Promise<void>;
  deleteArticleJob(jobId: string): Promise<void>;
}

export interface SplitDuplicateArticleJobItemsInput {
  items: ArticleJobIntakeItem[];
  existingJobsByKeyword: Map<string, ExistingArticleJobForDuplicateCheck>;
}

export interface SplitDuplicateArticleJobItemsResult {
  newItems: ArticleJobIntakeItem[];
  skippedJobs: ArticleJobIntakeSkippedJob[];
}

export function buildArticleJobIntakeResult(
  input: BuildArticleJobIntakeResultInput,
): ArticleJobIntakeResult {
  const counts = {
    created: input.createdJobs.length,
    skipped: input.skippedJobs.length,
    failed: input.failedItems.length,
  };

  return {
    ...input,
    counts,
    success: counts.failed === 0,
  };
}

export function hasRunnableArticleJobs(
  result: ArticleJobIntakeResult,
): boolean {
  return result.createdJobs.some((job) => job.reservationStatus === "reserved");
}

export function normalizeSingleArticleGenerationInput(
  body: Record<string, unknown>,
): ArticleJobInputNormalizationResult {
  const keyword = asNonEmptyString(body.keyword);
  const title = asNonEmptyString(body.title);
  const industry = asNonEmptyString(body.industry);
  const region = asNonEmptyString(body.region);
  const language = asNonEmptyString(body.language);
  const hasStrategyFields = Boolean(industry || region || language);

  if (hasStrategyFields && (!industry || !region || !language)) {
    return validationFailure(
      "Industry, region, and language are required together",
    );
  }

  const articleTitle = title || keyword || industry;
  if (!articleTitle) {
    return validationFailure("Title or industry is required");
  }

  const hasWebsiteIdField = Object.prototype.hasOwnProperty.call(
    body,
    "website_id",
  );
  const websiteId = hasWebsiteIdField
    ? asNonEmptyString(body.website_id) || null
    : null;
  const competitors = Array.isArray(body.competitors)
    ? body.competitors.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  const writingStyle = asNonEmptyString(body.writing_style);
  const mode = asNonEmptyString(body.mode) || "single";
  const wordCount = asNonEmptyString(body.wordCount);
  const sourceTrendSignalId = asNonEmptyString(body.sourceTrendSignalId);
  const topicTemplate = asNonEmptyString(body.topicTemplate);
  const structureTemplate = asNonEmptyString(body.structureTemplate);
  const translateLocales = asStringArray(body.translateLocales);
  const hasBrandIdField =
    Object.prototype.hasOwnProperty.call(body, "brandId") ||
    Object.prototype.hasOwnProperty.call(body, "brand_id");
  const brandId =
    asNonEmptyString(body.brandId) || asNonEmptyString(body.brand_id);

  return {
    success: true,
    data: {
      items: [
        {
          keyword: articleTitle,
          title: articleTitle,
          metadata: {
            mode,
            title: articleTitle,
            industry: industry || null,
            region: region || null,
            language: language || null,
            competitors,
            writing_style: writingStyle || null,
            ...(wordCount ? { wordCount } : {}),
            ...(sourceTrendSignalId ? { sourceTrendSignalId } : {}),
            ...(topicTemplate ? { topicTemplate } : {}),
            ...(structureTemplate ? { structureTemplate } : {}),
            ...(translateLocales.length > 0 ? { translateLocales } : {}),
            ...(brandId ? { brandId, brand_id: brandId } : {}),
          },
        },
      ],
      websiteId,
      hasWebsiteIdField,
      brandId,
      hasBrandIdField,
    },
  };
}

export function normalizeBatchArticleGenerationInput(
  body: Record<string, unknown>,
): ArticleJobInputNormalizationResult {
  const rawItems = normalizeRawBatchItems(body);

  if (rawItems.length === 0) {
    return validationFailure("Items or keywords array is required");
  }

  for (const item of rawItems) {
    if (!item.keyword) {
      return validationFailure("Each item must include keyword or title");
    }
    if (item.keyword.length > 500) {
      return validationFailure("Keyword length cannot exceed 500 characters");
    }
  }

  const options = isRecord(body.options) ? body.options : {};
  const targetLanguage =
    asNonEmptyString(body.targetLanguage) ||
    asNonEmptyString(options.targetLanguage) ||
    "zh-TW";
  const region =
    asNonEmptyString(body.region) || asNonEmptyString(options.region);
  const industry =
    asNonEmptyString(body.industry) || asNonEmptyString(options.industry);
  const wordCount =
    asNonEmptyString(options.wordCount) ||
    asNonEmptyString(body.wordCount) ||
    "1500";
  const writingStyle =
    asNonEmptyString(body.writing_style) ||
    asNonEmptyString(options.writing_style);
  const hasWebsiteIdField = Object.prototype.hasOwnProperty.call(
    body,
    "website_id",
  );
  const websiteId = hasWebsiteIdField
    ? asNonEmptyString(body.website_id) || null
    : null;
  const hasBrandIdField =
    Object.prototype.hasOwnProperty.call(body, "brandId") ||
    Object.prototype.hasOwnProperty.call(body, "brand_id") ||
    Object.prototype.hasOwnProperty.call(options, "brandId") ||
    Object.prototype.hasOwnProperty.call(options, "brand_id");
  const brandId =
    asNonEmptyString(body.brandId) ||
    asNonEmptyString(body.brand_id) ||
    asNonEmptyString(options.brandId) ||
    asNonEmptyString(options.brand_id);

  return {
    success: true,
    data: {
      items: rawItems.map((item, index) => ({
        keyword: item.keyword,
        title: item.title,
        metadata: {
          mode: "batch",
          title: item.title,
          industry: industry || null,
          region: region || null,
          language: null,
          competitors: [],
          writing_style: writingStyle || null,
          batchIndex: index,
          totalBatch: rawItems.length,
          targetLanguage,
          wordCount,
          ...(brandId ? { brandId, brand_id: brandId } : {}),
        },
      })),
      websiteId,
      hasWebsiteIdField,
      brandId,
      hasBrandIdField,
    },
  };
}

export async function resolveArticleJobBillingAccount({
  user,
  policy,
  repository,
  slugSuffix = String(Date.now()),
}: ResolveArticleJobBillingAccountInput): Promise<ArticleJobBillingAccount> {
  const membershipCompanyId = await repository.findActiveMembershipCompanyId(
    user.id,
  );

  if (
    membershipCompanyId &&
    (await repository.companyExists(membershipCompanyId))
  ) {
    return {
      billingId: membershipCompanyId,
      source: "active_membership",
      membershipUpserted: false,
    };
  }

  if (policy === "fallback_to_user_id") {
    return {
      billingId: user.id,
      source: "user_id_fallback",
      membershipUpserted: false,
    };
  }

  const ownedCompanyId = await repository.findOwnedCompanyId(user.id);
  if (ownedCompanyId) {
    await repository.upsertOwnerMembership({
      companyId: ownedCompanyId,
      userId: user.id,
    });
    return {
      billingId: ownedCompanyId,
      source: "owned_company",
      membershipUpserted: true,
    };
  }

  const ownerName = getPersonalCompanyName(user);
  const companyId = await repository.createPersonalCompany({
    userId: user.id,
    name: ownerName,
    slug: `${slugifySegment(ownerName)}-${slugSuffix}`,
  });
  await repository.upsertOwnerMembership({
    companyId,
    userId: user.id,
  });

  return {
    billingId: companyId,
    source: "created_personal_company",
    membershipUpserted: true,
  };
}

export async function resolveArticleJobWebsite({
  billingId,
  requestedWebsiteId,
  hasWebsiteIdField,
  policy,
  repository,
}: ResolveArticleJobWebsiteInput): Promise<ArticleJobWebsiteSelection> {
  if (hasWebsiteIdField) {
    return {
      websiteId: requestedWebsiteId,
      source: requestedWebsiteId ? "explicit" : "explicit_none",
      createdDefaultWebsite: false,
    };
  }

  const existingWebsiteId = await repository.findFirstWebsiteId(billingId);
  if (existingWebsiteId) {
    return {
      websiteId: existingWebsiteId,
      source: "first_existing",
      createdDefaultWebsite: false,
    };
  }

  if (policy === "select_existing_or_none") {
    return {
      websiteId: null,
      source: "none_available",
      createdDefaultWebsite: false,
    };
  }

  const websiteId = await repository.createDefaultWebsite(billingId);
  await repository.createDefaultAgentConfig(websiteId);

  return {
    websiteId,
    source: "created_default",
    createdDefaultWebsite: true,
  };
}

export function splitDuplicateArticleJobItems({
  items,
  existingJobsByKeyword,
}: SplitDuplicateArticleJobItemsInput): SplitDuplicateArticleJobItemsResult {
  const newItems: ArticleJobIntakeItem[] = [];
  const skippedJobs: ArticleJobIntakeSkippedJob[] = [];

  for (const item of items) {
    const existing = existingJobsByKeyword.get(item.keyword);
    if (!existing) {
      newItems.push(item);
      continue;
    }

    skippedJobs.push({
      id: existing.id,
      keyword: item.keyword,
      reason:
        existing.status === "processing"
          ? "duplicate_processing_job"
          : "duplicate_pending_job",
    });
  }

  return {
    newItems,
    skippedJobs,
  };
}

function validationFailure(
  message: string,
): Extract<ArticleJobInputNormalizationResult, { success: false }> {
  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message,
    },
  };
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
}

function normalizeRawBatchItems(
  body: Record<string, unknown>,
): Array<{ keyword: string; title: string }> {
  if (Array.isArray(body.items)) {
    return body.items
      .map((item) => {
        if (!isRecord(item)) return null;
        const keyword =
          asNonEmptyString(item.keyword) || asNonEmptyString(item.title);
        if (!keyword) return { keyword: "", title: "" };
        return {
          keyword,
          title: asNonEmptyString(item.title) || keyword,
        };
      })
      .filter(
        (item): item is { keyword: string; title: string } => item !== null,
      );
  }

  if (Array.isArray(body.keywords)) {
    return body.keywords.map((keyword) => {
      const value = asNonEmptyString(keyword) || "";
      return {
        keyword: value,
        title: value,
      };
    });
  }

  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPersonalCompanyName(user: ArticleJobBillingUser): string {
  const localPart = user.email?.split("@")[0];
  return localPart && localPart.trim().length > 0 ? localPart : "user";
}

function slugifySegment(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "user";
}
