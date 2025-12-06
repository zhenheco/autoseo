/**
 * Article Storage Service
 * 負責將生成的文章儲存到資料庫
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { marked } from "marked";
import type { ArticleGenerationResult } from "@/types/agents";

interface WritingWithContent {
  markdown?: string;
  html?: string;
  content?: string;
}

interface MetaWithTitle {
  seo?: { title?: string };
  title?: string;
}

interface ArticleRecommendation {
  article_id: string;
  score: number;
  reason: string;
}

export interface PreviousArticle {
  title: string;
  slug: string;
  url?: string;
  keywords?: string[];
}

export interface ExternalReference {
  url: string;
  title: string;
  description: string;
  relevantSection?: string;
}

export interface LinkStats {
  internalCount: number;
  externalCount: number;
  wasEnriched: boolean;
}

function countInternalLinks(html: string): number {
  const internalPattern = /<a[^>]*rel=["'][^"']*internal[^"']*["'][^>]*>/gi;
  const relativePattern = /<a[^>]*href=["']\/[^"']*["'][^>]*>/gi;
  const internalMatches = html.match(internalPattern) || [];
  const relativeMatches = html.match(relativePattern) || [];
  return internalMatches.length + relativeMatches.length;
}

function countExternalLinks(html: string): number {
  const externalPattern = /<a[^>]*rel=["'][^"']*external[^"']*["'][^>]*>/gi;
  const httpPattern =
    /<a[^>]*href=["']https?:\/\/[^"']*["'][^>]*target=["']_blank["'][^>]*>/gi;
  const externalMatches = html.match(externalPattern) || [];
  const httpMatches = html.match(httpPattern) || [];

  const externalSet = new Set<string>();
  externalMatches.forEach((m) => externalSet.add(m));
  httpMatches.forEach((m) => externalSet.add(m));

  return externalSet.size;
}

function injectInternalLinks(
  html: string,
  articles: PreviousArticle[],
  count: number,
): string {
  if (articles.length === 0 || count <= 0) return html;

  let modifiedHtml = html;
  let injected = 0;

  for (const article of articles) {
    if (injected >= count) break;

    const keywords = article.keywords || [article.title];
    for (const keyword of keywords) {
      if (injected >= count) break;

      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(
        `(?<!<a[^>]*>)(?<![\\u4e00-\\u9fa5a-zA-Z])${escapedKeyword}(?![\\u4e00-\\u9fa5a-zA-Z])(?![^<]*<\\/a>)`,
        "i",
      );

      if (pattern.test(modifiedHtml)) {
        const url = article.url || `/${article.slug}`;
        modifiedHtml = modifiedHtml.replace(
          pattern,
          `<a href="${url}" rel="internal">${keyword}</a>`,
        );
        injected++;
        break;
      }
    }
  }

  console.log(`[LinkProcessor] 注入 ${injected} 個內部連結`);
  return modifiedHtml;
}

function injectExternalLinks(
  html: string,
  refs: ExternalReference[],
  count: number,
): string {
  if (refs.length === 0 || count <= 0) return html;

  let modifiedHtml = html;
  let injected = 0;

  for (const ref of refs) {
    if (injected >= count) break;

    const keywords = extractKeywordsFromText(ref.title + " " + ref.description);
    for (const keyword of keywords) {
      if (injected >= count) break;

      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(
        `(?<!<a[^>]*>)(?<![\\u4e00-\\u9fa5a-zA-Z])${escapedKeyword}(?![\\u4e00-\\u9fa5a-zA-Z])(?![^<]*<\\/a>)`,
        "i",
      );

      if (pattern.test(modifiedHtml)) {
        modifiedHtml = modifiedHtml.replace(
          pattern,
          `<a href="${ref.url}" target="_blank" rel="noopener noreferrer external">${keyword}</a>`,
        );
        injected++;
        break;
      }
    }
  }

  console.log(`[LinkProcessor] 注入 ${injected} 個外部連結`);
  return modifiedHtml;
}

function extractKeywordsFromText(text: string): string[] {
  const words = text.split(/[\s,，、。]+/).filter((w) => w.length >= 2);
  return words.slice(0, 10);
}

export function ensureMinimumLinks(
  html: string,
  internalArticles: PreviousArticle[],
  externalRefs: ExternalReference[],
  minInternal: number = 3,
  minExternal: number = 2,
): { html: string; stats: LinkStats } {
  const initialInternalCount = countInternalLinks(html);
  const initialExternalCount = countExternalLinks(html);

  let modifiedHtml = html;

  if (initialInternalCount < minInternal && internalArticles.length > 0) {
    modifiedHtml = injectInternalLinks(
      modifiedHtml,
      internalArticles,
      minInternal - initialInternalCount,
    );
  }

  if (initialExternalCount < minExternal && externalRefs.length > 0) {
    modifiedHtml = injectExternalLinks(
      modifiedHtml,
      externalRefs,
      minExternal - initialExternalCount,
    );
  }

  const finalInternalCount = countInternalLinks(modifiedHtml);
  const finalExternalCount = countExternalLinks(modifiedHtml);

  const stats: LinkStats = {
    internalCount: finalInternalCount,
    externalCount: finalExternalCount,
    wasEnriched:
      initialInternalCount < minInternal || initialExternalCount < minExternal,
  };

  console.log(`[LinkProcessor] 連結統計:`, {
    initial: { internal: initialInternalCount, external: initialExternalCount },
    final: { internal: finalInternalCount, external: finalExternalCount },
    wasEnriched: stats.wasEnriched,
  });

  return { html: modifiedHtml, stats };
}

export interface SaveArticleParams {
  articleJobId: string;
  result: ArticleGenerationResult;
  websiteId?: string | null; // 可選：文章寫好後才決定發佈到哪個網站
  companyId: string;
  userId: string;
}

export interface SavedArticle {
  id: string;
  title: string;
  slug: string;
  wordpress_post_id?: number;
  wordpress_post_url?: string;
  created_at: string;
}

export class ArticleStorageService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 驗證輸入資料（使用寬鬆的可選驗證）
   */
  private validateInput(result: ArticleGenerationResult): void {
    const missingFields: string[] = [];

    // 只檢查核心必要欄位
    if (!result.writing) missingFields.push("writing");
    if (!result.meta) missingFields.push("meta");

    if (missingFields.length > 0) {
      throw new Error(`缺少核心必要欄位: ${missingFields.join(", ")}`);
    }

    // 檢查 writing 必須包含內容（markdown, html, 或 content 其中之一）
    const writingWithContent = result.writing as WritingWithContent;
    const hasContent =
      result.writing!.markdown ||
      result.writing!.html ||
      writingWithContent.content;
    if (!hasContent) {
      missingFields.push(
        "writing content (需要 markdown, html 或 content 其中之一)",
      );
    }

    // 檢查 meta 必須包含標題
    const metaWithTitle = result.meta as MetaWithTitle;
    const hasTitle = result.meta!.seo?.title || metaWithTitle.title;
    if (!hasTitle) {
      missingFields.push(
        "meta title (需要 meta.seo.title 或 meta.title 其中之一)",
      );
    }

    if (missingFields.length > 0) {
      console.error("[ArticleStorage] 核心欄位驗證失敗:", missingFields);
      throw new Error(`缺少核心欄位:\n${missingFields.join("\n")}`);
    }

    // 可選欄位警告（不拋出錯誤）
    const warnings: string[] = [];
    if (!result.writing!.statistics)
      warnings.push("writing.statistics (將使用預設值)");
    if (!result.writing!.readability)
      warnings.push("writing.readability (將使用預設值)");
    if (!result.writing!.keywordUsage)
      warnings.push("writing.keywordUsage (將使用預設值)");
    if (!result.meta!.slug) warnings.push("meta.slug (將自動生成)");

    if (warnings.length > 0) {
      console.warn("[ArticleStorage] 可選欄位缺失（將使用預設值）:", warnings);
    }
  }

  /**
   * 為缺失的欄位提供預設值
   */
  private normalizeResult(
    result: ArticleGenerationResult,
  ): ArticleGenerationResult {
    // 提供 writing 欄位的預設值
    if (result.writing) {
      const writingContent = result.writing as WritingWithContent;
      // 如果缺少 markdown，從 html 或 content 生成
      if (!result.writing.markdown && result.writing.html) {
        result.writing.markdown = result.writing.html;
      } else if (!result.writing.markdown && writingContent.content) {
        result.writing.markdown = writingContent.content;
      }

      // html 的轉換在 saveArticle 中統一處理，這裡只做 markdown 的填充
      // 如果缺少 html，標記為需要從 markdown 轉換
      if (
        !result.writing.html &&
        (result.writing.markdown || writingContent.content)
      ) {
        result.writing.html = ""; // 標記為空，讓 saveArticle 進行轉換
      }

      // 提供預設的 statistics
      if (!result.writing.statistics) {
        const content =
          result.writing.markdown ||
          result.writing.html ||
          writingContent.content ||
          "";
        const wordCount = content.split(/\s+/).length;
        const sentenceCount = content.split(/[.!?]+/).length;
        result.writing.statistics = {
          wordCount,
          readingTime: Math.ceil(wordCount / 200),
          paragraphCount: content.split(/\n\n+/).length,
          sentenceCount,
          averageSentenceLength:
            sentenceCount > 0 ? wordCount / sentenceCount : 0,
        };
      }

      // 提供預設的 readability
      if (!result.writing.readability) {
        result.writing.readability = {
          fleschReadingEase: 60,
          fleschKincaidGrade: 8,
          gunningFogIndex: 10,
        };
      }

      // 提供預設的 keywordUsage
      if (!result.writing.keywordUsage) {
        result.writing.keywordUsage = {
          density: 1.5,
          count: 0,
          distribution: [],
        };
      }
    }

    // 提供 meta 欄位的預設值
    if (result.meta) {
      // 統一標題來源
      const metaTitle = result.meta as MetaWithTitle;
      const title = result.meta.seo?.title || metaTitle.title || "Untitled";

      // 確保 seo 物件存在
      if (!result.meta.seo) {
        result.meta.seo = {
          title,
          description: "",
          keywords: [],
        };
      }

      // 如果缺少 slug，從標題生成
      if (!result.meta.slug && title) {
        result.meta.slug = title
          .toLowerCase()
          .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
          .replace(/^-+|-+$/g, "");
      } else if (!result.meta.slug) {
        // 如果 title 也不存在，使用預設 slug
        result.meta.slug = "untitled-article";
      }

      // 提供預設的 focusKeyphrase
      if (!result.meta.focusKeyphrase) {
        result.meta.focusKeyphrase = result.meta.seo.keywords?.[0] || "";
      }

      // 提供預設的 openGraph
      if (!result.meta.openGraph) {
        result.meta.openGraph = {
          title: result.meta.seo.title,
          description: result.meta.seo.description,
          image: "",
          type: "article",
        };
      }

      // 提供預設的 twitterCard
      if (!result.meta.twitterCard) {
        result.meta.twitterCard = {
          card: "summary_large_image",
          title: result.meta.seo.title,
          description: result.meta.seo.description,
          image: "",
        };
      }
    }

    return result;
  }

  /**
   * 儲存生成的文章到資料庫
   */
  async saveArticle(params: SaveArticleParams): Promise<SavedArticle> {
    const { articleJobId, websiteId, companyId, userId } = params;
    let { result } = params;

    // 驗證輸入
    this.validateInput(result);

    // 為缺失的欄位提供預設值
    result = this.normalizeResult(result);

    // 驗證並修復 HTML 內容（確保 Markdown 轉換為 HTML）
    const hasMarkdownContent =
      result.writing!.markdown && result.writing!.markdown.trim().length > 0;
    const needsHtmlConversion =
      !result.writing!.html ||
      result.writing!.html.trim() === "" ||
      !this.isValidHTML(result.writing!.html);

    if (needsHtmlConversion && hasMarkdownContent) {
      console.log("[ArticleStorage] 🔄 Converting Markdown to HTML...", {
        markdownLength: result.writing!.markdown.length,
        currentHtmlLength: result.writing!.html?.length || 0,
      });

      try {
        const convertedHtml = await this.convertMarkdownToHTML(
          result.writing!.markdown,
        );

        if (this.isValidHTML(convertedHtml)) {
          result.writing!.html = convertedHtml;
          console.log(
            "[ArticleStorage] ✅ Markdown to HTML conversion successful",
          );
        } else {
          console.error("[ArticleStorage] ❌ Converted HTML is still invalid");
        }
      } catch (error) {
        console.error("[ArticleStorage] ❌ HTML conversion error:", error);
      }
    } else if (!this.isValidHTML(result.writing!.html)) {
      console.error(
        "[ArticleStorage] ⚠️  Invalid HTML detected, attempting to fix...",
        {
          htmlSample: result.writing!.html.substring(0, 200),
          markdownSample: result.writing!.markdown?.substring(0, 200) || "N/A",
        },
      );

      try {
        const fixedHtml = await this.convertMarkdownToHTML(
          result.writing!.markdown || result.writing!.html,
        );

        if (this.isValidHTML(fixedHtml)) {
          result.writing!.html = fixedHtml;
          console.log("[ArticleStorage] ✅ HTML fixed successfully");
        } else {
          console.error(
            "[ArticleStorage] ❌ HTML fix failed, storing invalid HTML anyway",
          );
        }
      } catch (error) {
        console.error("[ArticleStorage] ❌ HTML fix error:", error);
      }
    } else {
      console.log("[ArticleStorage] ✅ HTML validation passed before storage");
    }

    // 最終清理：確保 HTML 中沒有殘留的 Markdown 語法
    if (!this.isValidHTML(result.writing!.html)) {
      console.log(
        "[ArticleStorage] 🧹 Final cleanup: removing residual Markdown...",
      );
      result.writing!.html = this.cleanMarkdownFromHtml(result.writing!.html);
    }

    // 保底機制：如果 HTML 中沒有圖片但 result.image 有值，則插入圖片
    if (result.image && !result.writing!.html.includes("<img ")) {
      console.log(
        "[ArticleStorage] 📸 HTML missing images, inserting from result.image...",
      );
      result.writing!.html = this.insertImagesToHtml(
        result.writing!.html,
        result.image.featuredImage,
        result.image.contentImages || [],
      );
      console.log("[ArticleStorage] ✅ Images inserted successfully");
    }

    // 準備文章數據
    const articleData = {
      article_job_id: articleJobId || null, // 允許 null，如果 job 不存在
      company_id: companyId,
      website_id: websiteId || null, // 允許 null，文章寫好後才決定發佈到哪個網站
      user_id: userId,

      // 文章內容
      title: result.meta!.seo.title,
      slug: result.meta!.slug,
      markdown_content: result.writing!.markdown,
      html_content: result.writing!.html,
      excerpt: result.meta!.seo.description.substring(0, 200),

      // SEO Metadata
      seo_title: result.meta!.seo.title,
      seo_description: result.meta!.seo.description,
      focus_keyword: result.meta!.focusKeyphrase,
      keywords: result.meta!.seo.keywords || [],

      // Open Graph & Twitter Card
      og_title: result.meta!.openGraph.title,
      og_description: result.meta!.openGraph.description,
      og_image: result.meta!.openGraph.image,
      twitter_card_type: result.meta!.twitterCard.card,
      twitter_title: result.meta!.twitterCard.title,
      twitter_description: result.meta!.twitterCard.description,
      twitter_image: result.meta!.twitterCard.image,

      // 分類與標籤
      categories: result.category?.categories.map((c) => c.name) || [],
      tags: result.category?.tags.map((t) => t.name) || [],

      // 文章統計
      word_count: result.writing!.statistics.wordCount,
      reading_time: result.writing!.statistics.readingTime,
      paragraph_count: result.writing!.statistics.paragraphCount,
      sentence_count: result.writing!.statistics.sentenceCount,

      // 可讀性指標
      flesch_reading_ease: result.writing!.readability.fleschReadingEase,
      flesch_kincaid_grade: result.writing!.readability.fleschKincaidGrade,
      gunning_fog_index: result.writing!.readability.gunningFogIndex,

      // 關鍵字分析
      keyword_density: result.writing!.keywordUsage.density,
      keyword_usage_count: result.writing!.keywordUsage.count,

      // 內部連結
      internal_links: result.writing!.internalLinks || [],
      internal_links_count: result.writing!.internalLinks?.length || 0,

      // 外部引用
      external_references: result.strategy?.externalReferences || [],
      external_links_count: result.strategy?.externalReferences?.length || 0,

      // Metadata for semantic search
      article_metadata: {
        main_topic: result.strategy?.selectedTitle,
        keywords: result.strategy?.keywords || [],
        related_keywords: result.strategy?.relatedKeywords || [],
        lsi_keywords: result.strategy?.lsiKeywords || [],
        content_structure: result.strategy?.outline,
        search_intent: result.research?.searchIntent,
        content_gaps: result.research?.contentGaps || [],
      },

      // WordPress 發布資訊
      wordpress_post_id: result.wordpress?.postId,
      wordpress_post_url: result.wordpress?.postUrl,
      wordpress_status: result.wordpress?.status || "generated",

      // 圖片資訊
      featured_image_url: result.image?.featuredImage?.url,
      featured_image_alt: result.image?.featuredImage?.altText,
      content_images: result.image?.contentImages || [],

      // 品質分數
      quality_score: result.quality?.score,
      quality_passed: result.quality?.passed || false,
      quality_issues: result.quality?.errors || [],

      // AI 模型資訊
      research_model: result.research?.executionInfo.model,
      strategy_model: result.strategy?.executionInfo.model,
      writing_model: result.writing!.executionInfo.model,
      meta_model: result.meta!.executionInfo.model,

      // 執行統計
      generation_time: result.executionStats.totalTime,
      token_usage: {
        research: result.research?.executionInfo.tokenUsage,
        strategy: result.strategy?.executionInfo.tokenUsage,
        writing: result.writing!.executionInfo.tokenUsage,
        meta: result.meta!.executionInfo.tokenUsage,
      },
      cost_breakdown: result.costBreakdown,

      // 狀態
      status: result.wordpress ? "published" : "generated",
      published_at: result.wordpress ? new Date().toISOString() : null,
    };

    console.log("[ArticleStorage] 儲存文章:", {
      title: articleData.title,
      word_count: articleData.word_count,
      keywords_count: articleData.keywords.length,
    });

    // 使用 UPSERT 防止重複生成（以 article_job_id 為衝突鍵）
    const { data, error } = await this.supabase
      .from("generated_articles")
      .upsert(articleData, {
        onConflict: "article_job_id",
        ignoreDuplicates: false,
      })
      .select(
        "id, title, slug, wordpress_post_id, wordpress_post_url, created_at",
      )
      .single();

    if (error) {
      console.error("[ArticleStorage] 儲存失敗:", error);
      throw new Error(`儲存文章失敗: ${error.message}`);
    }

    console.log("[ArticleStorage] 儲存成功:", data.id);

    return data;
  }

  /**
   * 為文章生成內部連結推薦
   */
  async generateRecommendations(
    articleId: string,
    maxRecommendations: number = 5,
    minScore: number = 20.0,
  ): Promise<ArticleRecommendation[]> {
    console.log("[ArticleStorage] 生成推薦:", {
      articleId,
      maxRecommendations,
      minScore,
    });

    const { data, error } = await this.supabase.rpc(
      "generate_article_recommendations",
      {
        target_article_id: articleId,
        max_recommendations: maxRecommendations,
        min_score: minScore,
      },
    );

    if (error) {
      console.error("[ArticleStorage] 推薦生成失敗:", error);
      return [];
    }

    console.log("[ArticleStorage] 推薦數量:", data?.length || 0);

    return data || [];
  }

  /**
   * 儲存推薦關聯到資料庫
   */
  async saveRecommendations(
    sourceArticleId: string,
    recommendations: ArticleRecommendation[],
  ): Promise<void> {
    if (recommendations.length === 0) {
      console.log("[ArticleStorage] 沒有推薦要儲存");
      return;
    }

    const recommendationData = recommendations.map((rec) => ({
      source_article_id: sourceArticleId,
      target_article_id: rec.article_id,
      recommendation_score: rec.score,
      recommendation_reason: rec.reason,
      status: "suggested",
    }));

    const { error } = await this.supabase
      .from("article_recommendations")
      .insert(recommendationData);

    if (error) {
      console.error("[ArticleStorage] 推薦儲存失敗:", error);
      throw new Error(`儲存推薦失敗: ${error.message}`);
    }

    console.log("[ArticleStorage] 推薦儲存成功:", recommendationData.length);
  }

  /**
   * 完整的儲存流程：儲存文章 + 生成並儲存推薦
   */
  async saveArticleWithRecommendations(params: SaveArticleParams): Promise<{
    article: SavedArticle;
    recommendations: ArticleRecommendation[];
  }> {
    // 1. 儲存文章
    const article = await this.saveArticle(params);

    // 2. 生成推薦（2-5 個）
    const recommendations = await this.generateRecommendations(
      article.id,
      5,
      20,
    );

    // 3. 儲存推薦關聯
    if (recommendations.length > 0) {
      await this.saveRecommendations(article.id, recommendations);
    }

    return {
      article,
      recommendations,
    };
  }

  /**
   * 驗證 HTML 有效性
   */
  private isValidHTML(html: string): boolean {
    if (!html || html.trim().length === 0) {
      return false;
    }

    if (!html.includes("<") || !html.includes(">")) {
      return false;
    }

    // 更嚴格的 markdown 檢測
    const markdownPatterns = [
      /^#{1,6}\s+/m, // 開頭的標題
      /\n#{1,6}\s+/, // 換行後的標題
      /\*\*[^*]+\*\*/, // 粗體
      /```/, // 程式碼區塊
      /<p>\s*#{1,6}/, // <p> 內的標題
    ];

    if (markdownPatterns.some((p) => p.test(html))) {
      console.log("[ArticleStorage] isValidHTML: 檢測到 markdown 語法");
      return false;
    }

    return true;
  }

  /**
   * 清理 HTML 中殘留的 Markdown 語法（用於混合內容）
   */
  private cleanMarkdownFromHtml(html: string): string {
    let cleaned = html;

    // 處理標題（注意：需要處理 \n 和實際換行）
    // ### 標題 → <h3>標題</h3>
    cleaned = cleaned.replace(/\\n### ([^\n\\]+)/g, "\n<h3>$1</h3>");
    cleaned = cleaned.replace(/\n### ([^\n]+)/g, "\n<h3>$1</h3>");
    cleaned = cleaned.replace(/^### ([^\n]+)/gm, "<h3>$1</h3>");

    // ## 標題 → <h2>標題</h2>
    cleaned = cleaned.replace(/\\n## ([^\n\\]+)/g, "\n<h2>$1</h2>");
    cleaned = cleaned.replace(/\n## ([^\n]+)/g, "\n<h2>$1</h2>");
    cleaned = cleaned.replace(/^## ([^\n]+)/gm, "<h2>$1</h2>");

    // # 標題 → <h1>標題</h1>
    cleaned = cleaned.replace(/\\n# ([^\n\\]+)/g, "\n<h1>$1</h1>");
    cleaned = cleaned.replace(/\n# ([^\n]+)/g, "\n<h1>$1</h1>");
    cleaned = cleaned.replace(/^# ([^\n]+)/gm, "<h1>$1</h1>");

    // **粗體** → <strong>粗體</strong>
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    // *斜體* → <em>斜體</em>（但避免影響已存在的 HTML 屬性）
    cleaned = cleaned.replace(/(?<![="])\*([^*]+)\*(?!["])/g, "<em>$1</em>");

    // ```code``` → <code>code</code>
    cleaned = cleaned.replace(/```([^`]+)```/g, "<pre><code>$1</code></pre>");
    cleaned = cleaned.replace(/`([^`]+)`/g, "<code>$1</code>");

    // 處理 \n\n → 段落分隔（但不影響已有的 HTML 標籤）
    cleaned = cleaned.replace(/\\n\\n/g, "</p>\n<p>");
    cleaned = cleaned.replace(/\\n/g, "\n");

    // 處理 <p> 標籤內的 markdown 標題（最常見的問題）
    cleaned = cleaned.replace(
      /<p>\s*(#{1,6})\s+([^<\n]+)(?:<\/p>)?/g,
      (_, hashes, text) => {
        const level = hashes.length;
        return `<h${level}>${text.trim()}</h${level}>`;
      },
    );

    // 處理連續換行後的 markdown 標題
    cleaned = cleaned.replace(/\n(#{1,6})\s+([^\n<]+)/g, (_, hashes, text) => {
      const level = hashes.length;
      return `\n<h${level}>${text.trim()}</h${level}>`;
    });

    // 最終清理：移除任何剩餘的 # 標記（非 HTML 實體，且非 CSS 顏色碼如 #fff）
    cleaned = cleaned.replace(/(?<!&)(?<!#[0-9a-fA-F])#{2,6}\s+/g, "");

    console.log("[ArticleStorage] 清理 Markdown 殘留:", {
      hadMarkdown:
        html.includes("##") || html.includes("**") || html.includes("```"),
      inputLength: html.length,
      outputLength: cleaned.length,
    });

    return cleaned;
  }

  /**
   * 將 Markdown 轉換為 HTML
   */
  private async convertMarkdownToHTML(markdown: string): Promise<string> {
    if (!markdown || markdown.trim().length === 0) {
      console.error(
        "[ArticleStorage] convertMarkdownToHTML: 輸入 Markdown 為空",
      );
      return "";
    }

    console.log("[ArticleStorage] 開始 Markdown 轉換:", {
      inputLength: markdown.length,
      preview: markdown.substring(0, 100),
    });

    try {
      const htmlResult = await marked.parse(markdown);

      if (!htmlResult || htmlResult.trim().length === 0) {
        console.error("[ArticleStorage] marked.parse 返回空結果", {
          inputLength: markdown.length,
          outputLength: 0,
        });
        return this.fallbackMarkdownToHtml(markdown);
      }

      console.log("[ArticleStorage] Markdown 轉換成功:", {
        inputLength: markdown.length,
        outputLength: htmlResult.length,
      });

      return htmlResult;
    } catch (error) {
      console.error("[ArticleStorage] marked.parse 錯誤:", {
        error: error instanceof Error ? error.message : String(error),
        inputLength: markdown.length,
      });
      return this.fallbackMarkdownToHtml(markdown);
    }
  }

  /**
   * Fallback: 簡易 Markdown 轉 HTML（當 marked 失敗時使用）
   */
  private fallbackMarkdownToHtml(markdown: string): string {
    console.warn("[ArticleStorage] 使用 fallback Markdown 轉換");

    let html = markdown;

    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    html = html.replace(/^\- (.+)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    const paragraphs = html.split(/\n\n+/);
    html = paragraphs
      .map((p) => {
        const trimmed = p.trim();
        if (
          trimmed.startsWith("<h") ||
          trimmed.startsWith("<ul") ||
          trimmed.startsWith("<ol") ||
          trimmed.startsWith("<li") ||
          trimmed.startsWith("<figure")
        ) {
          return trimmed;
        }
        return `<p>${trimmed}</p>`;
      })
      .join("\n\n");

    console.log("[ArticleStorage] Fallback 轉換完成:", {
      inputLength: markdown.length,
      outputLength: html.length,
    });

    return html;
  }

  /**
   * 將圖片插入到 HTML 中（保底機制）
   */
  private insertImagesToHtml(
    html: string,
    featuredImage:
      | { url: string; altText: string; width: number; height: number }
      | null
      | undefined,
    contentImages: Array<{
      url: string;
      altText: string;
      width: number;
      height: number;
    }>,
  ): string {
    let modifiedHtml = html;

    if (featuredImage) {
      const featuredImageHtml = `<figure class="wp-block-image size-large">
  <img src="${featuredImage.url}" alt="${featuredImage.altText}" width="${featuredImage.width}" height="${featuredImage.height}" />
  <figcaption>${featuredImage.altText}</figcaption>
</figure>\n\n`;

      const firstPTagIndex = modifiedHtml.indexOf("</p>");
      if (firstPTagIndex !== -1) {
        modifiedHtml =
          modifiedHtml.slice(0, firstPTagIndex + 4) +
          "\n\n" +
          featuredImageHtml +
          modifiedHtml.slice(firstPTagIndex + 4);
      }
    }

    if (contentImages && contentImages.length > 0) {
      const h2Regex = /<h2[^>]*>.*?<\/h2>/g;
      const h3Regex = /<h3[^>]*>.*?<\/h3>/g;
      let match;
      const h2Positions: number[] = [];
      const h3Positions: number[] = [];

      while ((match = h2Regex.exec(modifiedHtml)) !== null) {
        h2Positions.push(match.index + match[0].length);
      }

      while ((match = h3Regex.exec(modifiedHtml)) !== null) {
        h3Positions.push(match.index + match[0].length);
      }

      const h2Count = h2Positions.length;
      const imageCount = contentImages.length;

      let insertPositions: number[] = [];

      if (imageCount <= Math.ceil(h2Count / 2)) {
        const step = Math.max(1, Math.floor(h2Count / imageCount));
        for (let i = 0; i < imageCount && i * step < h2Count; i++) {
          insertPositions.push(h2Positions[i * step]);
        }
      } else if (imageCount <= h2Count) {
        insertPositions = h2Positions.slice(0, imageCount);
      } else {
        insertPositions = [...h2Positions];
        const remainingImages = imageCount - h2Count;
        const h3ToUse = h3Positions.slice(0, remainingImages);
        insertPositions = [...insertPositions, ...h3ToUse].sort(
          (a, b) => a - b,
        );
      }

      for (
        let i = Math.min(insertPositions.length, imageCount) - 1;
        i >= 0;
        i--
      ) {
        const image = contentImages[i];
        const imageHtml = `\n\n<figure class="wp-block-image size-large">
  <img src="${image.url}" alt="${image.altText}" width="${image.width}" height="${image.height}" />
</figure>\n\n`;

        const position = insertPositions[i];
        modifiedHtml =
          modifiedHtml.slice(0, position) +
          imageHtml +
          modifiedHtml.slice(position);
      }
    }

    return modifiedHtml;
  }
}
