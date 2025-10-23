# 📡 API 端點規格文檔

**Auto Pilot SEO** - N8N 整合 API 完整規格

版本: 1.0
最後更新: 2025-01-23

---

## 目錄

1. [認證機制](#認證機制)
2. [N8N Callback API](#n8n-callback-api)
3. [取得舊文章 API](#取得舊文章-api)
4. [錯誤處理](#錯誤處理)
5. [範例程式碼](#範例程式碼)

---

## 認證機制

所有 N8N 相關的 API 端點都使用 **Header Authentication**：

```http
X-API-Key: your_n8n_api_key_here
```

**設定方式**:
- API Key 儲存在環境變數 `N8N_API_KEY`
- N8N Workflow 中的所有 HTTP Request 節點都必須包含此 header
- 驗證失敗返回 `401 Unauthorized`

**生成 API Key**:
```bash
openssl rand -hex 32
```

---

## N8N Callback API

### 端點資訊

- **URL**: `/api/n8n/callback`
- **方法**: `POST`
- **認證**: Required (X-API-Key header)
- **Content-Type**: `application/json`

### 用途

N8N Workflow 在完成各個處理階段後，呼叫此端點更新平台中文章的狀態和資料。

### 支援的處理階段 (stage)

| Stage | 說明 | 資料欄位 |
|-------|------|---------|
| `serp_analysis` | SERP 數據分析完成 | `serp_analysis` |
| `competitor_analysis` | 競爭對手分析完成 | `competitor_analysis` |
| `content_plan` | 內容策略規劃完成 | `content_plan` |
| `content_generation` | 文章內容生成完成 | `generated_content` |
| `quality_check` | 品質檢查完成 | `quality_score`, `quality_report` |
| `wordpress_publish` | WordPress 發布完成 | `wp_post_id`, `published_at`, `status` |

### 請求格式

#### Request Headers

```http
POST /api/n8n/callback HTTP/1.1
Host: your-platform.com
Content-Type: application/json
X-API-Key: your_n8n_api_key
```

#### Request Body Schema

```typescript
interface CallbackRequest {
  articleId: string           // 文章 ID (UUID)
  stage: Stage                // 處理階段
  status: 'completed' | 'failed'  // 階段狀態
  data?: any                  // 階段資料（依 stage 而定）
  error?: string              // 錯誤訊息（status = 'failed' 時）
}

type Stage =
  | 'serp_analysis'
  | 'competitor_analysis'
  | 'content_plan'
  | 'content_generation'
  | 'quality_check'
  | 'wordpress_publish'
```

### 請求範例

#### 1. SERP 分析完成

```json
{
  "articleId": "123e4567-e89b-12d3-a456-426614174000",
  "stage": "serp_analysis",
  "status": "completed",
  "data": {
    "top_10_urls": [
      "https://example.com/article-1",
      "https://example.com/article-2"
    ],
    "common_topics": [
      "Next.js 基礎概念",
      "Server Components",
      "路由系統"
    ],
    "search_intent": "informational",
    "average_word_count": 2000,
    "keyword_difficulty": 65
  }
}
```

#### 2. 內容計劃完成

```json
{
  "articleId": "123e4567-e89b-12d3-a456-426614174000",
  "stage": "content_plan",
  "status": "completed",
  "data": {
    "title_suggestions": [
      "Next.js 完整教學：從零開始建立現代化網站",
      "2024 最新 Next.js 教學指南",
      "Next.js 入門教學：初學者必看"
    ],
    "outline": {
      "introduction": "介紹 Next.js 的核心概念和優勢",
      "main_sections": [
        {
          "h2": "什麼是 Next.js？",
          "h3": [
            "Next.js 的歷史與發展",
            "與其他框架的比較",
            "核心特性介紹"
          ]
        },
        {
          "h2": "Next.js 安裝與設定",
          "h3": [
            "環境需求",
            "建立新專案",
            "專案結構說明"
          ]
        }
      ],
      "conclusion": "總結 Next.js 的優勢和學習建議"
    },
    "target_word_count": 2000,
    "keyword_density_target": "1.5-2.5%",
    "related_keywords": [
      "React Server Components",
      "SSR",
      "SSG",
      "App Router"
    ]
  }
}
```

#### 3. 文章生成完成

```json
{
  "articleId": "123e4567-e89b-12d3-a456-426614174000",
  "stage": "content_generation",
  "status": "completed",
  "data": {
    "content": "<h1>Next.js 完整教學</h1><p>Next.js 是...</p>",
    "markdown": "# Next.js 完整教學\n\nNext.js 是...",
    "word_count": 2150,
    "internal_links_added": 5,
    "external_links_added": 3
  }
}
```

#### 4. 品質檢查完成

```json
{
  "articleId": "123e4567-e89b-12d3-a456-426614174000",
  "stage": "quality_check",
  "status": "completed",
  "data": {
    "score": 85,
    "passed": true,
    "checks": {
      "word_count": {
        "pass": true,
        "value": 2150,
        "expected": "1500-2500"
      },
      "keyword_density": {
        "pass": true,
        "value": "2.1%",
        "expected": "1.5-2.5%"
      },
      "structure": {
        "pass": true,
        "h1": 1,
        "h2": 5,
        "h3": 12
      },
      "internal_links": {
        "pass": true,
        "count": 5,
        "expected": "≥3"
      }
    },
    "failed_checks": [],
    "warnings": [
      "建議增加 1 個外部權威連結"
    ]
  }
}
```

#### 5. WordPress 發布完成

```json
{
  "articleId": "123e4567-e89b-12d3-a456-426614174000",
  "stage": "wordpress_publish",
  "status": "completed",
  "data": {
    "wp_post_id": 42,
    "url": "https://your-blog.com/nextjs-tutorial",
    "status": "publish",
    "published_at": "2025-01-24T10:00:00Z"
  }
}
```

#### 6. 階段失敗

```json
{
  "articleId": "123e4567-e89b-12d3-a456-426614174000",
  "stage": "wordpress_publish",
  "status": "failed",
  "error": "WordPress REST API authentication failed: Invalid application password"
}
```

### 回應格式

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Article 123e4567-e89b-12d3-a456-426614174000 serp_analysis updated to completed"
}
```

#### Error Responses

**401 Unauthorized** - API Key 無效或缺失

```json
{
  "error": "Unauthorized"
}
```

**400 Bad Request** - 缺少必要欄位

```json
{
  "error": "Missing required fields"
}
```

**404 Not Found** - 文章不存在

```json
{
  "error": "Article not found"
}
```

**500 Internal Server Error** - 資料庫更新失敗

```json
{
  "error": "Database update failed"
}
```

### 資料庫更新邏輯

根據不同的 `stage`，Callback API 會更新不同的資料庫欄位：

```typescript
switch (stage) {
  case 'serp_analysis':
    // 更新 serp_analysis, workflow_data
    break

  case 'competitor_analysis':
    // 更新 competitor_analysis, workflow_data
    break

  case 'content_plan':
    // 更新 content_plan, workflow_data, article_title
    break

  case 'content_generation':
    // 更新 generated_content, workflow_data
    break

  case 'quality_check':
    // 更新 quality_score, quality_report, workflow_data
    break

  case 'wordpress_publish':
    if (status === 'completed') {
      // 更新 status = 'published', wp_post_id, published_at
    } else {
      // 更新 status = 'failed', error_message
    }
    break
}

// 所有階段都會更新 processing_stages
processing_stages[stage] = {
  status: 'completed' | 'failed',
  completed_at: '2025-01-24T10:00:00Z', // 或 failed_at
  error: 'error message' // 僅在失敗時
}
```

### 健康檢查端點

**URL**: `/api/n8n/callback`
**方法**: `GET`
**認證**: Not Required

**回應**:
```json
{
  "status": "ok",
  "endpoint": "N8N Callback API",
  "timestamp": "2025-01-24T10:00:00.000Z"
}
```

---

## 取得舊文章 API

### 端點資訊

- **URL**: `/api/articles/previous`
- **方法**: `GET`
- **認證**: Required (X-API-Key header)
- **Content-Type**: `application/json`

### 用途

提供已發布的文章列表給 N8N Workflow 中的「Add internal links」節點使用，用於在新文章中添加內部連結。

### Query Parameters

| 參數 | 類型 | 必填 | 說明 | 預設值 |
|------|------|------|------|--------|
| `websiteId` | string (UUID) | ✅ | 網站 ID | - |
| `limit` | integer | ❌ | 返回數量 | 20 |
| `keyword` | string | ❌ | 關鍵字過濾 | - |

### 請求範例

```http
GET /api/articles/previous?websiteId=123e4567-e89b-12d3-a456-426614174000&limit=20&keyword=Next.js HTTP/1.1
Host: your-platform.com
X-API-Key: your_n8n_api_key
```

### 回應格式

#### Success Response (200 OK)

```json
{
  "articles": [
    {
      "title": "Next.js 13 新特性完整解析",
      "postId": 42,
      "url": "/post-42",
      "publishedAt": "2025-01-20T10:00:00Z",
      "excerpt": "Next.js 13 引入了許多令人興奮的新特性，包括 App Router、Server Components...",
      "keyword": "Next.js 13"
    },
    {
      "title": "React Server Components 深度解析",
      "postId": 38,
      "url": "/post-38",
      "publishedAt": "2025-01-18T10:00:00Z",
      "excerpt": "Server Components 是 React 18 引入的全新概念，讓我們能夠在伺服器端...",
      "keyword": "React Server Components"
    }
  ],
  "total": 2
}
```

#### Error Responses

**401 Unauthorized** - API Key 無效

```json
{
  "error": "Unauthorized"
}
```

**400 Bad Request** - 缺少 websiteId

```json
{
  "error": "Missing websiteId"
}
```

**500 Internal Server Error** - 查詢失敗

```json
{
  "error": "Database query failed"
}
```

### 過濾邏輯

如果提供了 `keyword` 參數，API 會過濾出相關的文章：

```typescript
// 簡易相關性過濾
if (keyword) {
  articles = articles.filter(article =>
    article.title.toLowerCase().includes(keyword.toLowerCase()) ||
    article.excerpt.toLowerCase().includes(keyword.toLowerCase()) ||
    article.keyword.toLowerCase().includes(keyword.toLowerCase())
  )
}
```

**未來優化**: 可以使用向量相似度搜尋 (Supabase pgvector) 提供更精確的相關性排序。

---

## 錯誤處理

### 錯誤代碼總覽

| HTTP Status | 錯誤碼 | 說明 | 處理方式 |
|-------------|--------|------|----------|
| 400 | `BAD_REQUEST` | 請求參數錯誤 | 檢查請求格式 |
| 401 | `UNAUTHORIZED` | 認證失敗 | 檢查 API Key |
| 404 | `NOT_FOUND` | 資源不存在 | 檢查 articleId |
| 500 | `INTERNAL_ERROR` | 伺服器錯誤 | 查看伺服器日誌 |

### 錯誤回應格式

所有錯誤回應都遵循統一格式：

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-01-24T10:00:00.000Z",
  "path": "/api/n8n/callback",
  "details": {
    // 額外的錯誤詳情（可選）
  }
}
```

### N8N Workflow 錯誤處理建議

在 N8N Workflow 中，建議為每個 Callback 節點設定錯誤處理：

```json
{
  "name": "Error Handler - Callback",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "={{$node['Webhook Trigger'].json.callbackUrl}}",
    "sendBody": true,
    "jsonBody": "={\n  \"articleId\": \"{{$node['Webhook Trigger'].json.articleId}}\",\n  \"stage\": \"{{$runIndex}}\",\n  \"status\": \"failed\",\n  \"error\": \"{{$json.error.message}}\"\n}",
    "options": {}
  },
  "continueOnFail": true,
  "onError": "continueErrorOutput"
}
```

### 重試策略

**建議的重試策略**（在 N8N 中配置）:

- **最大重試次數**: 3 次
- **重試間隔**: 指數退避（1s, 2s, 4s）
- **可重試的錯誤**: 500, 502, 503, 504
- **不可重試的錯誤**: 400, 401, 404

---

## 範例程式碼

### N8N HTTP Request 節點配置

#### Callback 節點範例

```json
{
  "name": "Callback - Content Generation",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "={{$node['Webhook Trigger'].json.callbackUrl}}",
    "authentication": "genericCredentialType",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "X-API-Key",
          "value": "={{$env.N8N_API_KEY}}"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"articleId\": \"{{$node['Webhook Trigger'].json.articleId}}\",\n  \"stage\": \"content_generation\",\n  \"status\": \"completed\",\n  \"data\": {\n    \"content\": \"{{$node['Convert to HTML'].json.html}}\",\n    \"markdown\": \"{{$node['Convert to HTML'].json.markdown}}\",\n    \"word_count\": {{$node['Convert to HTML'].json.word_count}}\n  }\n}",
    "options": {
      "timeout": 10000,
      "retry": {
        "enabled": true,
        "maxTries": 3,
        "waitBetweenTries": 1000
      }
    }
  }
}
```

#### 取得舊文章節點範例

```json
{
  "name": "Get Previous Posts",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "GET",
    "url": "={{$node['Webhook Trigger'].json.callbackUrl.replace('/callback', '/articles/previous')}}",
    "sendQuery": true,
    "queryParameters": {
      "parameters": [
        {
          "name": "websiteId",
          "value": "={{$node['Webhook Trigger'].json.websiteId}}"
        },
        {
          "name": "limit",
          "value": "20"
        },
        {
          "name": "keyword",
          "value": "={{$node['Webhook Trigger'].json.inputContent.keyword}}"
        }
      ]
    },
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "X-API-Key",
          "value": "={{$env.N8N_API_KEY}}"
        }
      ]
    },
    "options": {}
  }
}
```

### cURL 測試範例

#### 測試 Callback API

```bash
# 測試 SERP 分析完成
curl -X POST http://localhost:3168/api/n8n/callback \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key_here" \
  -d '{
    "articleId": "123e4567-e89b-12d3-a456-426614174000",
    "stage": "serp_analysis",
    "status": "completed",
    "data": {
      "top_10_urls": ["https://example.com/1"],
      "common_topics": ["Topic 1", "Topic 2"],
      "search_intent": "informational"
    }
  }'

# 測試品質檢查失敗
curl -X POST http://localhost:3168/api/n8n/callback \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key_here" \
  -d '{
    "articleId": "123e4567-e89b-12d3-a456-426614174000",
    "stage": "quality_check",
    "status": "failed",
    "error": "Keyword density too low: 0.8% (expected 1.5-2.5%)"
  }'
```

#### 測試取得舊文章 API

```bash
# 取得最近 20 篇文章
curl -X GET "http://localhost:3168/api/articles/previous?websiteId=123e4567-e89b-12d3-a456-426614174000&limit=20" \
  -H "X-API-Key: your_api_key_here"

# 取得與關鍵字相關的文章
curl -X GET "http://localhost:3168/api/articles/previous?websiteId=123e4567-e89b-12d3-a456-426614174000&keyword=Next.js" \
  -H "X-API-Key: your_api_key_here"
```

### JavaScript/TypeScript 範例

#### 觸發 N8N Workflow

```typescript
async function triggerN8NWorkflow(articleData: ArticleData) {
  const response = await fetch(process.env.N8N_WEBHOOK_BASE_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.N8N_API_KEY!,
    },
    body: JSON.stringify({
      articleId: articleData.id,
      websiteId: articleData.websiteId,
      inputType: articleData.inputType,
      inputContent: articleData.inputContent,
      websiteConfig: articleData.websiteConfig,
      brandVoice: articleData.brandVoice,
      workflowSettings: articleData.workflowSettings,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/callback`,
    }),
  })

  if (!response.ok) {
    throw new Error(`Workflow trigger failed: ${await response.text()}`)
  }

  return await response.json()
}
```

#### 處理 Callback（在 route.ts 中）

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json()
  const apiKey = request.headers.get('X-API-Key')

  // 驗證 API Key
  if (apiKey !== process.env.N8N_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { articleId, stage, status, data, error } = body

  // 更新資料庫
  const supabase = await createClient()
  await supabase
    .from('article_jobs')
    .update({
      [`${stage}_data`]: data,
      processing_stages: {
        [stage]: {
          status,
          ...(status === 'completed'
            ? { completed_at: new Date().toISOString() }
            : { failed_at: new Date().toISOString(), error }
          ),
        },
      },
    })
    .eq('id', articleId)

  return NextResponse.json({ success: true })
}
```

