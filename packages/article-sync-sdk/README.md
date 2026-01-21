# @1wayseo/article-sync-sdk

SDK for syncing articles from 1waySEO to external projects.

## Installation

```bash
pnpm add @1wayseo/article-sync-sdk
```

## Quick Start

### 1. Run Migration

First, create the `synced_articles` table in your Supabase database:

```sql
-- Copy from packages/article-sync-sdk/src/setup/migrations/synced_articles.sql
```

Or use the SDK to get the migration SQL:

```typescript
import { getMigrationSQL } from "@1wayseo/article-sync-sdk/migrations";
console.log(getMigrationSQL());
```

### 2. Set Up Webhook Endpoint

Create an API route to receive article sync events:

```typescript
// app/api/webhooks/1wayseo/route.ts
import { createWebhookHandler } from "@1wayseo/article-sync-sdk/nextjs";

export const POST = createWebhookHandler({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY!,
  webhookSecret: process.env.ONEWAYSEO_WEBHOOK_SECRET!,
});
```

### 3. Query Articles

Use the `SyncClient` to query synced articles:

```typescript
import { createSyncClient } from "@1wayseo/article-sync-sdk";

const client = createSyncClient({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_ANON_KEY!,
});

// Get articles list
const { articles, total, hasMore } = await client.getArticles({
  limit: 10,
  language: "zh-TW",
});

// Get single article
const { article } = await client.getArticleBySlug("my-article-slug");
```

### 4. React Hooks

Use hooks in React components:

```tsx
"use client";

import { useArticles, useArticle } from "@1wayseo/article-sync-sdk/react";

function ArticleList() {
  const config = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  };

  const { articles, isLoading, error } = useArticles(config, {
    limit: 10,
    language: "zh-TW",
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {articles.map((article) => (
        <li key={article.id}>{article.title}</li>
      ))}
    </ul>
  );
}
```

## Environment Variables

Add these to your `.env.local`:

```env
# Supabase
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# 1waySEO Webhook
ONEWAYSEO_WEBHOOK_SECRET=your-webhook-secret
```

## API Reference

### SyncClient

| Method | Description |
|--------|-------------|
| `getArticles(options)` | Get paginated article list |
| `getArticleBySlug(slug)` | Get single article by slug |
| `getArticleBySourceId(id)` | Get article by 1waySEO ID |
| `getCategories()` | Get all categories |
| `getTags()` | Get all tags |
| `getRelatedArticles(id, limit)` | Get related articles |
| `searchArticles(query, options)` | Search articles |

### React Hooks

| Hook | Description |
|------|-------------|
| `useArticles(config, options)` | Fetch article list |
| `useArticle(config, slug)` | Fetch single article |
| `useArticleBySourceId(config, id)` | Fetch by source ID |

### Webhook Events

| Event | Description |
|-------|-------------|
| `article.created` | New article published |
| `article.updated` | Article updated |
| `article.deleted` | Article unpublished |

## License

MIT
