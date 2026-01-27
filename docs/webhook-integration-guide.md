# 1waySEO 文章同步 Webhook 整合指南

本文件說明如何在您的網站接收來自 1waySEO 的文章同步 webhook。

## 概述

當文章在 1waySEO 發布、更新或刪除時，系統會透過 HTTP POST 將文章資料推送到您設定的 webhook URL。

### 架構圖

```
┌─────────────┐    HTTP POST     ┌──────────────────┐
│   1waySEO   │ ───────────────> │   您的網站       │
│  (發送方)    │   with HMAC      │  /api/webhooks   │
└─────────────┘   簽章驗證       └──────────────────┘
```

## 快速開始

### 1. 建立 Webhook Endpoint

在您的網站建立一個 API 路由來接收 webhook：

**Next.js (App Router) 範例：**

```typescript
// app/api/webhooks/1wayseo/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// 您的 webhook secret（與 1waySEO 設定相同）
const WEBHOOK_SECRET = process.env.ONESEO_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  try {
    // 1. 取得 headers 和 body
    const signature = req.headers.get("x-webhook-signature");
    const timestamp = req.headers.get("x-webhook-timestamp");
    const body = await req.text();

    // 2. 驗證簽章
    if (!verifySignature(body, signature, timestamp)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // 3. 解析 payload
    const payload = JSON.parse(body);
    console.log("Received webhook:", payload.event);

    // 4. 根據事件類型處理
    switch (payload.event) {
      case "article.created":
        await handleArticleCreated(payload.article);
        break;
      case "article.updated":
        await handleArticleUpdated(payload.article);
        break;
      case "article.deleted":
        await handleArticleDeleted(payload.article);
        break;
      default:
        console.warn("Unknown event:", payload.event);
    }

    // 5. 回應成功
    return NextResponse.json({
      success: true,
      received_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * 驗證 HMAC-SHA256 簽章
 */
function verifySignature(
  payload: string,
  signature: string | null,
  timestamp: string | null
): boolean {
  if (!signature || !timestamp) {
    return false;
  }

  // 檢查時間戳是否在 5 分鐘內
  const ts = parseInt(timestamp, 10);
  const age = Date.now() - ts;
  if (age > 5 * 60 * 1000 || age < -60000) {
    console.error("Signature expired or invalid timestamp");
    return false;
  }

  // 生成預期的簽章
  const signaturePayload = `${timestamp}.${payload}`;
  const expectedSignature =
    "sha256=" +
    crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(signaturePayload, "utf8")
      .digest("hex");

  // 使用 timingSafeEqual 防止時序攻擊
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * 處理文章建立
 */
async function handleArticleCreated(article: ArticleData) {
  // 將文章存入您的資料庫
  console.log("Creating article:", article.title);
  // await db.articles.create({ data: mapToYourSchema(article) });
}

/**
 * 處理文章更新
 */
async function handleArticleUpdated(article: ArticleData) {
  console.log("Updating article:", article.source_id);
  // await db.articles.update({
  //   where: { sourceId: article.source_id },
  //   data: mapToYourSchema(article),
  // });
}

/**
 * 處理文章刪除
 */
async function handleArticleDeleted(article: ArticleData) {
  console.log("Deleting article:", article.source_id);
  // await db.articles.delete({
  //   where: { sourceId: article.source_id },
  // });
}
```

### 2. 設定環境變數

```bash
# .env.local
ONESEO_WEBHOOK_SECRET=your_secret_key_here
```

### 3. 在 1waySEO 設定您的網站

1. 登入 1waySEO 管理後台
2. 前往「系統管理 > 同步目標」
3. 新增您的網站，填入：
   - **網站名稱**：顯示用名稱
   - **Webhook URL**：`https://your-domain.com/api/webhooks/1wayseo`
   - **Webhook Secret**：與您環境變數相同的密鑰

---

## HTTP 請求格式

### Headers

