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

// src/index.ts
var src_exports = {};
__export(src_exports, {
  SyncClient: () => SyncClient,
  WebhookHandler: () => WebhookHandler,
  createSyncClient: () => createSyncClient,
  createWebhookHandler: () => createWebhookHandler,
  verifyWebhookSignature: () => verifyWebhookSignature
});
module.exports = __toCommonJS(src_exports);

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
function createSyncClient(config) {
  return new SyncClient(config);
}

// src/core/webhook-handler.ts
var import_supabase_js2 = require("@supabase/supabase-js");
var SIGNATURE_HEADER = "x-webhook-signature";
var TIMESTAMP_HEADER = "x-webhook-timestamp";
var DEFAULT_TABLE_NAME2 = "synced_articles";
function verifyWebhookSignature(payload, secret, signature, timestamp, maxAgeMs = 5 * 60 * 1e3) {
  const now = Date.now();
  const age = now - timestamp;
  if (age > maxAgeMs) {
    return {
      valid: false,
      error: `Signature expired. Age: ${age}ms, Max: ${maxAgeMs}ms`
    };
  }
  if (age < -6e4) {
    return {
      valid: false,
      error: "Signature timestamp is in the future"
    };
  }
  const signaturePayload = `${timestamp}.${payload}`;
  const expectedSignature = generateSignatureSync(signaturePayload, secret);
  if (signature !== expectedSignature) {
    return { valid: false, error: "Invalid signature" };
  }
  return { valid: true };
}
function generateSignatureSync(payload, secret) {
  try {
    const crypto = require("crypto");
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload, "utf8");
    return `sha256=${hmac.digest("hex")}`;
  } catch {
    throw new Error("Webhook verification must be done on the server side");
  }
}
var WebhookHandler = class {
  constructor(config) {
    this.webhookSecret = config.webhookSecret;
    this.tableName = config.tableName || DEFAULT_TABLE_NAME2;
    this.supabase = (0, import_supabase_js2.createClient)(config.supabaseUrl, config.supabaseKey);
    this.onArticleCreated = config.onArticleCreated;
    this.onArticleUpdated = config.onArticleUpdated;
    this.onArticleDeleted = config.onArticleDeleted;
  }
  /**
   * 處理 Webhook 請求
   */
  async handleWebhook(body, signature, timestamp) {
    if (!signature || !timestamp) {
      return {
        success: false,
        error: "Missing signature or timestamp headers"
      };
    }
    const timestampNum = parseInt(timestamp, 10);
    if (isNaN(timestampNum)) {
      return {
        success: false,
        error: "Invalid timestamp"
      };
    }
    const verifyResult = verifyWebhookSignature(
      body,
      this.webhookSecret,
      signature,
      timestampNum
    );
    if (!verifyResult.valid) {
      return {
        success: false,
        error: verifyResult.error || "Invalid signature"
      };
    }
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      return {
        success: false,
        error: "Invalid JSON payload"
      };
    }
    try {
      switch (payload.event) {
        case "article.created":
          return await this.handleArticleCreated(payload);
        case "article.updated":
          return await this.handleArticleUpdated(payload);
        case "article.deleted":
          return await this.handleArticleDeleted(payload);
        default:
          return {
            success: false,
            error: `Unknown event type: ${payload.event}`
          };
      }
    } catch (error) {
      console.error("[WebhookHandler] \u8655\u7406\u932F\u8AA4:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
  /**
   * 處理文章建立事件
   */
  async handleArticleCreated(payload) {
    const articleData = this.mapPayloadToArticle(payload);
    const { data, error } = await this.supabase.from(this.tableName).upsert(articleData, { onConflict: "source_id" }).select().single();
    if (error) {
      return {
        success: false,
        error: `Database error: ${error.message}`
      };
    }
    if (this.onArticleCreated) {
      await this.onArticleCreated(data);
    }
    return {
      success: true,
      message: "Article created successfully",
      article_id: data.id
    };
  }
  /**
   * 處理文章更新事件
   */
  async handleArticleUpdated(payload) {
    const articleData = this.mapPayloadToArticle(payload);
    const { data, error } = await this.supabase.from(this.tableName).upsert(articleData, { onConflict: "source_id" }).select().single();
    if (error) {
      return {
        success: false,
        error: `Database error: ${error.message}`
      };
    }
    if (this.onArticleUpdated) {
      await this.onArticleUpdated(data);
    }
    return {
      success: true,
      message: "Article updated successfully",
      article_id: data.id
    };
  }
  /**
   * 處理文章刪除事件
   */
  async handleArticleDeleted(payload) {
    const sourceId = payload.article.source_id;
    const { error } = await this.supabase.from(this.tableName).update({
      sync_status: "deleted",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("source_id", sourceId);
    if (error) {
      return {
        success: false,
        error: `Database error: ${error.message}`
      };
    }
    if (this.onArticleDeleted) {
      await this.onArticleDeleted(sourceId);
    }
    return {
      success: true,
      message: "Article deleted successfully"
    };
  }
  /**
   * 將 Webhook Payload 映射到文章資料
   */
  mapPayloadToArticle(payload) {
    const article = payload.article;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    return {
      source_id: article.source_id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      html_content: article.html_content,
      markdown_content: article.markdown_content || null,
      categories: article.categories || [],
      tags: article.tags || [],
      language: article.language || "zh-TW",
      seo_title: article.seo_title,
      seo_description: article.seo_description,
      focus_keyword: article.focus_keyword,
      keywords: article.keywords || [],
      featured_image_url: article.featured_image_url,
      featured_image_alt: article.featured_image_alt,
      word_count: article.word_count,
      reading_time: article.reading_time,
      published_at: article.published_at,
      synced_at: now,
      sync_status: "active",
      updated_at: now
    };
  }
  /**
   * 取得簽章和時間戳 header 名稱
   */
  static get SIGNATURE_HEADER() {
    return SIGNATURE_HEADER;
  }
  static get TIMESTAMP_HEADER() {
    return TIMESTAMP_HEADER;
  }
};
function createWebhookHandler(config) {
  return new WebhookHandler(config);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SyncClient,
  WebhookHandler,
  createSyncClient,
  createWebhookHandler,
  verifyWebhookSignature
});
//# sourceMappingURL=index.js.map