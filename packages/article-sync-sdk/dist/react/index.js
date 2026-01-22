"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/react/index.ts
var react_exports = {};
__export(react_exports, {
  useArticle: () => useArticle,
  useArticleBySourceId: () => useArticleBySourceId,
  useArticles: () => useArticles
});
module.exports = __toCommonJS(react_exports);

// src/react/hooks/useArticles.ts
var import_react = require("react");

// src/core/client.ts
var import_supabase_js = require("@supabase/supabase-js");
var DEFAULT_TABLE_NAME = "synced_articles";
var DEFAULT_LIMIT = 10;
var SyncClient = class {
  constructor(config) {
    this.tableName = config.tableName || DEFAULT_TABLE_NAME;
    this.supabase = (0, import_supabase_js.createClient)(config.supabaseUrl, config.supabaseKey);
  }
  /**
   * 取得文章列表
   */
  async getArticles(options = {}) {
    const {
      limit = DEFAULT_LIMIT,
      offset = 0,
      language,
      category,
      tag,
      sortBy = "published_at",
      sortOrder = "desc"
    } = options;
    let query = this.supabase.from(this.tableName).select(
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
    ).eq("sync_status", "active");
    if (language) {
      query = query.eq("language", language);
    }
    if (category) {
      query = query.contains("categories", [category]);
    }
    if (tag) {
      query = query.contains("tags", [tag]);
    }
    query = query.order(sortBy, { ascending: sortOrder === "asc" });
    query = query.range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) {
      throw new Error(`Failed to fetch articles: ${error.message}`);
    }
    const total = count || 0;
    const hasMore = offset + limit < total;
    return {
      articles: data || [],
      total,
      hasMore
    };
  }
  /**
   * 根據 slug 取得單篇文章
   */
  async getArticleBySlug(slug) {
    const { data, error } = await this.supabase.from(this.tableName).select("*").eq("slug", slug).eq("sync_status", "active").single();
    if (error) {
      if (error.code === "PGRST116") {
        return { article: null };
      }
      throw new Error(`Failed to fetch article: ${error.message}`);
    }
    return { article: data };
  }
  /**
   * 根據 source_id 取得單篇文章
   */
  async getArticleBySourceId(sourceId) {
    const { data, error } = await this.supabase.from(this.tableName).select("*").eq("source_id", sourceId).eq("sync_status", "active").single();
    if (error) {
      if (error.code === "PGRST116") {
        return { article: null };
      }
      throw new Error(`Failed to fetch article: ${error.message}`);
    }
    return { article: data };
  }
  /**
   * 取得所有分類
   */
  async getCategories() {
    const { data, error } = await this.supabase.from(this.tableName).select("categories").eq("sync_status", "active");
    if (error) {
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }
    const allCategories = /* @__PURE__ */ new Set();
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
  async getTags() {
    const { data, error } = await this.supabase.from(this.tableName).select("tags").eq("sync_status", "active");
    if (error) {
      throw new Error(`Failed to fetch tags: ${error.message}`);
    }
    const allTags = /* @__PURE__ */ new Set();
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
  async getRelatedArticles(articleId, limit = 4) {
    const { data: targetArticle, error: fetchError } = await this.supabase.from(this.tableName).select("categories, tags").eq("id", articleId).single();
    if (fetchError || !targetArticle) {
      return [];
    }
    const categories = targetArticle.categories || [];
    const tags = targetArticle.tags || [];
    let query = this.supabase.from(this.tableName).select(
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
    ).eq("sync_status", "active").neq("id", articleId);
    if (categories.length > 0 || tags.length > 0) {
      if (categories.length > 0) {
        query = query.overlaps("categories", categories);
      } else if (tags.length > 0) {
        query = query.overlaps("tags", tags);
      }
    }
    query = query.order("published_at", { ascending: false }).limit(limit);
    const { data, error } = await query;
    if (error) {
      console.error("[SyncClient] Failed to fetch related articles:", error);
      return [];
    }
    return data || [];
  }
  /**
   * 搜尋文章
   */
  async searchArticles(query, options = {}) {
    const { limit = DEFAULT_LIMIT, offset = 0, language } = options;
    let dbQuery = this.supabase.from(this.tableName).select(
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
    ).eq("sync_status", "active").or(`title.ilike.%${query}%,excerpt.ilike.%${query}%`);
    if (language) {
      dbQuery = dbQuery.eq("language", language);
    }
    dbQuery = dbQuery.order("published_at", { ascending: false }).range(offset, offset + limit - 1);
    const { data, error, count } = await dbQuery;
    if (error) {
      throw new Error(`Failed to search articles: ${error.message}`);
    }
    const total = count || 0;
    const hasMore = offset + limit < total;
    return {
      articles: data || [],
      total,
      hasMore
    };
  }
  /**
   * 取得文章數量
   */
  async getArticleCount(language) {
    let query = this.supabase.from(this.tableName).select("*", { count: "exact", head: true }).eq("sync_status", "active");
    if (language) {
      query = query.eq("language", language);
    }
    const { count, error } = await query;
    if (error) {
      throw new Error(`Failed to count articles: ${error.message}`);
    }
    return count || 0;
  }
};

// src/react/hooks/useArticles.ts
function useArticles(config, options = {}) {
  const {
    limit = 10,
    offset = 0,
    language,
    category,
    tag,
    sortBy = "published_at",
    sortOrder = "desc",
    enabled = true
  } = options;
  const [articles, setArticles] = (0, import_react.useState)([]);
  const [total, setTotal] = (0, import_react.useState)(0);
  const [isLoading, setIsLoading] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)(null);
  const [hasMore, setHasMore] = (0, import_react.useState)(false);
  const fetchArticles = (0, import_react.useCallback)(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const client = new SyncClient(config);
      const response = await client.getArticles({
        limit,
        offset,
        language,
        category,
        tag,
        sortBy,
        sortOrder
      });
      setArticles(response.articles);
      setTotal(response.total);
      setHasMore(response.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [
    config.supabaseUrl,
    config.supabaseKey,
    config.tableName,
    limit,
    offset,
    language,
    category,
    tag,
    sortBy,
    sortOrder,
    enabled
  ]);
  (0, import_react.useEffect)(() => {
    fetchArticles();
  }, [fetchArticles]);
  return {
    articles,
    total,
    isLoading,
    error,
    hasMore,
    refetch: fetchArticles
  };
}

// src/react/hooks/useArticle.ts
var import_react2 = require("react");
function useArticle(config, slug, options = {}) {
  const { enabled = true } = options;
  const [article, setArticle] = (0, import_react2.useState)(null);
  const [isLoading, setIsLoading] = (0, import_react2.useState)(false);
  const [error, setError] = (0, import_react2.useState)(null);
  const fetchArticle = (0, import_react2.useCallback)(async () => {
    if (!enabled || !slug) return;
    setIsLoading(true);
    setError(null);
    try {
      const client = new SyncClient(config);
      const response = await client.getArticleBySlug(slug);
      setArticle(response.article);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [
    config.supabaseUrl,
    config.supabaseKey,
    config.tableName,
    slug,
    enabled
  ]);
  (0, import_react2.useEffect)(() => {
    fetchArticle();
  }, [fetchArticle]);
  return {
    article,
    isLoading,
    error,
    refetch: fetchArticle
  };
}
function useArticleBySourceId(config, sourceId, options = {}) {
  const { enabled = true } = options;
  const [article, setArticle] = (0, import_react2.useState)(null);
  const [isLoading, setIsLoading] = (0, import_react2.useState)(false);
  const [error, setError] = (0, import_react2.useState)(null);
  const fetchArticle = (0, import_react2.useCallback)(async () => {
    if (!enabled || !sourceId) return;
    setIsLoading(true);
    setError(null);
    try {
      const client = new SyncClient(config);
      const response = await client.getArticleBySourceId(sourceId);
      setArticle(response.article);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [
    config.supabaseUrl,
    config.supabaseKey,
    config.tableName,
    sourceId,
    enabled
  ]);
  (0, import_react2.useEffect)(() => {
    fetchArticle();
  }, [fetchArticle]);
  return {
    article,
    isLoading,
    error,
    refetch: fetchArticle
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  useArticle,
  useArticleBySourceId,
  useArticles
});
//# sourceMappingURL=index.js.map