| Header | 說明 | 範例 |
|--------|------|------|
| `Content-Type` | 固定為 JSON | `application/json` |
| `x-webhook-timestamp` | Unix 時間戳（毫秒） | `1706313600000` |
| `x-webhook-signature` | HMAC-SHA256 簽章 | `sha256=abc123...` |
| `User-Agent` | 識別來源 | `1waySEO-ArticleSync/1.0` |

### 簽章驗證

簽章使用 HMAC-SHA256 演算法：

```
簽章 = HMAC-SHA256(timestamp + "." + body, secret)
格式 = "sha256=" + hex(簽章)
```

**重要**：
- 時間戳有效期為 **5 分鐘**
- 超過 5 分鐘的請求應拒絕
- 使用 `timingSafeEqual` 比對簽章以防止時序攻擊

---

## Payload 格式

### 完整結構

```typescript
interface WebhookPayload {
  // 事件類型
  event: "article.created" | "article.updated" | "article.deleted";

  // 事件時間（ISO 8601）
  timestamp: string;

  // 文章資料
  article: {
    // 識別資訊
    source_id: string;     // 1waySEO 的文章 ID（UUID）
    slug: string;          // URL 友善的識別碼

    // 內容
    title: string;
    excerpt: string | null;
    html_content: string;  // 完整 HTML 內容
    markdown_content?: string;

    // 分類
    categories: string[];
    tags: string[];

    // 語言
    language: string;      // 例如 "zh-TW", "en-US"
    translations?: TranslationData[];

    // SEO
    seo_title: string | null;
    seo_description: string | null;
    focus_keyword: string | null;
    keywords: string[];

    // 媒體
    featured_image_url: string | null;
    featured_image_alt: string | null;

    // 統計
    word_count: number | null;
    reading_time: number | null;  // 分鐘

    // 時間戳
    published_at: string | null;
    created_at: string;
    updated_at: string;
  };

  // 元資料
  metadata?: {
    source: string;    // "1wayseo"
    version: string;   // API 版本
  };
}

interface TranslationData {
  language: string;
  title: string;
  slug: string;
  excerpt: string | null;
  html_content: string;
  seo_title: string | null;
  seo_description: string | null;
}
```

### 範例 Payload

```json
{
  "event": "article.created",
  "timestamp": "2026-01-27T10:30:00.000Z",
  "article": {
    "source_id": "550e8400-e29b-41d4-a716-446655440000",
    "slug": "how-to-optimize-seo-2026",
    "title": "2026 年 SEO 優化完整指南",
    "excerpt": "本文將介紹最新的 SEO 優化技巧...",
    "html_content": "<h2>SEO 基礎</h2><p>搜尋引擎優化（SEO）是...</p>",
    "categories": ["SEO", "數位行銷"],
    "tags": ["SEO", "Google", "排名"],
    "language": "zh-TW",
    "translations": [
      {
        "language": "en-US",
        "title": "Complete Guide to SEO Optimization in 2026",
        "slug": "how-to-optimize-seo-2026-en",
        "excerpt": "This article introduces the latest SEO tips...",
        "html_content": "<h2>SEO Basics</h2><p>Search Engine Optimization...</p>",
        "seo_title": "SEO Guide 2026 | Best Practices",
        "seo_description": "Learn the latest SEO techniques..."
      }
    ],
    "seo_title": "2026 SEO 優化指南 | 完整教學",
    "seo_description": "學習最新的 SEO 優化技巧，提升網站排名",
    "focus_keyword": "SEO 優化",
    "keywords": ["SEO", "搜尋引擎優化", "網站排名"],
    "featured_image_url": "https://example.com/images/seo-guide.jpg",
    "featured_image_alt": "SEO 優化示意圖",
    "word_count": 2500,
    "reading_time": 10,
    "published_at": "2026-01-27T10:30:00.000Z",
    "created_at": "2026-01-25T08:00:00.000Z",
    "updated_at": "2026-01-27T10:30:00.000Z"
  },
  "metadata": {
    "source": "1wayseo",
    "version": "1.0"
  }
}
```

