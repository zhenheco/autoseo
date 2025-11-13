/**
 * WordPress REST API 客戶端
 * 直接與 WordPress 互動，處理文章發布、分類、標籤等
 */

import { z } from 'zod';

// WordPress Post Schema
const WordPressPostSchema = z.object({
  id: z.number(),
  date: z.string(),
  date_gmt: z.string(),
  guid: z.object({ rendered: z.string() }),
  modified: z.string(),
  modified_gmt: z.string(),
  slug: z.string(),
  status: z.enum(['publish', 'future', 'draft', 'pending', 'private']),
  type: z.string(),
  link: z.string(),
  title: z.object({ rendered: z.string() }),
  content: z.object({ rendered: z.string(), protected: z.boolean() }),
  excerpt: z.object({ rendered: z.string(), protected: z.boolean() }),
  author: z.number(),
  featured_media: z.number(),
  comment_status: z.enum(['open', 'closed']),
  ping_status: z.enum(['open', 'closed']),
  sticky: z.boolean(),
  template: z.string(),
  format: z.string(),
  meta: z.object({}).passthrough(),
  categories: z.array(z.number()),
  tags: z.array(z.number())
});

// WordPress Category/Tag Schema
const WordPressTaxonomySchema = z.object({
  id: z.number(),
  count: z.number(),
  description: z.string(),
  link: z.string(),
  name: z.string(),
  slug: z.string(),
  taxonomy: z.enum(['category', 'post_tag']),
  parent: z.number().optional()
});

// WordPress Media Schema
const WordPressMediaSchema = z.object({
  id: z.number(),
  date: z.string(),
  slug: z.string(),
  type: z.string(),
  link: z.string(),
  title: z.object({ rendered: z.string() }),
  author: z.number(),
  caption: z.object({ rendered: z.string() }),
  alt_text: z.string(),
  media_type: z.string(),
  mime_type: z.string(),
  source_url: z.string()
});

export type WordPressPost = z.infer<typeof WordPressPostSchema>;
export type WordPressTaxonomy = z.infer<typeof WordPressTaxonomySchema>;
export type WordPressMedia = z.infer<typeof WordPressMediaSchema>;

export interface WordPressConfig {
  url: string;
  username?: string;
  password?: string;
  applicationPassword?: string;
  accessToken?: string;
  refreshToken?: string;
  jwtToken?: string; // JWT Authentication for WP REST API 外掛支援
}

export interface CreatePostData {
  title: string;
  content: string;
  excerpt?: string;
  slug?: string;
  status?: 'publish' | 'draft' | 'pending';
  categories?: number[];
  tags?: number[];
  featured_media?: number;
  meta?: Record<string, any>;
  yoast_meta?: {
    yoast_wpseo_title?: string;
    yoast_wpseo_metadesc?: string;
    yoast_wpseo_focuskw?: string;
  };
  rank_math_meta?: {
    rank_math_title?: string;
    rank_math_description?: string;
    rank_math_focus_keyword?: string;
    rank_math_robots?: string[];
  };
}

export class WordPressClient {
  private config: WordPressConfig;
  private baseUrl: string;
  private headers: Record<string, string> = {};

  constructor(config: WordPressConfig) {
    this.config = config;
    this.baseUrl = `${config.url.replace(/\/$/, '')}/wp-json/wp/v2`;
    this.setupAuthentication();
  }

  private setupAuthentication() {
    if (this.config.jwtToken) {
      // JWT Authentication for WP REST API 外掛 (最推薦)
      this.headers['Authorization'] = `Bearer ${this.config.jwtToken}`;
    } else if (this.config.accessToken) {
      // OAuth 2.0 (推薦)
      this.headers['Authorization'] = `Bearer ${this.config.accessToken}`;
    } else if (this.config.applicationPassword && this.config.username) {
      // Application Password (安全)
      const auth = Buffer.from(
        `${this.config.username}:${this.config.applicationPassword}`
      ).toString('base64');
      this.headers['Authorization'] = `Basic ${auth}`;
    } else {
      // 不再支援純密碼認證
      throw new Error(
        'WordPress 認證錯誤：請使用 JWT、OAuth 2.0 或 Application Password。' +
        '推薦使用 JWT Authentication for WP REST API 外掛。'
      );
    }

    this.headers['Content-Type'] = 'application/json';
  }

