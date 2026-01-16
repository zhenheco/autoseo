# 外部網站 API 整合指南

> 讓你的 Next.js 網站透過 API 拉取 1wayseo SEO 系統生成的文章

## 目錄

- [概述](#概述)
- [快速開始](#快速開始)
- [SDK 安裝與設定](#sdk-安裝與設定)
- [SDK 使用範例](#sdk-使用範例)
- [API 端點參考](#api-端點參考)
- [錯誤處理](#錯誤處理)
- [Rate Limiting](#rate-limiting)
- [最佳實踐](#最佳實踐)
- [常見問題](#常見問題)

---

## 概述

### 架構說明

```
┌──────────────────────────────────────────────┐
│           1wayseo.com（內容中心）              │
│  • AI 文章生成                                │
│  • 多語系翻譯管理                              │
│  • 統一內容管理                                │
│  • REST API 提供                              │
└──────────────────────────────────────────────┘
                    │
                    │ API Key 認證
                    │ REST API
                    ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ 工具網站 A │  │ 工具網站 B │  │ 工具網站 C │
│ (Next.js) │  │ (Next.js) │  │ (Next.js) │
│           │  │           │  │           │
│ @1wayseo/ │  │ @1wayseo/ │  │ @1wayseo/ │
│ blog-sdk  │  │ blog-sdk  │  │ blog-sdk  │
└──────────┘  └──────────┘  └──────────┘
```

### 優點

- **統一管理**：所有網站的 SEO 文章在 1wayseo 統一管理
- **多語系支援**：自動支援多語系翻譯
- **解耦合**：各網站獨立部署，透過 API 取得內容
- **TypeScript 支援**：SDK 提供完整型別定義

---

## 快速開始

### 1. 在 1wayseo 註冊網站

1. 登入 [1wayseo.com](https://1wayseo.com) 管理後台
2. 進入「網站管理」→「外部網站」
3. 點擊「新增外部網站」
4. 填寫網站資訊後，系統會生成 **API Key**

> ⚠️ **重要**：API Key 只會顯示一次，請妥善保存！

### 2. 安裝 SDK

```bash
# npm
npm install @1wayseo/blog-sdk

# pnpm
pnpm add @1wayseo/blog-sdk

# yarn
yarn add @1wayseo/blog-sdk
```

### 3. 設定環境變數

在專案根目錄建立 `.env.local`：

```bash
# 1wayseo API 設定
SITE_API_KEY=sk_site_你的API金鑰
SITE_API_URL=https://1wayseo.com/api/v1/sites
```

### 4. 建立客戶端

```typescript
// lib/blog-client.ts
import { createBlogClient } from '@1wayseo/blog-sdk'

export const blog = createBlogClient({
  apiKey: process.env.SITE_API_KEY!,
  baseUrl: process.env.SITE_API_URL,
})
```

### 5. 使用

```typescript
// 取得文章列表
const { articles } = await blog.getArticles()

// 取得單篇文章
const { article, translations } = await blog.getArticle('my-article-slug')
```

---

## SDK 安裝與設定

### 安裝

```bash
npm install @1wayseo/blog-sdk
```

### 初始化選項

```typescript
import { createBlogClient } from '@1wayseo/blog-sdk'

const blog = createBlogClient({
  // 必填：API Key（從 1wayseo 後台取得）
  apiKey: process.env.SITE_API_KEY!,

  // 選填：API 基礎 URL（預設 https://1wayseo.com/api/v1/sites）
  baseUrl: 'https://1wayseo.com/api/v1/sites',

  // 選填：請求超時時間（預設 30000ms）
  timeout: 30000,
})
```

### 環境變數建議

```bash
# .env.local（本地開發）
SITE_API_KEY=sk_site_your_development_key

# .env.production（正式環境）
SITE_API_KEY=sk_site_your_production_key
```

---

## SDK 使用範例

### 取得文章列表

```typescript
import { blog } from '@/lib/blog-client'

// 基本用法
const { articles, pagination, availableLanguages } = await blog.getArticles()

// 帶參數
const result = await blog.getArticles({
  page: 1,           // 頁碼（預設 1）
  limit: 10,         // 每頁數量（預設 10，最大 100）
  lang: 'zh-TW',     // 語系篩選
  category: 'tech',  // 分類篩選
  tag: 'nextjs',     // 標籤篩選
})

// 回傳結構
// {
//   articles: Article[],
//   pagination: {
//     page: number,
//     limit: number,
//     total: number,
//     totalPages: number,
//     hasMore: boolean
//   },
//   availableLanguages: string[]
// }
```

### 取得單篇文章

```typescript
import { blog } from '@/lib/blog-client'

// 基本用法
const { article, translations } = await blog.getArticle('my-article-slug')

// 指定語系
const result = await blog.getArticle('my-article-slug', { lang: 'en-US' })

// 回傳結構
// {
//   article: {
//     id: string,
//     slug: string,
//     title: string,
//     content: string,
//     excerpt: string,
//     featuredImageUrl: string,
//     categories: string[],
//     tags: string[],
//     readingTime: number,
//     publishedAt: string,
//     language: string
//   },
//   translations: {
//     'en-US': { title: string, slug: string, excerpt: string },
//     'ja-JP': { title: string, slug: string, excerpt: string }
//   }
// }
```

### 取得分類列表

```typescript
const { categories, total } = await blog.getCategories()

// 回傳結構
// {
//   categories: Array<{ name: string, count: number }>,
//   total: number
// }
```

### 取得標籤列表

```typescript
const { tags, total } = await blog.getTags()

// 回傳結構
// {
//   tags: Array<{ name: string, count: number }>,
//   total: number
// }
```

### 取得語系列表

```typescript
const { languages } = await blog.getLanguages()

// 回傳結構
// {
//   languages: string[]  // ['zh-TW', 'en-US', 'ja-JP']
// }
```

### 取得 Rate Limit 資訊

```typescript
const rateLimitInfo = blog.getRateLimitInfo()

// 回傳結構（上次請求後更新）
// {
//   limit: 100,      // 每分鐘限制
//   remaining: 95,   // 剩餘次數
//   used: 5          // 已使用次數
// }
```

---

## 完整頁面範例

### 文章列表頁

```typescript
// app/blog/page.tsx
import { blog } from '@/lib/blog-client'
import Link from 'next/link'
import Image from 'next/image'

interface Props {
  searchParams: { page?: string; lang?: string }
}

export default async function BlogPage({ searchParams }: Props) {
  const page = parseInt(searchParams.page || '1')
  const lang = searchParams.lang || 'zh-TW'

  const { articles, pagination, availableLanguages } = await blog.getArticles({
    page,
    limit: 12,
    lang,
  })

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 語系切換 */}
      <div className="mb-6 flex gap-2">
        {availableLanguages.map((language) => (
          <Link
            key={language}
            href={`/blog?lang=${language}`}
            className={`px-3 py-1 rounded ${
              lang === language ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            {language}
          </Link>
        ))}
      </div>

      {/* 文章列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article) => (
          <article key={article.id} className="border rounded-lg overflow-hidden">
            {article.featuredImageUrl && (
              <Image
                src={article.featuredImageUrl}
                alt={article.title}
                width={400}
                height={200}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-4">
              <h2 className="text-xl font-bold mb-2">
                <Link href={`/blog/${article.slug}`}>
                  {article.title}
                </Link>
              </h2>
              <p className="text-gray-600 mb-4">{article.excerpt}</p>
              <div className="flex justify-between text-sm text-gray-500">
                <span>{article.readingTime} 分鐘閱讀</span>
                <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* 分頁 */}
      <div className="mt-8 flex justify-center gap-2">
        {page > 1 && (
          <Link href={`/blog?page=${page - 1}&lang=${lang}`} className="px-4 py-2 bg-gray-200 rounded">
            上一頁
          </Link>
        )}
        <span className="px-4 py-2">
          {page} / {pagination.totalPages}
        </span>
        {pagination.hasMore && (
          <Link href={`/blog?page=${page + 1}&lang=${lang}`} className="px-4 py-2 bg-gray-200 rounded">
            下一頁
          </Link>
        )}
      </div>
    </div>
  )
}
```

### 單篇文章頁

```typescript
// app/blog/[slug]/page.tsx
import { blog } from '@/lib/blog-client'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import DOMPurify from 'isomorphic-dompurify'

interface Props {
  params: { slug: string }
  searchParams: { lang?: string }
}

export default async function ArticlePage({ params, searchParams }: Props) {
  const lang = searchParams.lang

  try {
    const { article, translations } = await blog.getArticle(params.slug, { lang })

    // 安全處理 HTML 內容（防止 XSS 攻擊）
    const sanitizedContent = DOMPurify.sanitize(article.content)

    return (
      <article className="container mx-auto px-4 py-8 max-w-3xl">
        {/* 語系切換 */}
        {Object.keys(translations).length > 0 && (
          <div className="mb-6 flex gap-2">
            <Link
              href={`/blog/${article.slug}`}
              className={`px-3 py-1 rounded ${
                !lang || lang === 'zh-TW' ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
            >
              zh-TW
            </Link>
            {Object.entries(translations).map(([langCode, trans]) => (
              <Link
                key={langCode}
                href={`/blog/${trans.slug}?lang=${langCode}`}
                className={`px-3 py-1 rounded ${
                  lang === langCode ? 'bg-blue-500 text-white' : 'bg-gray-200'
                }`}
              >
                {langCode}
              </Link>
            ))}
          </div>
        )}

        {/* 文章標題 */}
        <h1 className="text-4xl font-bold mb-4">{article.title}</h1>

        {/* 文章資訊 */}
        <div className="flex gap-4 text-gray-500 mb-6">
          <span>{article.readingTime} 分鐘閱讀</span>
          <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
        </div>

        {/* 分類和標籤 */}
        <div className="flex gap-2 mb-6">
          {article.categories.map((cat) => (
            <span key={cat} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
              {cat}
            </span>
          ))}
          {article.tags.map((tag) => (
            <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">
              #{tag}
            </span>
          ))}
        </div>

        {/* 特色圖片 */}
        {article.featuredImageUrl && (
          <Image
            src={article.featuredImageUrl}
            alt={article.title}
            width={800}
            height={400}
            className="w-full rounded-lg mb-8"
          />
        )}

        {/* 文章內容（使用 DOMPurify 清理後的 HTML） */}
        <div
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
      </article>
    )
  } catch (error) {
    notFound()
  }
}

// 產生靜態路徑（ISR）
export async function generateStaticParams() {
  const { articles } = await blog.getArticles({ limit: 100 })
  return articles.map((article) => ({ slug: article.slug }))
}
```

> ⚠️ **安全提醒**：渲染 HTML 內容時，務必使用 [DOMPurify](https://github.com/cure53/DOMPurify) 或類似的 HTML 清理工具來防止 XSS 攻擊。安裝方式：`npm install isomorphic-dompurify`

### 使用 ISR 快取

```typescript
// app/blog/page.tsx
export const revalidate = 3600 // 1 小時重新驗證

// 或使用 fetch 的 revalidate
const { articles } = await blog.getArticles()
```

---

## API 端點參考

### Base URL

```
https://1wayseo.com/api/v1/sites
```

### 認證

所有請求都需要在 Header 中包含 API Key：

```
Authorization: Bearer sk_site_your_api_key
```

### 端點列表

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/articles` | 文章列表 |
| GET | `/articles/:slug` | 單篇文章 |
| GET | `/categories` | 分類列表 |
| GET | `/tags` | 標籤列表 |
| GET | `/languages` | 語系列表 |

### GET /articles

取得文章列表。

**Query 參數**：

| 參數 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| page | number | 1 | 頁碼 |
| limit | number | 10 | 每頁數量（最大 100） |
| lang | string | - | 語系篩選（如 zh-TW, en-US） |
| category | string | - | 分類篩選 |
| tag | string | - | 標籤篩選 |

**回應範例**：

```json
{
  "success": true,
  "articles": [
    {
      "id": "uuid",
      "slug": "my-article",
      "title": "文章標題",
      "excerpt": "文章摘要...",
      "featured_image_url": "https://...",
      "categories": ["tech"],
      "tags": ["nextjs", "react"],
      "reading_time": 5,
      "published_at": "2024-01-15T00:00:00Z",
      "language": "zh-TW"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasMore": true
  },
  "available_languages": ["zh-TW", "en-US", "ja-JP"]
}
```

### GET /articles/:slug

取得單篇文章及其翻譯版本。

**Query 參數**：

| 參數 | 類型 | 說明 |
|------|------|------|
| lang | string | 指定語系版本 |

**回應範例**：

```json
{
  "success": true,
  "article": {
    "id": "uuid",
    "slug": "my-article",
    "title": "文章標題",
    "content": "<p>文章內容...</p>",
    "excerpt": "文章摘要...",
    "featured_image_url": "https://...",
    "categories": ["tech"],
    "tags": ["nextjs"],
    "reading_time": 5,
    "published_at": "2024-01-15T00:00:00Z",
    "language": "zh-TW"
  },
  "translations": {
    "en-US": {
      "title": "Article Title",
      "slug": "my-article-en",
      "excerpt": "Article excerpt..."
    },
    "ja-JP": {
      "title": "記事タイトル",
      "slug": "my-article-ja",
      "excerpt": "記事の概要..."
    }
  }
}
```

---

## 錯誤處理

### SDK 錯誤處理

```typescript
import { blog, BlogApiError } from '@/lib/blog-client'

try {
  const { article } = await blog.getArticle('non-existent-slug')
} catch (error) {
  if (error instanceof BlogApiError) {
    switch (error.status) {
      case 401:
        console.error('API Key 無效或已過期')
        break
      case 404:
        console.error('文章不存在')
        break
      case 429:
        console.error('請求過於頻繁，請稍後再試')
        break
      default:
        console.error(`API 錯誤: ${error.message}`)
    }
  }
}
```

### HTTP 狀態碼

| 狀態碼 | 說明 |
|--------|------|
| 200 | 成功 |
| 401 | 認證失敗（API Key 無效或缺失） |
| 404 | 資源不存在 |
| 429 | 請求過多（超過 Rate Limit） |
| 500 | 伺服器錯誤 |

### 錯誤回應格式

```json
{
  "success": false,
  "error": "錯誤訊息"
}
```

---

## Rate Limiting

### 限制規則

- **限制**：100 次請求 / 分鐘（per API Key）
- **計算方式**：滑動窗口（Sliding Window）

### Response Headers

每個回應都會包含 Rate Limit 資訊：

```
X-RateLimit-Limit: 100        # 每分鐘限制
X-RateLimit-Remaining: 95     # 剩餘次數
X-RateLimit-Used: 5           # 已使用次數
```

### 超過限制

當超過限制時，會收到 429 狀態碼：

```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later.",
  "retryAfter": 60
}
```

### 最佳實踐

1. **使用快取**：在你的網站實作快取，減少 API 呼叫
2. **監控使用量**：透過 `blog.getRateLimitInfo()` 監控
3. **錯誤處理**：實作 429 錯誤的重試邏輯

```typescript
// 使用 ISR 減少 API 呼叫
export const revalidate = 3600 // 1 小時

// 或使用 Redis/Memory 快取
import { cache } from 'react'

export const getArticles = cache(async () => {
  return blog.getArticles()
})
```

---

## 最佳實踐

### 1. 環境變數安全

```bash
# ✅ 正確：使用環境變數
SITE_API_KEY=sk_site_xxx

# ❌ 錯誤：硬編碼在程式碼中
const apiKey = 'sk_site_xxx'
```

### 2. Server-Side 呼叫

```typescript
// ✅ 正確：在 Server Component 中呼叫
// app/blog/page.tsx
export default async function BlogPage() {
  const { articles } = await blog.getArticles()
  return <ArticleList articles={articles} />
}

// ❌ 錯誤：在 Client Component 中呼叫（會暴露 API Key）
'use client'
export default function BlogPage() {
  const [articles, setArticles] = useState([])
  useEffect(() => {
    blog.getArticles().then(/* ... */)  // API Key 會暴露！
  }, [])
}
```

### 3. HTML 內容安全

```typescript
// ✅ 正確：使用 DOMPurify 清理 HTML
import DOMPurify from 'isomorphic-dompurify'

const sanitizedContent = DOMPurify.sanitize(article.content)

// ❌ 錯誤：直接渲染未清理的 HTML（XSS 風險）
<div dangerouslySetInnerHTML={{ __html: article.content }} />
```

### 4. 錯誤邊界

```typescript
// app/blog/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="text-center py-10">
      <h2>載入文章時發生錯誤</h2>
      <button onClick={reset}>重試</button>
    </div>
  )
}
```

### 5. Loading 狀態

```typescript
// app/blog/loading.tsx
export default function Loading() {
  return (
    <div className="grid grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="bg-gray-200 h-48 rounded" />
          <div className="bg-gray-200 h-4 mt-4 rounded" />
          <div className="bg-gray-200 h-4 mt-2 w-2/3 rounded" />
        </div>
      ))}
    </div>
  )
}
```

### 6. SEO 優化

```typescript
// app/blog/[slug]/page.tsx
import { Metadata } from 'next'

export async function generateMetadata({ params }): Promise<Metadata> {
  const { article } = await blog.getArticle(params.slug)

  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: article.featuredImageUrl ? [article.featuredImageUrl] : [],
    },
  }
}
```

---

## 常見問題

### Q: API Key 遺失怎麼辦？

A: 登入 1wayseo 後台，進入「網站管理」→「外部網站」，點擊「重新生成 API Key」。注意：舊的 API Key 會立即失效。

### Q: 如何處理多語系路由？

A: 建議使用 Next.js 的國際化路由：

```typescript
// next.config.js
module.exports = {
  i18n: {
    locales: ['zh-TW', 'en-US', 'ja-JP'],
    defaultLocale: 'zh-TW',
  },
}
```

### Q: 文章圖片載入很慢？

A: 使用 Next.js Image 組件並設定 remotePatterns：

```typescript
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: '1wayseo.com',
      },
    ],
  },
}
```

### Q: 如何實作搜尋功能？

A: 目前 API 不支援全文搜尋，建議在前端實作：

```typescript
const { articles } = await blog.getArticles({ limit: 100 })
const filtered = articles.filter(
  a => a.title.includes(keyword) || a.excerpt?.includes(keyword)
)
```

### Q: Rate Limit 不夠用？

A: 聯繫 1wayseo 客服討論企業方案，或實作更積極的快取策略。

### Q: 如何安全地渲染 HTML 內容？

A: 務必使用 DOMPurify 清理 HTML 內容：

```bash
npm install isomorphic-dompurify
```

```typescript
import DOMPurify from 'isomorphic-dompurify'

// 在渲染前清理
const cleanHtml = DOMPurify.sanitize(article.content)
```

---

## 支援

- **技術問題**：請在 GitHub Issues 提出
- **API Key 問題**：聯繫 support@1wayseo.com
- **企業方案**：聯繫 sales@1wayseo.com
