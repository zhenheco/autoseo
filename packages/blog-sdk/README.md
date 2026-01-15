# @1wayseo/blog-sdk

SDK for integrating 1waySEO blog content into your website.

## Installation

```bash
npm install @1wayseo/blog-sdk
# or
pnpm add @1wayseo/blog-sdk
# or
yarn add @1wayseo/blog-sdk
```

## Quick Start

```typescript
import { createBlogClient } from "@1wayseo/blog-sdk";

const blog = createBlogClient({
  apiKey: process.env.SITE_API_KEY!,
});

// 取得文章列表
const { articles, pagination } = await blog.getArticles({
  page: 1,
  limit: 10,
  lang: "zh-TW",
});

// 取得單篇文章
const { article, translations } = await blog.getArticle("my-article-slug", {
  lang: "zh-TW",
});
```

## API Reference

### `createBlogClient(options)`

建立 Blog API Client。

**Options:**

| 參數      | 類型     | 必填 | 說明                                      |
| --------- | -------- | ---- | ----------------------------------------- |
| `apiKey`  | `string` | ✅   | API Key（sk_site_xxx 格式）               |
| `baseUrl` | `string` | ❌   | API 基礎 URL（預設：https://1wayseo.com） |
| `timeout` | `number` | ❌   | 請求超時時間（毫秒，預設：30000）         |

### `blog.getArticles(options?)`

取得文章列表。

**Options:**

| 參數       | 類型     | 預設值 | 說明                 |
| ---------- | -------- | ------ | -------------------- |
| `page`     | `number` | `1`    | 頁碼                 |
| `limit`    | `number` | `10`   | 每頁數量（最大 100） |
| `lang`     | `string` | -      | 語系篩選             |
| `category` | `string` | -      | 分類篩選             |
| `tag`      | `string` | -      | 標籤篩選             |

**Response:**

```typescript
{
  articles: Article[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number,
    hasMore: boolean,
  },
  availableLanguages: string[],
}
```

### `blog.getArticle(slug, options?)`

取得單篇文章。

**Parameters:**

| 參數           | 類型     | 說明                 |
| -------------- | -------- | -------------------- |
| `slug`         | `string` | 文章 slug            |
| `options.lang` | `string` | 語系（預設返回原文） |

**Response:**

```typescript
{
  article: ArticleDetail,
  translations: Record<string, TranslationSummary>,
}
```

### `blog.getCategories()`

取得分類列表。

**Response:**

```typescript
{
  categories: Array<{ name: string, count: number }>,
  total: number,
}
```

### `blog.getTags()`

取得標籤列表。

**Response:**

```typescript
{
  tags: Array<{ name: string, count: number }>,
  total: number,
}
```

### `blog.getLanguages()`

取得語系列表。

**Response:**

```typescript
{
  languages: Array<{
    code: string,
    name: string,
    articleCount: number,
    isDefault: boolean,
  }>,
  defaultLanguage: string,
}
```

### `blog.getRateLimitInfo()`

取得最後一次請求的 Rate Limit 資訊。

**Response:**

```typescript
{
  limit: number,      // 每分鐘請求上限
  remaining: number,  // 剩餘請求數
  resetAt: number,    // 重置時間（Unix timestamp）
  used: number,       // 已使用請求數
} | null
```

## Types

### Article

```typescript
interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  featuredImageUrl: string | null;
  categories: string[];
  tags: string[];
  readingTime: number | null;
  publishedAt: string | null;
  language: string;
}
```

### ArticleDetail

```typescript
interface ArticleDetail extends Article {
  htmlContent: string | null;
  markdownContent: string | null;
  featuredImageAlt: string | null;
  wordCount: number | null;
  metaTitle: string | null;
  metaDescription: string | null;
}
```

## Error Handling

```typescript
import { createBlogClient, BlogApiError } from "@1wayseo/blog-sdk";

const blog = createBlogClient({ apiKey: "sk_site_xxx" });

try {
  const { article } = await blog.getArticle("non-existent-slug");
} catch (error) {
  if (error instanceof BlogApiError) {
    console.error(`API Error: ${error.message}`);
    console.error(`Status: ${error.status}`);
    console.error(`Code: ${error.code}`);
  }
}
```

### Error Status Codes

| 狀態碼 | 說明             |
| ------ | ---------------- |
| `401`  | 無效的 API Key   |
| `404`  | 資源不存在       |
| `408`  | 請求超時         |
| `429`  | 請求次數超過限制 |
| `500`  | 伺服器錯誤       |

## Rate Limiting

API 有每分鐘 100 次請求的限制。你可以使用 `getRateLimitInfo()` 來監控使用量：

```typescript
const { articles } = await blog.getArticles();
const rateLimit = blog.getRateLimitInfo();

if (rateLimit && rateLimit.remaining < 10) {
  console.warn("Rate limit is running low!");
}
```

## Next.js Integration Example

### Server Component (App Router)

```typescript
// app/blog/page.tsx
import { createBlogClient } from '@1wayseo/blog-sdk'

const blog = createBlogClient({
  apiKey: process.env.SITE_API_KEY!,
})

export default async function BlogPage() {
  const { articles, pagination } = await blog.getArticles({
    page: 1,
    limit: 10,
  })

  return (
    <div>
      {articles.map((article) => (
        <article key={article.id}>
          <h2>{article.title}</h2>
          <p>{article.excerpt}</p>
        </article>
      ))}
    </div>
  )
}
```

### Dynamic Article Page

```typescript
// app/blog/[slug]/page.tsx
import { createBlogClient } from '@1wayseo/blog-sdk'
import { notFound } from 'next/navigation'
import DOMPurify from 'isomorphic-dompurify'

const blog = createBlogClient({
  apiKey: process.env.SITE_API_KEY!,
})

export default async function ArticlePage({
  params,
}: {
  params: { slug: string }
}) {
  try {
    const { article, translations } = await blog.getArticle(params.slug)

    // 重要：使用 DOMPurify 清理 HTML 內容以防止 XSS 攻擊
    const sanitizedHtml = DOMPurify.sanitize(article.htmlContent || '')

    return (
      <article>
        <h1>{article.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
      </article>
    )
  } catch (error) {
    notFound()
  }
}
```

> **安全提醒**：渲染 HTML 內容時，請務必使用 [DOMPurify](https://github.com/cure53/DOMPurify) 或類似的 HTML 清理工具來防止 XSS 攻擊。

## License

MIT
