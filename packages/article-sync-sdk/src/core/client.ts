/**
 * SyncClient
 * 用於查詢同步到本地的文章
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  SyncClientConfig,
  GetArticlesOptions,
  GetArticlesResponse,
  GetArticleResponse,
  SyncedArticle,
  SyncedArticleListItem,
} from "./types";

const DEFAULT_TABLE_NAME = "synced_articles";
const DEFAULT_LIMIT = 10;

/**
 * SyncClient 類別
 * 提供文章查詢功能
 */
export class SyncClient {
  private supabase: SupabaseClient;
  private tableName: string;

  constructor(config: SyncClientConfig) {
    this.tableName = config.tableName || DEFAULT_TABLE_NAME;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }

  /**
   * 取得文章列表
   */
  async getArticles(
    options: GetArticlesOptions = {}
  ): Promise<GetArticlesResponse> {
    const {
      limit = DEFAULT_LIMIT,
      offset = 0,
      language,
      category,
      tag,
      sortBy = "published_at",
      sortOrder = "desc",
    } = options;

    // 建立查詢
    let query = this.supabase
      .from(this.tableName)
      .select(
        `
        id,
        slug,
        title,
        excerpt,
        featured_image_url,
        categories,
        tags,
        language,
        reading_time,
        published_at
      `,
        { count: "exact" }
      )
      .eq("sync_status", "active");

    // 篩選條件
    if (language) {
      query = query.eq("language", language);
    }

    if (category) {
      query = query.contains("categories", [category]);
    }

    if (tag) {
      query = query.contains("tags", [tag]);
    }

    // 排序
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    // 分頁
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch articles: ${error.message}`);
    }

    const total = count || 0;
    const hasMore = offset + limit < total;

    return {
      articles: (data || []) as SyncedArticleListItem[],
      total,
      hasMore,
    };
  }

  /**
   * 根據 slug 取得單篇文章
   */
  async getArticleBySlug(slug: string): Promise<GetArticleResponse> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("slug", slug)
      .eq("sync_status", "active")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // 找不到資料
        return { article: null };
      }
      throw new Error(`Failed to fetch article: ${error.message}`);
    }

    return { article: data as SyncedArticle };
  }

  /**
   * 根據 source_id 取得單篇文章
   */
  async getArticleBySourceId(sourceId: string): Promise<GetArticleResponse> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("source_id", sourceId)
      .eq("sync_status", "active")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { article: null };
      }
      throw new Error(`Failed to fetch article: ${error.message}`);
    }

    return { article: data as SyncedArticle };
  }

  /**
   * 取得所有分類
   */
  async getCategories(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("categories")
      .eq("sync_status", "active");

    if (error) {
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }

    // 合併所有分類並去重
    const allCategories = new Set<string>();
    for (const row of data || []) {
      for (const cat of row.categories || []) {
        allCategories.add(cat);
      }
    }

    return Array.from(allCategories).sort();
  }

  /**
   * 取得所有標籤
   */
  async getTags(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("tags")
      .eq("sync_status", "active");

    if (error) {
      throw new Error(`Failed to fetch tags: ${error.message}`);
    }

    // 合併所有標籤並去重
    const allTags = new Set<string>();
    for (const row of data || []) {
      for (const tag of row.tags || []) {
        allTags.add(tag);
      }
    }

    return Array.from(allTags).sort();
  }

  /**
   * 取得相關文章
   */
  async getRelatedArticles(
    articleId: string,
    limit: number = 4
  ): Promise<SyncedArticleListItem[]> {
    // 先取得目標文章的分類和標籤
    const { data: targetArticle, error: fetchError } = await this.supabase
      .from(this.tableName)
      .select("categories, tags")
      .eq("id", articleId)
      .single();

    if (fetchError || !targetArticle) {
      return [];
    }

    const categories = targetArticle.categories || [];
    const tags = targetArticle.tags || [];

    // 查詢有相同分類或標籤的文章
    let query = this.supabase
      .from(this.tableName)
      .select(
        `
        id,
        slug,
        title,
        excerpt,
        featured_image_url,
        categories,
        tags,
        language,
        reading_time,
        published_at
      `
      )
      .eq("sync_status", "active")
      .neq("id", articleId);

    // 有分類或標籤時篩選相關文章
    if (categories.length > 0 || tags.length > 0) {
      // 優先使用分類篩選，如果沒有分類則使用標籤
      if (categories.length > 0) {
        query = query.overlaps("categories", categories);
      } else if (tags.length > 0) {
        query = query.overlaps("tags", tags);
      }
    }

    query = query
      .order("published_at", { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error("[SyncClient] Failed to fetch related articles:", error);
      return [];
    }

    return (data || []) as SyncedArticleListItem[];
  }

  /**
   * 搜尋文章
   */
  async searchArticles(
    query: string,
    options: GetArticlesOptions = {}
  ): Promise<GetArticlesResponse> {
    const { limit = DEFAULT_LIMIT, offset = 0, language } = options;

    // 使用 ilike 進行簡單的文字搜尋
    // 注意：對於大規模搜尋，建議使用 Supabase 的 Full Text Search
    let dbQuery = this.supabase
      .from(this.tableName)
      .select(
        `
        id,
        slug,
        title,
        excerpt,
        featured_image_url,
        categories,
        tags,
        language,
        reading_time,
        published_at
      `,
        { count: "exact" }
      )
      .eq("sync_status", "active")
      .or(`title.ilike.%${query}%,excerpt.ilike.%${query}%`);

    if (language) {
      dbQuery = dbQuery.eq("language", language);
    }

    dbQuery = dbQuery
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await dbQuery;

    if (error) {
      throw new Error(`Failed to search articles: ${error.message}`);
    }

    const total = count || 0;
    const hasMore = offset + limit < total;

    return {
      articles: (data || []) as SyncedArticleListItem[],
      total,
      hasMore,
    };
  }

  /**
   * 取得文章數量
   */
  async getArticleCount(language?: string): Promise<number> {
    let query = this.supabase
      .from(this.tableName)
      .select("*", { count: "exact", head: true })
      .eq("sync_status", "active");

    if (language) {
      query = query.eq("language", language);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to count articles: ${error.message}`);
    }

    return count || 0;
  }
}

/**
 * 建立 SyncClient 實例
 */
export function createSyncClient(config: SyncClientConfig): SyncClient {
  return new SyncClient(config);
}
