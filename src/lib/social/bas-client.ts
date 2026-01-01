/**
 * 發文小助手 API Client
 *
 * 封裝發文小助手系統的外部 API
 * 文件：/Users/avyshiu/外部API使用指南.md
 */

// ============================================
// 型別定義
// ============================================

/** 社群平台類型 */
export type SocialPlatform = "facebook" | "instagram" | "threads";

/** 媒體類型 */
export type MediaType = "image" | "video";

/** 發文狀態 */
export type PostStatus = "pending" | "scheduled" | "published" | "failed";

/** 已連結帳號 */
export interface BasAccount {
  id: string;
  platform: SocialPlatform;
  username: string;
  pageId: string | null;
  pageName: string | null;
  followersCount: number | null;
  createdAt: string;
}

/** 帳號列表回應 */
export interface AccountsResponse {
  success: boolean;
  data: BasAccount[];
  total: number;
}

/** 建立發文請求 */
export interface CreatePostRequest {
  content: string;
  platforms?: SocialPlatform[];
  selectedAccounts?: {
    platform: SocialPlatform;
    accountId: string;
    accountName: string;
  }[];
  mediaUrl?: string;
  mediaType?: MediaType;
  scheduledTime?: string; // ISO 8601 格式
  hashtags?: string[];
  mentions?: string[];
}

/** 建立發文回應 */
export interface CreatePostResponse {
  success: boolean;
  postId: string;
  status: string;
  message: string;
  error?: string; // 錯誤訊息（失敗時由巴斯系統返回）
  data: {
    id: string;
    content: string;
    platforms: SocialPlatform[];
    mediaUrl?: string;
    mediaType?: MediaType;
  };
}

/** 發文狀態回應 */
export interface PostStatusResponse {
  success: boolean;
  data: {
    id: string;
    content: string;
    platforms: SocialPlatform[];
    status: PostStatus;
    isPublished: boolean;
    scheduledTime: string | null;
    createdAt: string;
    mediaUrl?: string;
    mediaType?: MediaType;
    metadata?: Record<string, unknown>;
  };
}

/** 發文列表回應 */
export interface PostsListResponse {
  success: boolean;
  data: PostStatusResponse["data"][];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

/** 使用量回應 */
export interface UsageResponse {
  success: boolean;
  data: {
    plan: string;
    quota: {
      monthlyCredits: number;
      monthlyPosts: number;
      monthlyApiCalls: number;
    };
    usage: {
      creditsUsed: number;
      postsCreated: number;
      apiCalls: number;
    };
    remaining: {
      credits: number;
      posts: number;
      apiCalls: number;
    };
    billingCycleStart: string;
  };
}

/** API 錯誤 */
export interface BasApiError {
  error: string;
  message: string;
  current?: number;
  limit?: number;
}

// ============================================
// Client 類別
// ============================================

export class BasSocialClient {
  private baseUrl: string;
  private apiKey: string;
  private userId: string;

  constructor(config: { apiKey: string; userId: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.userId = config.userId;
    this.baseUrl =
      config.baseUrl ||
      process.env.BAS_SOCIAL_API_URL ||
      "https://bas.zhenhe-dm.com/api/external";
  }

  /**
   * 發送 API 請求
   */
  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    endpoint: string,
    body?: object,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
      "x-user-id": this.userId,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method !== "GET") {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      // 處理速率限制
      if (response.status === 429) {
        const errorData = (await response.json()) as BasApiError;
        throw new BasRateLimitError(
          errorData.message || "API 呼叫次數已達上限",
          errorData.current,
          errorData.limit,
        );
      }

      // 處理其他錯誤
      if (!response.ok) {
        const errorData = (await response.json()) as BasApiError;
        throw new BasApiRequestError(
          errorData.message || `API 錯誤: ${response.status}`,
          response.status,
          errorData.error,
        );
      }

      return response.json() as Promise<T>;
    } catch (error) {
      // 如果已經是我們的錯誤類型，直接拋出
      if (
        error instanceof BasRateLimitError ||
        error instanceof BasApiRequestError
      ) {
        throw error;
      }

      // 網路錯誤或其他錯誤
      throw new BasApiRequestError(
        error instanceof Error ? error.message : "未知錯誤",
        0,
        "NETWORK_ERROR",
      );
    }
  }

  // ============================================
  // 帳號相關 API
  // ============================================

  /**
   * 取得已連結的社群帳號
   * @param platform 可選，篩選特定平台
   */
  async getAccounts(platform?: SocialPlatform): Promise<AccountsResponse> {
    const query = platform ? `?platform=${platform}` : "";
    return this.request<AccountsResponse>("GET", `/accounts${query}`);
  }

  // ============================================
  // 發文相關 API
  // ============================================

  /**
   * 建立發文（立即或排程）
   */
  async createPost(data: CreatePostRequest): Promise<CreatePostResponse> {
    // 驗證：platforms 和 selectedAccounts 至少要提供一個
    if (
      (!data.platforms || data.platforms.length === 0) &&
      (!data.selectedAccounts || data.selectedAccounts.length === 0)
    ) {
      throw new BasApiRequestError(
        "必須指定 platforms 或 selectedAccounts",
        400,
        "VALIDATION_ERROR",
      );
    }

    return this.request<CreatePostResponse>("POST", "/create-post", data);
  }

  /**
   * 查詢發文狀態
   * @param postId 發文 ID
   */
  async getPostStatus(postId: string): Promise<PostStatusResponse> {
    return this.request<PostStatusResponse>("GET", `/post-status/${postId}`);
  }

  /**
   * 列出所有發文
   */
  async listPosts(options?: {
    status?: PostStatus;
    platform?: SocialPlatform;
    limit?: number;
    offset?: number;
  }): Promise<PostsListResponse> {
    const params = new URLSearchParams();
    if (options?.status) params.append("status", options.status);
    if (options?.platform) params.append("platform", options.platform);
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.offset) params.append("offset", options.offset.toString());

    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<PostsListResponse>("GET", `/posts${query}`);
  }

  /**
   * 取消/刪除排程發文
   * @param postId 發文 ID
   */
  async deletePost(
    postId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      "DELETE",
      `/post/${postId}`,
    );
  }

  // ============================================
  // 使用量相關 API
  // ============================================

  /**
   * 查詢 API 使用量和配額
   */
  async getUsage(): Promise<UsageResponse> {
    return this.request<UsageResponse>("GET", "/usage");
  }
}

// ============================================
// 自訂錯誤類別
// ============================================

/** API 請求錯誤 */
export class BasApiRequestError extends Error {
  public statusCode: number;
  public errorType: string;

  constructor(message: string, statusCode: number, errorType: string) {
    super(message);
    this.name = "BasApiRequestError";
    this.statusCode = statusCode;
    this.errorType = errorType;
  }
}

/** 速率限制錯誤 */
export class BasRateLimitError extends Error {
  public current?: number;
  public limit?: number;

  constructor(message: string, current?: number, limit?: number) {
    super(message);
    this.name = "BasRateLimitError";
    this.current = current;
    this.limit = limit;
  }
}

// ============================================
// 工廠函數
// ============================================

/**
 * 從資料庫設定建立 Client
 */
export function createBasClientFromConfig(config: {
  bas_api_key: string;
  bas_user_id: string;
}): BasSocialClient {
  return new BasSocialClient({
    apiKey: config.bas_api_key,
    userId: config.bas_user_id,
  });
}