---

## 附錄

### A. 完整的 processing_stages 範例

```json
{
  "created": {
    "status": "completed",
    "completed_at": "2025-01-24T10:00:00Z"
  },
  "workflow_triggered": {
    "status": "completed",
    "completed_at": "2025-01-24T10:00:05Z"
  },
  "serp_analysis": {
    "status": "completed",
    "completed_at": "2025-01-24T10:00:30Z"
  },
  "competitor_analysis": {
    "status": "completed",
    "completed_at": "2025-01-24T10:01:00Z"
  },
  "content_plan": {
    "status": "completed",
    "completed_at": "2025-01-24T10:01:20Z"
  },
  "content_generation": {
    "status": "completed",
    "completed_at": "2025-01-24T10:02:30Z"
  },
  "quality_check": {
    "status": "completed",
    "completed_at": "2025-01-24T10:02:40Z"
  },
  "wordpress_publish": {
    "status": "completed",
    "completed_at": "2025-01-24T10:02:50Z"
  }
}
```

### B. workflow_data 完整範例

```json
{
  "serp_analysis": {
    "top_10_urls": [...],
    "common_topics": [...],
    "search_intent": "informational"
  },
  "competitor_analysis": {
    "content_gaps": [...],
    "average_word_count": 2000
  },
  "content_plan": {
    "title_suggestions": [...],
    "outline": {...}
  },
  "content_generation": {
    "content": "<html>...</html>",
    "markdown": "# ...",
    "word_count": 2150
  },
  "quality_check": {
    "score": 85,
    "passed": true,
    "checks": {...}
  },
  "wordpress_publish": {
    "wp_post_id": 42,
    "url": "https://...",
    "status": "publish"
  }
}
```

---

**版本歷史**:
- v1.0 (2025-01-23): 初始版本

**維護者**: Auto Pilot SEO Team

**相關文檔**:
- [N8N 整合指南](../N8N-INTEGRATION-GUIDE.md)
- [實作檢查清單](../N8N-IMPLEMENTATION-CHECKLIST.md)
