import { createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { Hero, List, Quote, Stat } from "./templates";
import { brandLogoUrl } from "./templates/helpers";
import type {
  Brand,
  CardFormat,
  CardSize,
  CardTemplateProps,
  CardTemplateName,
  GeneratedArticle,
} from "./types";

export type { Brand, GeneratedArticle } from "./types";

const MAX_CARDS_PER_ARTICLE = 4;
const R2_BUCKET_NAME = "card-assets";

const FORMAT_SIZES: Record<CardFormat, CardSize> = {
  ig_square: { width: 1080, height: 1080 },
  ig_story: { width: 1080, height: 1920 },
  og: { width: 1200, height: 630 },
};

const TEMPLATE_COMPONENTS: Record<
  CardTemplateName,
  (props: CardTemplateProps) => ReactElement
> = {
  quote: Quote,
  stat: Stat,
  list: List,
  hero: Hero,
};

const DEFAULT_TEMPLATES: CardTemplateName[] = [
  "quote",
  "stat",
  "list",
  "hero",
];

export interface GenerateCardsInput {
  articleId: string;
  brandId: string;
  companyId?: string;
  formats: CardFormat[];
  templates?: CardTemplateName[];
}

export interface CardURL {
  template: string;
  format: string;
  size: CardSize;
  r2Url: string;
}

export interface BrowserRenderingClient {
  screenshot(input: {
    html: string;
    size: CardSize;
  }): Promise<ArrayBuffer>;
}

export interface CardQuotaResult {
  allowed: boolean;
  used: number;
  cap: number;
  remaining: number;
  plan: string;
  resource: string;
}

export interface CardQuotaEnforcer {
  canConsume(
    companyId: string,
    resource: "cards",
    amount: number,
  ): Promise<CardQuotaResult>;
  consume(
    companyId: string,
    resource: "cards",
    amount: number,
  ): Promise<CardQuotaResult>;
}

export interface CardQuotaWarning {
  companyId: string;
  used: number;
  cap: number;
  plan: string;
  threshold: number;
}

export class CardCapExceededError extends Error {
  override readonly name = "CardCapExceededError";

  constructor(
    readonly requested: number,
    readonly max: number = MAX_CARDS_PER_ARTICLE,
  ) {
    super(`Card generation cap exceeded: requested ${requested}, max ${max}`);
  }
}

export class CardQuotaExceededError extends Error {
  override readonly name = "CardQuotaExceededError";

  constructor(
    readonly details: {
      companyId: string;
      used: number;
      cap: number;
      plan: string;
      requested?: number;
    },
  ) {
    super(`card_quota_exceeded:${details.used}/${details.cap}`);
  }

  get companyId(): string {
    return this.details.companyId;
  }

  get used(): number {
    return this.details.used;
  }

  get cap(): number {
    return this.details.cap;
  }

  get plan(): string {
    return this.details.plan;
  }
}

export async function generateCards(
  input: GenerateCardsInput,
  deps: {
    fetchArticle(id: string): Promise<GeneratedArticle>;
    fetchBrand(id: string): Promise<Brand>;
    browserRenderingClient: BrowserRenderingClient;
    r2Bucket: R2Bucket;
    quotaEnforcer?: CardQuotaEnforcer;
    captureCardQuotaWarning?: (
      warning: CardQuotaWarning,
    ) => void | Promise<void>;
  },
): Promise<CardURL[]> {
  const templates = unique(input.templates ?? DEFAULT_TEMPLATES);
  const formats = unique(input.formats);
  const jobs = templates.flatMap((template) =>
    formats.map((format) => ({
      template,
      format,
      size: FORMAT_SIZES[format],
    })),
  );

  // Quota Enforcer #81 should be called here before any paid rendering work.
  if (jobs.length > MAX_CARDS_PER_ARTICLE) {
    throw new CardCapExceededError(jobs.length);
  }

  const [article, fetchedBrand] = await Promise.all([
    deps.fetchArticle(input.articleId),
    deps.fetchBrand(input.brandId),
  ]);
  const brand = await withAvailableLogo(fetchedBrand);
  const urls: CardURL[] = [];

  for (const job of jobs) {
    const quotaBeforeRender = await assertCanRenderCard(input, deps);
    const component = TEMPLATE_COMPONENTS[job.template];
    const html = renderCardHtml(
      createElement(component, { brand, article, size: job.size }),
      job.size,
    );
    const png = await deps.browserRenderingClient.screenshot({
      html,
      size: job.size,
    });
    const quotaAfterRender = await consumeRenderedCard(
      input,
      deps,
      quotaBeforeRender,
    );
    await maybeCaptureCardQuotaWarning(
      input,
      deps.captureCardQuotaWarning,
      quotaBeforeRender,
      quotaAfterRender,
    );
    const key = r2Key(input.articleId, job.template, job.size);

    await deps.r2Bucket.put(key, png, {
      httpMetadata: { contentType: "image/png" },
    });

    urls.push({
      template: job.template,
      format: job.format,
      size: job.size,
      r2Url: r2Url(key),
    });
  }

  return urls;
}

async function assertCanRenderCard(
  input: GenerateCardsInput,
  deps: { quotaEnforcer?: CardQuotaEnforcer },
): Promise<CardQuotaResult | null> {
  if (!deps.quotaEnforcer || !input.companyId) {
    return null;
  }

  const quota = await deps.quotaEnforcer.canConsume(input.companyId, "cards", 1);
  if (!quota.allowed) {
    throw new CardQuotaExceededError({
      companyId: input.companyId,
      used: quota.used,
      cap: quota.cap,
      plan: quota.plan,
      requested: 1,
    });
  }

  return quota;
}

async function consumeRenderedCard(
  input: GenerateCardsInput,
  deps: { quotaEnforcer?: CardQuotaEnforcer },
  quotaBeforeRender: CardQuotaResult | null,
): Promise<CardQuotaResult | null> {
  if (!deps.quotaEnforcer || !input.companyId || !quotaBeforeRender) {
    return null;
  }

  const quota = await deps.quotaEnforcer.consume(input.companyId, "cards", 1);
  if (!quota.allowed) {
    throw new CardQuotaExceededError({
      companyId: input.companyId,
      used: quota.used,
      cap: quota.cap,
      plan: quota.plan,
      requested: 1,
    });
  }

  return quota;
}

async function maybeCaptureCardQuotaWarning(
  input: GenerateCardsInput,
  captureCardQuotaWarning:
    | ((warning: CardQuotaWarning) => void | Promise<void>)
    | undefined,
  quotaBeforeRender: CardQuotaResult | null,
  quotaAfterRender: CardQuotaResult | null,
): Promise<void> {
  if (
    !input.companyId ||
    !captureCardQuotaWarning ||
    !quotaBeforeRender ||
    !quotaAfterRender
  ) {
    return;
  }

  const threshold = 0.8;
  const warningAt = Math.ceil(quotaAfterRender.cap * threshold);
  if (
    quotaBeforeRender.used >= warningAt ||
    quotaAfterRender.used < warningAt
  ) {
    return;
  }

  await captureCardQuotaWarning({
    companyId: input.companyId,
    used: quotaAfterRender.used,
    cap: quotaAfterRender.cap,
    plan: quotaAfterRender.plan,
    threshold,
  });
}

function renderCardHtml(component: ReactElement, size: CardSize): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<meta name="viewport" content="width=${size.width},initial-scale=1">`,
    "<title>Social Card</title>",
    "</head>",
    '<body style="margin:0;background:#000;overflow:hidden">',
    renderToString(component),
    "</body>",
    "</html>",
  ].join("");
}

function r2Key(articleId: string, template: string, size: CardSize): string {
  return `cards/${articleId}/${template}_${size.width}x${size.height}.png`;
}

function r2Url(key: string): string {
  return `r2://${R2_BUCKET_NAME}/${key}`;
}

async function withAvailableLogo(brand: Brand): Promise<Brand> {
  const logoUrl = brandLogoUrl(brand);
  if (!logoUrl) return brand;

  try {
    const response = await fetch(logoUrl, { method: "HEAD" });
    if (response.ok) return brand;
  } catch {
    // Missing or blocked brand logos should not fail card generation.
  }

  return { ...brand, logoUrl: null, logo_url: null };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