  /**
   * 創建新文章
   */
  async createPost(data: CreatePostData): Promise<WordPressPost> {
    console.log('[WordPress] 創建新文章:', data.title);

    try {
      const postData: any = {
        title: data.title,
        content: data.content,
        status: data.status || 'draft',
        slug: data.slug
      };

      if (data.excerpt) postData.excerpt = data.excerpt;
      if (data.categories) postData.categories = data.categories;
      if (data.tags) postData.tags = data.tags;
      if (data.featured_media) postData.featured_media = data.featured_media;
      if (data.meta) postData.meta = data.meta;

      // Yoast SEO 支援
      if (data.yoast_meta) {
        postData.meta = {
          ...postData.meta,
          ...data.yoast_meta
        };
      }

      // Rank Math SEO 支援
      if (data.rank_math_meta) {
        postData.meta = {
          ...postData.meta,
          ...data.rank_math_meta
        };
      }

      const response = await fetch(`${this.baseUrl}/posts`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(postData)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`WordPress API 錯誤: ${response.status} - ${error}`);
      }

      const post = await response.json();
      const validated = WordPressPostSchema.parse(post);

      console.log('[WordPress] 文章創建成功:', validated.id);
      return validated;

    } catch (error) {
      console.error('[WordPress] 創建文章錯誤:', error);
      throw error;
    }
  }

  /**
   * 更新文章
   */
  async updatePost(id: number, data: Partial<CreatePostData>): Promise<WordPressPost> {
    console.log('[WordPress] 更新文章:', id);

    const response = await fetch(`${this.baseUrl}/posts/${id}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WordPress API 錯誤: ${response.status} - ${error}`);
    }

    const post = await response.json();
    return WordPressPostSchema.parse(post);
  }

  async updateRankMathMeta(postId: number, meta: {
    rank_math_title?: string;
    rank_math_description?: string;
    rank_math_focus_keyword?: string;
    rank_math_robots?: string[];
  }): Promise<void> {
    console.log('[WordPress] 更新 Rank Math 元數據:', postId);

    const url = `${this.config.url}/wp-json/rankmath/v1/updateMeta`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        objectID: postId,
        objectType: 'post',
        meta
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[WordPress] Rank Math 更新失敗:', error);
      throw new Error(`Rank Math API 錯誤: ${response.status} - ${error}`);
    }

    console.log('[WordPress] Rank Math 元數據更新成功');
  }

  /**
   * 獲取所有分類
   */
  async getCategories(): Promise<WordPressTaxonomy[]> {
    const url = `${this.baseUrl}/categories?per_page=100`;
    console.log('[WordPress] 獲取分類:', url);

    try {
      const response = await fetch(url, {
        headers: this.headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[WordPress] 獲取分類失敗:', response.status, errorText);
        throw new Error(`獲取分類失敗: ${response.status} - ${errorText}`);
      }

      const categories = await response.json();
      console.log('[WordPress] 成功獲取', categories.length, '個分類');
      return categories.map((cat: any) => WordPressTaxonomySchema.parse(cat));
    } catch (error) {
      if (error instanceof Error) {
        console.error('[WordPress] 分類 API 錯誤:', error.message);
      }
      throw error;
    }
  }

  /**
   * 創建新分類
   */
  async createCategory(name: string, slug?: string, parent?: number): Promise<WordPressTaxonomy> {
    console.log('[WordPress] 創建新分類:', name);

    const data: any = { name, slug: slug || this.slugify(name) };
    if (parent) data.parent = parent;

    const response = await fetch(`${this.baseUrl}/categories`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`創建分類失敗: ${response.status} - ${error}`);
    }

    const category = await response.json();
    return WordPressTaxonomySchema.parse(category);
  }

  /**
   * 獲取所有標籤
   */
  async getTags(): Promise<WordPressTaxonomy[]> {
    const url = `${this.baseUrl}/tags?per_page=100`;
    console.log('[WordPress] 獲取標籤:', url);

    try {
      const response = await fetch(url, {
        headers: this.headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[WordPress] 獲取標籤失敗:', response.status, errorText);
        throw new Error(`獲取標籤失敗: ${response.status} - ${errorText}`);
      }

      const tags = await response.json();
      console.log('[WordPress] 成功獲取', tags.length, '個標籤');
      return tags.map((tag: any) => WordPressTaxonomySchema.parse(tag));
    } catch (error) {
      if (error instanceof Error) {
        console.error('[WordPress] 標籤 API 錯誤:', error.message);
      }
      throw error;
    }
  }

  /**
   * 創建新標籤
   */
  async createTag(name: string, slug?: string): Promise<WordPressTaxonomy> {
    console.log('[WordPress] 創建新標籤:', name);

    const response = await fetch(`${this.baseUrl}/tags`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        name,
        slug: slug || this.slugify(name)
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`創建標籤失敗: ${response.status} - ${error}`);
    }

    const tag = await response.json();
    return WordPressTaxonomySchema.parse(tag);
  }

  /**
   * 上傳圖片到媒體庫
   */
  async uploadMedia(
    file: Buffer | Blob,
    filename: string,
    altText?: string,
    caption?: string
  ): Promise<WordPressMedia> {
    console.log('[WordPress] 上傳媒體:', filename);

    const formData = new FormData();

    if (file instanceof Buffer) {
      formData.append('file', new Blob([file as any]), filename);
    } else {
      formData.append('file', file as Blob, filename);
    }

    if (altText) formData.append('alt_text', altText);
    if (caption) formData.append('caption', caption);

    const response = await fetch(`${this.baseUrl}/media`, {
      method: 'POST',
      headers: {
        'Authorization': this.headers['Authorization']
        // 不設置 Content-Type，讓瀏覽器自動設置 multipart/form-data
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`上傳媒體失敗: ${response.status} - ${error}`);
    }

    const media = await response.json();
    return WordPressMediaSchema.parse(media);
  }

  /**
   * 從 URL 上傳圖片
   */
  async uploadMediaFromUrl(
    imageUrl: string,
    filename?: string,
    altText?: string
  ): Promise<WordPressMedia> {
    try {
      // 下載圖片
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`無法下載圖片: ${imageUrl}`);
      }

      const blob = await imageResponse.blob();
      const name = filename || this.getFilenameFromUrl(imageUrl);

      return await this.uploadMedia(blob, name, altText);

    } catch (error) {
      console.error('[WordPress] 從 URL 上傳圖片錯誤:', error);
      throw error;
    }
  }

  /**
   * 批量創建或獲取分類和標籤
   */
  async ensureTaxonomies(
    categories: string[],
    tags: string[]
  ): Promise<{
    categoryIds: number[];
    tagIds: number[];
  }> {
    const [existingCategories, existingTags] = await Promise.all([
      this.getCategories(),
      this.getTags()
    ]);

    // 處理分類
    const categoryIds: number[] = [];
    for (const catName of categories) {
      const existing = existingCategories.find(
        c => c.name.toLowerCase() === catName.toLowerCase()
      );

      if (existing) {
        categoryIds.push(existing.id);
      } else {
        const newCat = await this.createCategory(catName);
        categoryIds.push(newCat.id);
      }
    }

    // 處理標籤
    const tagIds: number[] = [];
    for (const tagName of tags) {
      const existing = existingTags.find(
        t => t.name.toLowerCase() === tagName.toLowerCase()
      );

      if (existing) {
        tagIds.push(existing.id);
      } else {
        const newTag = await this.createTag(tagName);
        tagIds.push(newTag.id);
      }
    }

    return { categoryIds, tagIds };
  }

  /**
   * 發布完整文章（包含圖片、分類、標籤）
   */
  async publishArticle(
    article: {
      title: string;
      content: string;
      excerpt?: string;
      slug?: string;
      featuredImageUrl?: string;
      categories?: string[];
      tags?: string[];
      seoTitle?: string;
      seoDescription?: string;
      focusKeyword?: string;
    },
    status: 'publish' | 'draft' = 'publish'
  ): Promise<{
    post: WordPressPost;
    featuredMediaId?: number;
    categoryIds: number[];
    tagIds: number[];
  }> {
    console.log('[WordPress] 發布完整文章:', article.title);

    try {
      // 1. 處理分類和標籤
      const { categoryIds, tagIds } = await this.ensureTaxonomies(
        article.categories || [],
        article.tags || []
      );

      // 2. 上傳精選圖片（如果有）
      let featuredMediaId: number | undefined;
      if (article.featuredImageUrl) {
        try {
          const media = await this.uploadMediaFromUrl(
            article.featuredImageUrl,
            undefined,
            article.title
          );
          featuredMediaId = media.id;
        } catch (error) {
          console.error('[WordPress] 上傳精選圖片失敗:', error);
        }
      }

      // 3. 創建文章（支援 Yoast SEO 和 Rank Math SEO）
      const post = await this.createPost({
        title: article.title,
        content: article.content,
        excerpt: article.excerpt,
        slug: article.slug,
        status,
        categories: categoryIds,
        tags: tagIds,
        featured_media: featuredMediaId,
        yoast_meta: {
          yoast_wpseo_title: article.seoTitle,
          yoast_wpseo_metadesc: article.seoDescription,
          yoast_wpseo_focuskw: article.focusKeyword
        },
        rank_math_meta: {
          rank_math_title: article.seoTitle,
          rank_math_description: article.seoDescription,
          rank_math_focus_keyword: article.focusKeyword,
          rank_math_robots: ['index', 'follow']
        }
      });

      console.log('[WordPress] 文章發布成功！');
      console.log(`  - 文章 ID: ${post.id}`);
      console.log(`  - 文章連結: ${post.link}`);
      console.log(`  - 分類: ${categoryIds.length} 個`);
      console.log(`  - 標籤: ${tagIds.length} 個`);

      return {
        post,
        featuredMediaId,
        categoryIds,
        tagIds
      };

    } catch (error) {
      console.error('[WordPress] 發布文章失敗:', error);
      throw error;
    }
  }

  // === 輔助方法 ===

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private getFilenameFromUrl(url: string): string {
    const parts = url.split('/');
    return parts[parts.length - 1] || 'image.jpg';
  }

  /**
   * 使用 JWT 外掛進行身份驗證
   */
  async authenticateWithJWT(
    username: string,
    password: string
  ): Promise<{
    token: string;
    user_email: string;
    user_nicename: string;
    user_display_name: string;
  }> {
    const response = await fetch(`${this.config.url}/wp-json/jwt-auth/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`JWT 認證失敗: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * 驗證 JWT Token 是否有效
   */
  async validateJWTToken(token: string): Promise<boolean> {
    const response = await fetch(`${this.config.url}/wp-json/jwt-auth/v1/token/validate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.ok;
  }

  /**
   * 刷新 OAuth Token
   */
  async refreshAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const response = await fetch(`${this.config.url}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      throw new Error(`Token 刷新失敗: ${response.status}`);
    }

    return await response.json();
  }
}

export default WordPressClient;