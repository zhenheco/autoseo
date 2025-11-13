/**
 * Article Storage Service
 * 負責將生成的文章儲存到資料庫
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { ArticleGenerationResult } from '@/types/agents';

export interface SaveArticleParams {
  articleJobId: string;
  result: ArticleGenerationResult;
  websiteId: string;
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
    if (!result.writing) missingFields.push('writing');
    if (!result.meta) missingFields.push('meta');

    if (missingFields.length > 0) {
      throw new Error(`缺少核心必要欄位: ${missingFields.join(', ')}`);
    }

    // 檢查 writing 必須包含內容（markdown, html, 或 content 其中之一）
    const hasContent = result.writing!.markdown || result.writing!.html || (result.writing as any).content;
    if (!hasContent) {
      missingFields.push('writing content (需要 markdown, html 或 content 其中之一)');
    }

    // 檢查 meta 必須包含標題
    const hasTitle = result.meta!.seo?.title || (result.meta as any).title;
    if (!hasTitle) {
      missingFields.push('meta title (需要 meta.seo.title 或 meta.title 其中之一)');
    }

    if (missingFields.length > 0) {
      console.error('[ArticleStorage] 核心欄位驗證失敗:', missingFields);
      throw new Error(`缺少核心欄位:\n${missingFields.join('\n')}`);
    }

    // 可選欄位警告（不拋出錯誤）
    const warnings: string[] = [];
    if (!result.writing!.statistics) warnings.push('writing.statistics (將使用預設值)');
    if (!result.writing!.readability) warnings.push('writing.readability (將使用預設值)');
    if (!result.writing!.keywordUsage) warnings.push('writing.keywordUsage (將使用預設值)');
    if (!result.meta!.slug) warnings.push('meta.slug (將自動生成)');

    if (warnings.length > 0) {
      console.warn('[ArticleStorage] 可選欄位缺失（將使用預設值）:', warnings);
    }
  }

  /**
   * 為缺失的欄位提供預設值
   */
  private normalizeResult(result: ArticleGenerationResult): ArticleGenerationResult {
    // 提供 writing 欄位的預設值
    if (result.writing) {
      // 如果缺少 markdown，從 html 或 content 生成
      if (!result.writing.markdown && result.writing.html) {
        result.writing.markdown = result.writing.html;
      } else if (!result.writing.markdown && (result.writing as any).content) {
        result.writing.markdown = (result.writing as any).content;
      }

      // 如果缺少 html，從 markdown 或 content 生成
      if (!result.writing.html && result.writing.markdown) {
        result.writing.html = result.writing.markdown;
      } else if (!result.writing.html && (result.writing as any).content) {
        result.writing.html = (result.writing as any).content;
      }

      // 提供預設的 statistics
      if (!result.writing.statistics) {
        const content = result.writing.markdown || result.writing.html || (result.writing as any).content || '';
        const wordCount = content.split(/\s+/).length;
        const sentenceCount = content.split(/[.!?]+/).length;
        result.writing.statistics = {
          wordCount,
          readingTime: Math.ceil(wordCount / 200),
          paragraphCount: content.split(/\n\n+/).length,
          sentenceCount,
          averageSentenceLength: sentenceCount > 0 ? wordCount / sentenceCount : 0,
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
      const title = result.meta.seo?.title || (result.meta as any).title || 'Untitled';

      // 確保 seo 物件存在
      if (!result.meta.seo) {
        result.meta.seo = {
          title,
          description: '',
          keywords: [],
        };
      }

      // 如果缺少 slug，從標題生成
      if (!result.meta.slug) {
        result.meta.slug = title
          .toLowerCase()
          .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }

      // 提供預設的 focusKeyphrase
      if (!result.meta.focusKeyphrase) {
        result.meta.focusKeyphrase = result.meta.seo.keywords?.[0] || '';
      }

      // 提供預設的 openGraph
      if (!result.meta.openGraph) {
        result.meta.openGraph = {
          title: result.meta.seo.title,
          description: result.meta.seo.description,
          image: '',
          type: 'article',
        };
      }

      // 提供預設的 twitterCard
      if (!result.meta.twitterCard) {
        result.meta.twitterCard = {
          card: 'summary_large_image',
          title: result.meta.seo.title,
          description: result.meta.seo.description,
          image: '',
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

    // 準備文章數據
    const articleData = {
      article_job_id: articleJobId || null, // 允許 null，如果 job 不存在
      company_id: companyId,
      website_id: websiteId,
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
      categories: result.category?.categories.map(c => c.name) || [],
      tags: result.category?.tags.map(t => t.name) || [],

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
      wordpress_status: result.wordpress?.status || 'generated',

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
      status: result.wordpress ? 'published' : 'generated',
      published_at: result.wordpress ? new Date().toISOString() : null,
    };

    console.log('[ArticleStorage] 儲存文章:', {
      title: articleData.title,
      word_count: articleData.word_count,
      keywords_count: articleData.keywords.length,
    });

    const { data, error } = await this.supabase
      .from('generated_articles')
      .insert(articleData)
      .select('id, title, slug, wordpress_post_id, wordpress_post_url, created_at')
      .single();

    if (error) {
      console.error('[ArticleStorage] 儲存失敗:', error);
      throw new Error(`儲存文章失敗: ${error.message}`);
    }

    console.log('[ArticleStorage] 儲存成功:', data.id);

    return data;
  }

  /**
   * 為文章生成內部連結推薦
   */
  async generateRecommendations(
    articleId: string,
    maxRecommendations: number = 5,
    minScore: number = 20.0
  ): Promise<any[]> {
    console.log('[ArticleStorage] 生成推薦:', {
      articleId,
      maxRecommendations,
      minScore,
    });

    const { data, error } = await this.supabase.rpc(
      'generate_article_recommendations',
      {
        target_article_id: articleId,
        max_recommendations: maxRecommendations,
        min_score: minScore,
      }
    );

    if (error) {
      console.error('[ArticleStorage] 推薦生成失敗:', error);
      return [];
    }

    console.log('[ArticleStorage] 推薦數量:', data?.length || 0);

    return data || [];
  }

  /**
   * 儲存推薦關聯到資料庫
   */
  async saveRecommendations(
    sourceArticleId: string,
    recommendations: any[]
  ): Promise<void> {
    if (recommendations.length === 0) {
      console.log('[ArticleStorage] 沒有推薦要儲存');
      return;
    }

    const recommendationData = recommendations.map(rec => ({
      source_article_id: sourceArticleId,
      target_article_id: rec.article_id,
      recommendation_score: rec.score,
      recommendation_reason: rec.reason,
      status: 'suggested',
    }));

    const { error } = await this.supabase
      .from('article_recommendations')
      .insert(recommendationData);

    if (error) {
      console.error('[ArticleStorage] 推薦儲存失敗:', error);
      throw new Error(`儲存推薦失敗: ${error.message}`);
    }

    console.log('[ArticleStorage] 推薦儲存成功:', recommendationData.length);
  }

  /**
   * 完整的儲存流程：儲存文章 + 生成並儲存推薦
   */
  async saveArticleWithRecommendations(
    params: SaveArticleParams
  ): Promise<{
    article: SavedArticle;
    recommendations: any[];
  }> {
    // 1. 儲存文章
    const article = await this.saveArticle(params);

    // 2. 生成推薦（2-5 個）
    const recommendations = await this.generateRecommendations(article.id, 5, 20);

    // 3. 儲存推薦關聯
    if (recommendations.length > 0) {
      await this.saveRecommendations(article.id, recommendations);
    }

    return {
      article,
      recommendations,
    };
  }
}