---

## 預期回應

### 成功

```json
{
  "success": true,
  "received_at": "2026-01-27T10:30:01.000Z"
}
```

HTTP Status: `200 OK`

### 失敗

```json
{
  "success": false,
  "error": "Database connection failed"
}
```

HTTP Status: `500 Internal Server Error`

---

## 重試機制

1waySEO 會在以下情況自動重試：

| 狀況 | 重試 | 說明 |
|------|------|------|
| HTTP 5xx | ✅ 是 | 最多重試 3 次 |
| HTTP 4xx | ❌ 否 | 視為永久失敗 |
| 網路錯誤 | ✅ 是 | 連線超時、DNS 失敗等 |
| 簽章驗證失敗 | ❌ 否 | 視為安全問題 |

**重試間隔**：指數退避（1秒、2秒、4秒...）

---

## 健康檢查（選用）

建議實作健康檢查 endpoint，讓 1waySEO 可以驗證您的網站狀態：

```typescript
// app/api/webhooks/1wayseo/health/route.ts
export async function GET() {
  return Response.json({
    status: "ready",
    version: "1.0",
    timestamp: new Date().toISOString(),
  });
}
```

---

## 資料對應建議

### 資料庫 Schema 建議

```sql
CREATE TABLE synced_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id VARCHAR(255) UNIQUE NOT NULL,  -- 1waySEO 的 article ID
  slug VARCHAR(255) NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  html_content TEXT NOT NULL,
  language VARCHAR(10) DEFAULT 'zh-TW',
  categories JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  seo_title TEXT,
  seo_description TEXT,
  featured_image_url TEXT,
  featured_image_alt TEXT,
  word_count INTEGER,
  reading_time INTEGER,
  source_published_at TIMESTAMPTZ,
  source_created_at TIMESTAMPTZ,
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_synced_articles_source_id ON synced_articles(source_id);
CREATE INDEX idx_synced_articles_slug ON synced_articles(slug);
CREATE INDEX idx_synced_articles_language ON synced_articles(language);
```

### TypeScript Interface

```typescript
interface SyncedArticle {
  id: string;
  sourceId: string;
  slug: string;
  title: string;
  excerpt: string | null;
  htmlContent: string;
  language: string;
  categories: string[];
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  wordCount: number | null;
  readingTime: number | null;
  sourcePublishedAt: Date | null;
  sourceCreatedAt: Date;
  sourceUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 安全最佳實踐

1. **永遠驗證簽章** - 不要跳過 HMAC 驗證
2. **檢查時間戳** - 拒絕超過 5 分鐘的請求
3. **使用 HTTPS** - Webhook URL 必須使用 HTTPS
4. **記錄日誌** - 記錄所有 webhook 請求以便除錯
5. **冪等處理** - 使用 `source_id` 確保重複請求不會產生重複資料

---

## 常見問題

### Q: 收到 401 Unauthorized？

檢查：
1. `ONESEO_WEBHOOK_SECRET` 環境變數是否正確設定
2. 是否與 1waySEO 後台設定的 secret 一致
3. 伺服器時間是否正確（時間差超過 5 分鐘會驗證失敗）

### Q: 收到 500 Internal Server Error？

檢查：
1. 伺服器日誌中的錯誤訊息
2. 資料庫連線是否正常
3. Payload 解析是否有問題

### Q: 如何測試 webhook？

使用 curl 測試：

```bash
curl -X POST https://your-domain.com/api/webhooks/1wayseo \
  -H "Content-Type: application/json" \
  -H "x-webhook-timestamp: $(date +%s)000" \
  -H "x-webhook-signature: sha256=test" \
  -d '{"event":"article.created","timestamp":"2026-01-27T00:00:00Z","article":{"source_id":"test","slug":"test","title":"Test"}}'
```

（注意：實際測試需要正確的簽章）

---

## 支援

如有問題，請聯繫 1waySEO 技術支援或參考 API 文件。
