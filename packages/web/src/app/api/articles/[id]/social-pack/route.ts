import JSZip from "jszip";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { withRouteAuth } from "@/lib/api/route-auth";
import { handleApiError, notFound } from "@/lib/api/response-helpers";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ArticleRow = {
  id: string;
  title: string | null;
  excerpt: string | null;
  seo_description: string | null;
  og_description: string | null;
  html_content: string | null;
  slug: string | null;
  wordpress_post_url: string | null;
  website_configs?: { site_url?: string | null } | null;
};

type CardAssetRow = {
  id: string;
  template: string | null;
  size: string | null;
  r2_url: string;
  created_at: string | null;
};

const PLATFORM_BY_SIZE: Record<string, string> = {
  ig_square: "1080x1080 -> IG feed",
  "1080x1080": "1080x1080 -> IG feed",
  ig_story: "1080x1920 -> IG/Threads story",
  "1080x1920": "1080x1920 -> IG/Threads story",
  og: "1200x630 -> OG/Facebook",
  "1200x630": "1200x630 -> OG/Facebook",
};

export const GET = withRouteAuth<"company", [RouteContext]>(
  "company",
  async (_request: NextRequest, { supabase, companyId }, routeContext) => {
    try {
      const { id } = await routeContext.params;
      const { data: article, error: articleError } = await supabase
        .from("generated_articles")
        .select(
          "id, title, excerpt, seo_description, og_description, html_content, slug, wordpress_post_url, website_configs(site_url)",
        )
        .eq("id", id)
        .eq("company_id", companyId)
        .single();

      if (articleError || !article) {
        return notFound("Article");
      }

      const { data: assets, error: assetsError } = await supabase
        .from("article_assets")
        .select("id, template, size, r2_url, created_at")
        .eq("article_id", id)
        .eq("kind", "card")
        .order("created_at", { ascending: true });

      if (assetsError) {
        throw new Error(`article_assets_fetch_failed: ${assetsError.message}`);
      }

      const typedArticle = article as ArticleRow;
      const cardAssets = (assets ?? []) as CardAssetRow[];
      const caption = buildCaption(typedArticle);
      const articleUrl = buildArticleUrl(typedArticle);
      const zip = new JSZip();

      for (const asset of cardAssets) {
        const sourceUrl = resolveCardAssetUrl(asset.r2_url);
        const response = await fetch(sourceUrl);

        if (!response.ok) {
          throw new Error(
            `card_asset_fetch_failed: ${sourceUrl} (${response.status})`,
          );
        }

        zip.file(
          `cards/${buildCardFileName(asset)}`,
          Buffer.from(await response.arrayBuffer()),
          {
            date: asset.created_at ? new Date(asset.created_at) : new Date(),
          },
        );
      }

      zip.file("manifest.txt", buildManifest(cardAssets));
      zip.file("caption.txt", caption);
      zip.file("deep-links.txt", buildDeepLinks(caption, articleUrl));

      const body = Readable.toWeb(
        zip.generateNodeStream({
          type: "nodebuffer",
          streamFiles: true,
          compression: "DEFLATE",
        }) as unknown as Readable,
      ) as ReadableStream<Uint8Array>;

      return new NextResponse(body, {
        status: 200,
        headers: {
          "content-type": "application/zip",
          "content-disposition": `attachment; filename="${buildZipFileName(
            typedArticle,
          )}"`,
          "cache-control": "private, no-store",
        },
      });
    } catch (error) {
      return handleApiError(error);
    }
  },
);

function buildManifest(assets: CardAssetRow[]): string {
  const lines = [
    "Social card pack manifest",
    "",
    "filename | platform mapping | source",
  ];

  for (const asset of assets) {
    const size = asset.size ?? "unknown";
    const platform = PLATFORM_BY_SIZE[size] ?? `${size} -> manual review`;
    lines.push(`${buildCardFileName(asset)} | ${platform} | ${asset.r2_url}`);
  }

  return `${lines.join("\n")}\n`;
}

function buildCaption(article: ArticleRow): string {
  const h1 = normalizeText(article.title) || "Untitled article";
  const takeaway =
    normalizeText(article.excerpt) ||
    normalizeText(article.seo_description) ||
    normalizeText(article.og_description) ||
    firstTextFromHtml(article.html_content);

  return [h1, takeaway].filter(Boolean).join("\n\n");
}

function buildDeepLinks(caption: string, articleUrl: string): string {
  const text = articleUrl ? `${caption}\n${articleUrl}` : caption;
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(articleUrl);

  return [
    "IG: instagram://camera",
    `Threads: https://www.threads.net/intent/post?text=${encodedText}`,
    `X: https://twitter.com/intent/tweet?text=${encodedText}`,
    `FB: https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
  ].join("\n");
}

function buildArticleUrl(article: ArticleRow): string {
  if (article.wordpress_post_url) return article.wordpress_post_url;

  const siteUrl = article.website_configs?.site_url;
  if (!siteUrl || !article.slug) return "";

  return `${siteUrl.replace(/\/+$/, "")}/${article.slug.replace(/^\/+/, "")}`;
}

function buildCardFileName(asset: CardAssetRow): string {
  const extension = getExtension(asset.r2_url);
  const name = [asset.template, asset.size]
    .filter(Boolean)
    .join("_")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  return `${name || asset.id}${extension}`;
}

function getExtension(url: string): string {
  const pathname = url.split("?")[0]?.split("#")[0] ?? "";
  const match = pathname.match(/\.[a-z0-9]+$/i);
  return match?.[0] ?? ".png";
}

function buildZipFileName(article: ArticleRow): string {
  const base =
    normalizeText(article.slug) ||
    normalizeText(article.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    article.id;

  return `${base}-social-pack.zip`;
}

function resolveCardAssetUrl(r2Url: string): string {
  if (!r2Url.startsWith("r2://")) return r2Url;

  const [, rest] = r2Url.split("r2://");
  const slashIndex = rest.indexOf("/");
  const key = slashIndex >= 0 ? rest.slice(slashIndex + 1) : "";
  const publicBase =
    process.env.CARD_ASSETS_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_CARD_ASSETS_PUBLIC_URL ??
    (process.env.R2_ACCOUNT_ID
      ? `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev`
      : null);

  return publicBase && key ? `${publicBase.replace(/\/+$/, "")}/${key}` : r2Url;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function firstTextFromHtml(value: string | null): string {
  return normalizeText(
    value
      ?.replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " "),
  );
}
