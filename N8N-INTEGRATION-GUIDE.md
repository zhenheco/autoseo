# 🔗 N8N Workflow 整合指南

**Auto Pilot SEO** - N8N 文章生成工作流程整合完整指南

最後更新：2025-01-23

---

## 📋 目錄

1. [概述](#概述)
2. [Workflow 架構分析](#workflow-架構分析)
3. [平台整合方案](#平台整合方案)
4. [API 端點設計](#api-端點設計)
5. [環境變數配置](#環境變數配置)
6. [N8N Workflow 設定](#n8n-workflow-設定)
7. [測試流程](#測試流程)
8. [故障排除](#故障排除)

---

## 概述

### 整合目標

將您現有的 N8N 文章生成 Workflow（`玩幣優塔-1000posts.json`）與 Auto Pilot SEO 平台整合，實現：

- ✅ 自動化 SEO 文章生成管線
- ✅ 品牌聲音一致性控制
- ✅ 多步驟內容優化流程
- ✅ 品質驗證機制
- ✅ WordPress 自動發布
- ✅ 狀態同步與追蹤

### 整合方式

**Path A: Quick Validation** - 使用 N8N 作為文章生成引擎

```
平台 (Next.js) ─── Webhook ──→ N8N Workflow ─── Callback ──→ 平台更新狀態
     ↓                              ↓                            ↓
 建立任務                      執行生成流程                   顯示結果
 (article_jobs)               (20+ 節點)                (published/failed)
```

---

## Workflow 架構分析

### 完整流程圖

您的 Workflow 包含以下關鍵階段：

```
1. 觸發階段
   ├─ Schedule Trigger (定時執行: 2:00, 5:00, 8:00)
   └─ 或 Webhook Trigger (平台觸發)

2. 資料準備階段
   ├─ Grab New Cluster (從 Google Sheets 抓取關鍵字)
   ├─ Website Config1 (載入網站配置)
   └─ 品牌聲音配置 (載入 brand voice)

3. SEO 研究階段
   ├─ SERP 數據分析 (Perplexity API)
   ├─ 競爭對手分析 (分析 SERP 前 10 名)
   └─ 找外部資料來源 (enrichment sources)

4. 內容規劃階段
   └─ Preliminary Plan1 (內容策略 + SEO 優化建議)

5. 內容生成階段
   ├─ Write Blog1 (GPT-5-mini 主要撰寫)
   ├─ Add internal links1 (從舊文章中添加內部連結)
   └─ HTML version1 (格式化成 HTML)

6. SEO 優化階段
   ├─ Slug1 (生成 URL slug)
   ├─ Title1 (生成 SEO 標題)
   ├─ Meta description1 (生成描述)
   ├─ Image generation (生成特色圖片)
   ├─ Image meta prompt (圖片 SEO 元數據)
   ├─ AI 標籤選擇 (自動選擇 WordPress tags)
   └─ AI 分類選擇 (自動選擇 WordPress categories)

7. 品質控制階段
   ├─ 文章品質檢查 (關鍵字密度、結構、長度)
   └─ 條件判斷 (品質 ≥ 80% 才發布)

8. 發布階段
   ├─ Create a post (WordPress REST API)
   └─ 回填資料 (更新 Google Sheets 狀態)

9. 錯誤處理
   └─ 各節點失敗時的錯誤捕獲和記錄
```

### 核心節點詳細說明

#### 1. SERP 數據分析 (Perplexity API)
```json
{
  "node": "SERP 數據分析",
  "purpose": "分析搜尋引擎結果頁面，了解當前排名文章",
  "input": "關鍵字",
  "output": {
    "top_10_urls": ["url1", "url2", ...],
    "common_topics": ["topic1", "topic2", ...],
    "search_intent": "informational/commercial/transactional"
  },
  "api": "Perplexity API (PLATFORM_PERPLEXITY_API_KEY)"
}
```

#### 2. 競爭對手分析
```json
{
  "node": "競爭對手分析",
  "purpose": "深度分析競爭對手內容，找出差異化機會",
  "input": "SERP 前 10 名 URLs",
  "output": {
    "content_gaps": ["缺少的主題1", "缺少的主題2"],
    "average_word_count": 2000,
    "common_headings": ["H2: 什麼是...", "H2: 如何..."],
    "keyword_opportunities": ["相關關鍵字1", "相關關鍵字2"]
  },
  "api": "Web scraping + GPT-5-nano analysis"
}
```

#### 3. Preliminary Plan (內容策略)
```json
{
  "node": "Preliminary Plan1",
  "purpose": "根據 SERP 分析制定內容大綱",
  "input": {
    "keyword": "主要關鍵字",
    "serp_analysis": "SERP 數據分析結果",
    "competitor_analysis": "競爭對手分析結果",
    "brand_voice": "品牌聲音配置"
  },
  "output": {
    "title_suggestions": ["標題選項1", "標題選項2", "標題選項3"],
    "outline": {
      "introduction": "引言要點",
      "main_sections": [
        { "h2": "章節1", "h3": ["子章節1.1", "子章節1.2"] },
        { "h2": "章節2", "h3": ["子章節2.1", "子章節2.2"] }
      ],
      "conclusion": "結論要點"
    },
    "target_word_count": 2000,
    "keyword_density_target": "1.5-2.5%",
    "related_keywords": ["LSI 關鍵字1", "LSI 關鍵字2"]
  },
  "api": "GPT-5-mini with structured output"
}
```

#### 4. Write Blog (主要撰寫)
```json
{
  "node": "Write Blog1",
  "purpose": "根據內容計劃撰寫完整文章",
  "input": {
    "preliminary_plan": "內容大綱",
    "brand_voice": {
      "tone": "專業但易懂",
      "vocabulary": ["避免使用的詞彙"],
      "sentence_structure": "短句為主",
      "brand_variables": {
        "company_name": "玩幣優塔",
        "product_name": "產品名稱"
      }
    },
    "target_audience": "Web3 初學者"
  },
  "output": {
    "content": "完整文章內容（Markdown 格式）",
    "word_count": 2150,
    "keywords_used": {
      "primary": 15,
      "secondary": 8
    }
  },
  "api": "GPT-5-mini (3-5 paragraphs per section)",
  "prompting_strategy": "分段生成，每次生成 3-5 段落，保持一致性"
}
```

#### 5. Add Internal Links (內部連結)
```json
{
  "node": "Add internal links1",
  "purpose": "從舊文章中找出相關內容並添加內部連結",
  "input": {
    "current_article": "當前文章內容",
    "previous_posts": [
      { "title": "舊文章1", "url": "/post-1", "excerpt": "摘要" },
      { "title": "舊文章2", "url": "/post-2", "excerpt": "摘要" }
    ]
  },
  "output": {
    "article_with_links": "添加了內部連結的文章",
    "links_added": [
      { "anchor_text": "錨文字", "url": "/post-1", "position": "paragraph 3" }
    ]
  },
  "logic": "找出語義相關的段落，自然插入內部連結（3-5 個）"
}
```

#### 6. HTML Version (HTML 格式化)
```json
{
  "node": "HTML version1",
  "purpose": "將 Markdown 轉換為 WordPress 相容的 HTML",
  "input": "Markdown 格式文章",
  "output": "HTML 格式文章",
  "rules": [
    "H1 → <h1> (只有標題)",
    "H2 → <h2> (主要章節)",
    "H3 → <h3> (子章節)",
    "段落 → <p>",
    "列表 → <ul>/<ol>",
    "程式碼 → <pre><code>",
    "內部連結 → <a href=\"/post-x\">",
    "圖片 → <img src=\"\" alt=\"\" />",
    "FAQ section → Schema markup"
  ],
  "seo_enhancements": [
    "添加 table of contents",
    "添加 jump links",
    "優化圖片 alt text",
    "添加 Schema.org FAQ markup"
  ]
}
```

#### 7. 文章品質檢查
```json
{
  "node": "文章品質檢查",
  "purpose": "驗證文章是否符合發布標準",
  "checks": {
    "keyword_density": {
      "primary_keyword": "1.5-2.5%",
      "check": "計算主要關鍵字出現次數 / 總字數",
      "pass": "在範圍內"
    },
    "structure": {
      "h1_count": "= 1",
      "h2_count": "≥ 3",
      "h3_count": "≥ 5",
      "paragraphs": "≥ 10"
    },
    "length": {
      "word_count": "1500-2500",
      "pass": "符合範圍"
    },
    "readability": {
      "sentence_length_avg": "< 20 words",
      "paragraph_length_avg": "< 100 words"
    },
    "seo_elements": {
      "meta_description": "exists and 120-160 chars",
      "title": "exists and 50-60 chars",
      "images": "≥ 1 with alt text",
      "internal_links": "≥ 3",
      "external_links": "≥ 2"
    },
    "brand_compliance": {
      "brand_variables_protected": "所有品牌變數未被修改",
      "tone_consistency": "符合品牌語調"
    }
  },
  "scoring": {
    "total_score": "0-100",
    "pass_threshold": 80,
    "calculation": "加權平均所有檢查項目"
  },
  "output": {
    "passed": true,
    "score": 85,
    "failed_checks": [],
    "warnings": ["建議增加 1 個外部連結"]
  }
}
```

---

## 平台整合方案

### 資料庫調整

#### 1. 擴充 `article_jobs` 表

```sql
-- 新增欄位來儲存 workflow 各階段的資料
ALTER TABLE article_jobs
ADD COLUMN workflow_data JSONB DEFAULT '{}',
ADD COLUMN serp_analysis JSONB,
ADD COLUMN competitor_analysis JSONB,
ADD COLUMN content_plan JSONB,
ADD COLUMN quality_score INTEGER,
ADD COLUMN quality_report JSONB,
ADD COLUMN processing_stages JSONB DEFAULT '{}';

-- processing_stages 範例結構:
-- {
--   "serp_analysis": { "status": "completed", "completed_at": "2025-01-23T10:00:00Z" },
--   "competitor_analysis": { "status": "completed", "completed_at": "2025-01-23T10:05:00Z" },
--   "content_plan": { "status": "completed", "completed_at": "2025-01-23T10:10:00Z" },
--   "content_generation": { "status": "in_progress", "started_at": "2025-01-23T10:15:00Z" },
--   "quality_check": { "status": "pending" },
--   "wordpress_publish": { "status": "pending" }
-- }

COMMENT ON COLUMN article_jobs.workflow_data IS 'N8N workflow 執行的所有中間資料';
COMMENT ON COLUMN article_jobs.serp_analysis IS 'SERP 分析結果（快取用）';
COMMENT ON COLUMN article_jobs.competitor_analysis IS '競爭對手分析結果';
COMMENT ON COLUMN article_jobs.content_plan IS 'Preliminary Plan 內容大綱';
COMMENT ON COLUMN article_jobs.quality_score IS '文章品質分數 (0-100)';
COMMENT ON COLUMN article_jobs.quality_report IS '品質檢查詳細報告';
COMMENT ON COLUMN article_jobs.processing_stages IS '各處理階段的狀態追蹤';
```

#### 2. 擴充 `website_configs` 表

```sql
-- 新增欄位來儲存 N8N workflow 相關設定
ALTER TABLE website_configs
ADD COLUMN n8n_webhook_url TEXT,
ADD COLUMN workflow_settings JSONB DEFAULT '{}';

-- workflow_settings 範例結構:
-- {
--   "serp_analysis_enabled": true,
--   "competitor_count": 10,
--   "quality_threshold": 80,
--   "auto_publish": true,
--   "internal_links_count": "3-5",
--   "image_generation_enabled": true,
--   "ai_model_preferences": {
--     "content_generation": "gpt-5-mini",
--     "serp_analysis": "perplexity",
--     "quality_check": "gpt-5-nano"
--   }
-- }

COMMENT ON COLUMN website_configs.n8n_webhook_url IS 'N8N workflow webhook URL（每個網站可有不同 workflow）';
COMMENT ON COLUMN website_configs.workflow_settings IS 'Workflow 自訂設定';
```

### 平台觸發流程

#### 修改 `createArticle` Server Action

**檔案**: `src/app/(dashboard)/dashboard/articles/new/actions.ts`

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'

/**
 * 觸發 N8N Workflow 的函數
 */
async function triggerN8NWorkflow(article: any, website: any) {
  const n8nWebhookUrl = website.n8n_webhook_url || process.env.N8N_WEBHOOK_BASE_URL

  if (!n8nWebhookUrl) {
    throw new Error('N8N Webhook URL 未設定')
  }

  const payload = {
    // 文章資訊
    articleId: article.id,
    websiteId: article.website_id,
    companyId: article.company_id,

    // 輸入資料
    inputType: article.input_type,
    inputContent: article.input_content,

    // 網站配置
    websiteConfig: {
      siteUrl: website.site_url,
      siteName: website.site_name,
      wpUsername: website.wp_username,
      wpAppPassword: website.wp_app_password, // TODO: 解密
    },

    // 品牌聲音
    brandVoice: website.brand_voice || {},

    // Workflow 設定
    workflowSettings: website.workflow_settings || {
      serp_analysis_enabled: true,
      competitor_count: 10,
      quality_threshold: 80,
      auto_publish: true,
      internal_links_count: "3-5",
      image_generation_enabled: true,
    },

    // Callback URL
    callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/callback`,
  }

  const response = await fetch(n8nWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.N8N_API_KEY || '', // 驗證用
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`N8N Workflow 觸發失敗: ${error}`)
  }

  return await response.json()
}

/**
 * 建立文章生成任務（修改版）
 */
export async function createArticle(formData: FormData) {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }

  const companyId = formData.get('companyId') as string
  const websiteId = formData.get('websiteId') as string
  const inputType = formData.get('inputType') as string

  if (!companyId || !websiteId || !inputType) {
    redirect('/dashboard/articles/new?error=' + encodeURIComponent('缺少必要欄位'))
  }

  const supabase = await createClient()

  // 檢查使用者權限
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    redirect('/dashboard/articles?error=' + encodeURIComponent('您沒有權限生成文章'))
  }

  // 取得網站資訊（包含 N8N webhook URL 和 workflow settings）
  const { data: website } = await supabase
    .from('website_configs')
    .select('*')
    .eq('id', websiteId)
    .single()

  if (!website) {
    redirect('/dashboard/articles/new?error=' + encodeURIComponent('找不到指定的網站'))
  }

  // 根據輸入方式處理
  let articles: any[] = []

  if (inputType === 'keyword') {
    const keyword = formData.get('keyword') as string
    if (!keyword) {
      redirect('/dashboard/articles/new?error=' + encodeURIComponent('請輸入關鍵字'))
    }

    articles.push({
      company_id: companyId,
      website_id: websiteId,
      input_type: 'keyword',
      input_content: { keyword },
      article_title: `${keyword} - SEO 文章`,
      status: 'pending',
      scheduled_time: new Date().toISOString(),
      processing_stages: {
        created: { status: 'completed', completed_at: new Date().toISOString() }
      },
    })
  } else if (inputType === 'url') {
    const url = formData.get('url') as string
    if (!url) {
      redirect('/dashboard/articles/new?error=' + encodeURIComponent('請輸入 URL'))
    }

    // 驗證 URL 格式
    try {
      new URL(url)
    } catch {
      redirect('/dashboard/articles/new?error=' + encodeURIComponent('無效的 URL 格式'))
    }

    articles.push({
      company_id: companyId,
      website_id: websiteId,
      input_type: 'url',
      input_content: { url },
      article_title: `URL 參考文章`,
      status: 'pending',
      scheduled_time: new Date().toISOString(),
      processing_stages: {
        created: { status: 'completed', completed_at: new Date().toISOString() }
      },
    })
  } else if (inputType === 'batch') {
    const keywords = formData.get('keywords') as string
    if (!keywords) {
      redirect('/dashboard/articles/new?error=' + encodeURIComponent('請輸入關鍵字列表'))
    }

    const keywordList = keywords.split('\n').map(k => k.trim()).filter(k => k.length > 0)

    if (keywordList.length === 0) {
      redirect('/dashboard/articles/new?error=' + encodeURIComponent('請至少輸入一個關鍵字'))
    }

    if (keywordList.length > 10) {
      redirect('/dashboard/articles/new?error=' + encodeURIComponent('最多只能輸入 10 個關鍵字'))
    }

    articles = keywordList.map(keyword => ({
      company_id: companyId,
      website_id: websiteId,
      input_type: 'keyword',
      input_content: { keyword },
      article_title: `${keyword} - SEO 文章`,
      status: 'pending',
      scheduled_time: new Date().toISOString(),
      processing_stages: {
        created: { status: 'completed', completed_at: new Date().toISOString() }
      },
    }))
  }

  // 插入文章任務
  const { data: insertedArticles, error: insertError } = await supabase
    .from('article_jobs')
    .insert(articles)
    .select()

  if (insertError) {
    redirect('/dashboard/articles/new?error=' + encodeURIComponent(insertError.message))
  }

  // 🔥 觸發 N8N Workflow（逐一處理每篇文章）
  const errors: string[] = []

  for (const article of insertedArticles) {
    try {
      // 更新狀態為 processing
      await supabase
        .from('article_jobs')
        .update({
          status: 'processing',
          processing_stages: {
            ...article.processing_stages,
            workflow_triggered: {
              status: 'in_progress',
              started_at: new Date().toISOString()
            }
          }
        })
        .eq('id', article.id)

      // 觸發 N8N
      await triggerN8NWorkflow(article, website)

    } catch (error: any) {
      errors.push(`文章 "${article.article_title}" 觸發失敗: ${error.message}`)

      // 更新為失敗狀態
      await supabase
        .from('article_jobs')
        .update({
          status: 'failed',
          error_message: error.message,
          processing_stages: {
            ...article.processing_stages,
            workflow_triggered: {
              status: 'failed',
              failed_at: new Date().toISOString(),
              error: error.message
            }
          }
        })
        .eq('id', article.id)
    }
  }

  revalidatePath('/dashboard/articles')

  // 如果有錯誤，顯示部分成功訊息
  if (errors.length > 0) {
    const successCount = insertedArticles.length - errors.length
    redirect(
      `/dashboard/articles?warning=${encodeURIComponent(
        `${successCount} 篇文章已觸發，${errors.length} 篇失敗。錯誤: ${errors.join('; ')}`
      )}`
    )
  }

  redirect(
    `/dashboard/articles?success=${encodeURIComponent(
      articles.length === 1
        ? '文章生成 Workflow 已觸發'
        : `${articles.length} 篇文章生成 Workflow 已觸發`
    )}`
  )
}
```

---

## API 端點設計

### 1. N8N Callback 端點

**檔案**: `src/app/api/n8n/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * N8N Workflow 回調端點
 *
 * N8N 在完成各個階段時會呼叫此端點更新狀態
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 驗證 API Key
    const apiKey = request.headers.get('X-API-Key')
    if (apiKey !== process.env.N8N_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const {
      articleId,
      stage, // 'serp_analysis' | 'competitor_analysis' | 'content_plan' | 'content_generation' | 'quality_check' | 'wordpress_publish'
      status, // 'completed' | 'failed'
      data, // 階段資料
      error, // 錯誤訊息（如果失敗）
    } = body

    if (!articleId || !stage || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 取得當前文章資料
    const { data: article, error: fetchError } = await supabase
      .from('article_jobs')
      .select('*')
      .eq('id', articleId)
      .single()

    if (fetchError || !article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      )
    }

    // 更新處理階段
    const updatedStages = {
      ...(article.processing_stages || {}),
      [stage]: {
        status,
        ...(status === 'completed'
          ? { completed_at: new Date().toISOString() }
          : { failed_at: new Date().toISOString(), error }
        ),
      },
    }

    // 準備更新資料
    const updateData: any = {
      processing_stages: updatedStages,
    }

    // 根據不同階段儲存不同資料
    switch (stage) {
      case 'serp_analysis':
        if (status === 'completed' && data) {
          updateData.serp_analysis = data
          updateData.workflow_data = {
            ...(article.workflow_data || {}),
            serp_analysis: data,
          }
        }
        break

      case 'competitor_analysis':
        if (status === 'completed' && data) {
          updateData.competitor_analysis = data
          updateData.workflow_data = {
            ...(article.workflow_data || {}),
            competitor_analysis: data,
          }
        }
        break

      case 'content_plan':
        if (status === 'completed' && data) {
          updateData.content_plan = data
          updateData.workflow_data = {
            ...(article.workflow_data || {}),
            content_plan: data,
          }
          // 更新文章標題（使用 AI 建議的標題）
          if (data.title_suggestions && data.title_suggestions.length > 0) {
            updateData.article_title = data.title_suggestions[0]
          }
        }
        break

      case 'content_generation':
        if (status === 'completed' && data) {
          updateData.generated_content = data
          updateData.workflow_data = {
            ...(article.workflow_data || {}),
            content_generation: data,
          }
        }
        break

      case 'quality_check':
        if (status === 'completed' && data) {
          updateData.quality_score = data.score
          updateData.quality_report = data
          updateData.workflow_data = {
            ...(article.workflow_data || {}),
            quality_check: data,
          }
        }
        break

      case 'wordpress_publish':
        if (status === 'completed' && data) {
          updateData.status = 'published'
          updateData.wp_post_id = data.wp_post_id
          updateData.published_at = new Date().toISOString()
          updateData.workflow_data = {
            ...(article.workflow_data || {}),
            wordpress_publish: data,
          }
        } else if (status === 'failed') {
          updateData.status = 'failed'
          updateData.error_message = error || 'WordPress 發布失敗'
        }
        break
    }

    // 如果任何階段失敗，更新整體狀態
    if (status === 'failed') {
      updateData.status = 'failed'
      updateData.error_message = error || `${stage} 階段失敗`
    }

    // 更新資料庫
    const { error: updateError } = await supabase
      .from('article_jobs')
      .update(updateData)
      .eq('id', articleId)

    if (updateError) {
      console.error('Database update error:', updateError)
      return NextResponse.json(
        { error: 'Database update failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Article ${articleId} ${stage} updated to ${status}`,
    })

  } catch (error: any) {
    console.error('Callback error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * 健康檢查端點
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'N8N Callback API',
    timestamp: new Date().toISOString(),
  })
}
```

### 2. 取得舊文章端點（供 N8N 查詢內部連結用）

**檔案**: `src/app/api/articles/previous/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 取得舊文章列表（供 N8N "Add internal links" 節點使用）
 *
 * Query parameters:
 * - websiteId: 網站 ID
 * - limit: 返回數量（預設 20）
 * - keyword: 關鍵字（用於相關性過濾）
 */
export async function GET(request: NextRequest) {
  try {
    // 驗證 API Key
    const apiKey = request.headers.get('X-API-Key')
    if (apiKey !== process.env.N8N_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const websiteId = searchParams.get('websiteId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const keyword = searchParams.get('keyword')

    if (!websiteId) {
      return NextResponse.json(
        { error: 'Missing websiteId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 查詢已發布的文章
    let query = supabase
      .from('article_jobs')
      .select('id, article_title, wp_post_id, published_at, input_content, generated_content')
      .eq('website_id', websiteId)
      .eq('status', 'published')
      .not('wp_post_id', 'is', null)
      .order('published_at', { ascending: false })
      .limit(limit)

    const { data: articles, error } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // 格式化成 N8N 需要的格式
    const formattedArticles = articles.map(article => ({
      title: article.article_title,
      postId: article.wp_post_id,
      url: `/post-${article.wp_post_id}`, // 可以後續改成完整 URL
      publishedAt: article.published_at,
      excerpt: article.generated_content?.content?.substring(0, 200) || '',
      keyword: article.input_content?.keyword || '',
    }))

    // 如果有關鍵字，可以在這裡做相關性排序（簡易版本）
    let resultArticles = formattedArticles
    if (keyword) {
      resultArticles = formattedArticles.filter(article =>
        article.title.toLowerCase().includes(keyword.toLowerCase()) ||
        article.excerpt.toLowerCase().includes(keyword.toLowerCase()) ||
        article.keyword.toLowerCase().includes(keyword.toLowerCase())
      )
    }

    return NextResponse.json({
      articles: resultArticles,
      total: resultArticles.length,
    })

  } catch (error: any) {
    console.error('Previous articles API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
```

---

## 環境變數配置

### `.env.local` 完整配置

```bash
# ========================================
# Supabase 配置
# ========================================
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_DB_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# ========================================
# N8N 配置
# ========================================
# N8N Webhook 基礎 URL（如果每個網站有不同 workflow，可在資料庫設定）
N8N_WEBHOOK_BASE_URL=https://your-n8n-instance.com/webhook/article-generation

# N8N API Key（用於驗證 webhook 請求）
N8N_API_KEY=your_n8n_api_key_generate_a_random_string

# ========================================
# AI 服務 API Keys（平台層級）
# ========================================
# OpenAI GPT-5 (用於 Write Blog, Preliminary Plan)
PLATFORM_OPENAI_API_KEY=sk-your-openai-api-key

# DeepSeek (替代選項)
PLATFORM_DEEPSEEK_API_KEY=your-deepseek-api-key

# Perplexity (用於 SERP 分析)
PLATFORM_PERPLEXITY_API_KEY=your-perplexity-api-key

# SerpAPI (用於 SERP 數據抓取)
PLATFORM_SERPAPI_API_KEY=your-serpapi-key

# ========================================
# Google Cloud (圖片生成)
# ========================================
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# ========================================
# App 設定
# ========================================
NEXT_PUBLIC_APP_URL=http://localhost:3168

# CNAME 目標（White Label 功能用）
NEXT_PUBLIC_CNAME_TARGET=app.yourplatform.com
```

---

## N8N Workflow 設定

### Webhook Trigger 節點設定

**取代原本的 "Schedule Trigger" 節點**

```json
{
  "name": "Webhook Trigger",
  "type": "n8n-nodes-base.webhook",
  "parameters": {
    "httpMethod": "POST",
    "path": "article-generation",
    "responseMode": "lastNode",
    "authentication": "headerAuth",
    "options": {}
  },
  "credentials": {
    "headerAuth": {
      "name": "N8N API Key",
      "data": {
        "name": "X-API-Key",
        "value": "={{ $env.N8N_API_KEY }}"
      }
    }
  }
}
```

**接收的資料格式**（來自平台 `createArticle` action）:

```json
{
  "articleId": "uuid-here",
  "websiteId": "uuid-here",
  "companyId": "uuid-here",
  "inputType": "keyword",
  "inputContent": {
    "keyword": "Next.js 教學"
  },
  "websiteConfig": {
    "siteUrl": "https://example.com",
    "siteName": "我的部落格",
    "wpUsername": "admin",
    "wpAppPassword": "xxxx xxxx xxxx xxxx"
  },
  "brandVoice": {
    "tone_of_voice": "專業但易懂",
    "target_audience": "Web 開發新手",
    "keywords": ["Next.js", "React", "SSR"]
  },
  "workflowSettings": {
    "serp_analysis_enabled": true,
    "competitor_count": 10,
    "quality_threshold": 80,
    "auto_publish": true
  },
  "callbackUrl": "https://your-platform.com/api/n8n/callback"
}
```

### Callback 節點設定

**在每個關鍵階段結束後添加 HTTP Request 節點回調平台**

#### 範例：SERP 分析完成後的 Callback

```json
{
  "name": "Callback - SERP Analysis",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "={{ $node['Webhook Trigger'].json.callbackUrl }}",
    "authentication": "genericCredentialType",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "X-API-Key",
          "value": "={{ $env.N8N_API_KEY }}"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        {
          "name": "articleId",
          "value": "={{ $node['Webhook Trigger'].json.articleId }}"
        },
        {
          "name": "stage",
          "value": "serp_analysis"
        },
        {
          "name": "status",
          "value": "completed"
        },
        {
          "name": "data",
          "value": "={{ $json }}"
        }
      ]
    },
    "options": {}
  }
}
```

**所有需要添加 Callback 的階段**:

1. `serp_analysis` - SERP 分析完成
2. `competitor_analysis` - 競爭對手分析完成
3. `content_plan` - 內容計劃完成
4. `content_generation` - 文章生成完成
5. `quality_check` - 品質檢查完成
6. `wordpress_publish` - WordPress 發布完成

### 錯誤處理節點

**在主要流程中添加錯誤捕獲**

```json
{
  "name": "Error Handler",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "={{ $node['Webhook Trigger'].json.callbackUrl }}",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "X-API-Key",
          "value": "={{ $env.N8N_API_KEY }}"
        }
      ]
    },
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        {
          "name": "articleId",
          "value": "={{ $node['Webhook Trigger'].json.articleId }}"
        },
        {
          "name": "stage",
          "value": "={{ $runIndex }}"
        },
        {
          "name": "status",
          "value": "failed"
        },
        {
          "name": "error",
          "value": "={{ $json.error.message }}"
        }
      ]
    }
  },
  "continueOnFail": true
}
```

### 內部連結節點修改

**原本從 Google Sheets 取得舊文章，改為呼叫平台 API**

```json
{
  "name": "Get Previous Posts",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "GET",
    "url": "={{ $node['Webhook Trigger'].json.callbackUrl.replace('/callback', '') }}/articles/previous",
    "sendQuery": true,
    "queryParameters": {
      "parameters": [
        {
          "name": "websiteId",
          "value": "={{ $node['Webhook Trigger'].json.websiteId }}"
        },
        {
          "name": "limit",
          "value": "20"
        },
        {
          "name": "keyword",
          "value": "={{ $node['Webhook Trigger'].json.inputContent.keyword }}"
        }
      ]
    },
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "X-API-Key",
          "value": "={{ $env.N8N_API_KEY }}"
        }
      ]
    }
  }
}
```

### WordPress 發布節點

**保持原有的 WordPress REST API 邏輯，但從平台提供的設定取得資料**

```json
{
  "name": "Create a post",
  "type": "n8n-nodes-base.wordpress",
  "parameters": {
    "resource": "post",
    "operation": "create",
    "title": "={{ $node['Title1'].json.title }}",
    "content": "={{ $node['HTML version1'].json.html }}",
    "status": "={{ $node['文章品質檢查'].json.passed && $node['Webhook Trigger'].json.workflowSettings.auto_publish ? 'publish' : 'draft' }}",
    "slug": "={{ $node['Slug1'].json.slug }}",
    "excerpt": "={{ $node['Meta description1'].json.meta_description }}",
    "categories": "={{ $node['AI 分類選擇'].json.categories }}",
    "tags": "={{ $node['AI 標籤選擇'].json.tags }}",
    "featuredMediaId": "={{ $node['Upload Image'].json.id }}"
  },
  "credentials": {
    "wordpressApi": {
      "name": "WordPress",
      "data": {
        "url": "={{ $node['Webhook Trigger'].json.websiteConfig.siteUrl }}",
        "username": "={{ $node['Webhook Trigger'].json.websiteConfig.wpUsername }}",
        "password": "={{ $node['Webhook Trigger'].json.websiteConfig.wpAppPassword }}"
      }
    }
  }
}
```

---

## 測試流程

### 1. 本地開發測試

#### Step 1: 啟動平台開發伺服器

```bash
cd /Users/avyshiu/Claudecode/Auto-pilot-SEO
npm run dev
```

#### Step 2: 使用 Cloudflare Tunnel 暴露本地伺服器

```bash
# 安裝 cloudflared（如果尚未安裝）
brew install cloudflare/cloudflare/cloudflared

# 啟動 tunnel
cloudflared tunnel --url http://localhost:3168
```

**輸出範例**:
```
2025-01-23T10:00:00Z INF Your free tunnel has started! Visit it at:
2025-01-23T10:00:00Z INF https://random-words-123.trycloudflare.com
```

#### Step 3: 更新環境變數

```bash
# 暫時更新 .env.local（測試用）
NEXT_PUBLIC_APP_URL=https://random-words-123.trycloudflare.com
```

#### Step 4: 在 N8N 中導入並配置 Workflow

1. 在 N8N 介面中導入修改後的 workflow JSON
2. 設定環境變數 `N8N_API_KEY`
3. 測試 Webhook 端點是否可訪問
4. 啟用 Workflow

#### Step 5: 在平台中測試文章生成

1. 登入平台 Dashboard
2. 前往「生成新文章」頁面
3. 輸入關鍵字（例如："Next.js 教學"）
4. 選擇已設定的網站
5. 提交表單

#### Step 6: 監控流程

**在平台中**:
- 前往「文章管理」頁面
- 查看文章狀態變化（pending → processing → published）
- 點擊「查看」查看詳細資訊和 `processing_stages`

**在 N8N 中**:
- 查看 Workflow 執行日誌
- 檢查每個節點的輸出
- 確認 Callback 是否成功

**在 WordPress 中**:
- 檢查文章是否成功發布
- 驗證標題、內容、SEO 元數據
- 確認圖片、分類、標籤是否正確

### 2. 生產環境測試

#### Step 1: 部署平台到 Vercel/其他雲端服務

```bash
# 設定生產環境變數
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
N8N_WEBHOOK_BASE_URL=https://your-n8n-instance.com/webhook/article-generation
N8N_API_KEY=your-production-api-key

# 部署
vercel --prod
```

#### Step 2: 配置 N8N 生產環境

1. 確保 N8N 實例可從外部訪問
2. 設定 SSL 證書（使用 Let's Encrypt 或 Cloudflare）
3. 更新 Webhook Trigger URL
4. 測試 Callback 端點連通性

#### Step 3: 執行端到端測試

參考本地測試流程，但使用生產環境 URL

### 3. 測試檢查清單

- [ ] Webhook 觸發成功
- [ ] SERP 分析回調成功
- [ ] 競爭對手分析回調成功
- [ ] 內容計劃回調成功
- [ ] 文章生成回調成功
- [ ] 品質檢查回調成功
- [ ] WordPress 發布成功
- [ ] 文章狀態正確更新
- [ ] 錯誤情況正確處理（例如品質不達標）
- [ ] 批量生成功能正常
- [ ] 內部連結正確添加
- [ ] 圖片成功上傳
- [ ] SEO 元數據正確生成

---

## 故障排除

### 常見問題

#### 1. Webhook 觸發失敗

**症狀**: 文章建立後狀態一直是 "pending"

**可能原因**:
- N8N Webhook URL 錯誤
- N8N API Key 不正確
- N8N Workflow 未啟用
- 網路連線問題

**解決方法**:
```bash
# 測試 N8N Webhook 是否可訪問
curl -X POST https://your-n8n-instance.com/webhook/article-generation \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"test": true}'

# 檢查 N8N 日誌
# 在 N8N 介面中查看 Workflow 執行記錄
```

#### 2. Callback 失敗

**症狀**: N8N Workflow 執行成功，但平台狀態未更新

**可能原因**:
- Callback URL 錯誤（特別是本地測試時）
- API Key 驗證失敗
- 資料格式不正確

**解決方法**:
```typescript
// 在 src/app/api/n8n/callback/route.ts 中添加詳細日誌
console.log('Received callback:', {
  articleId: body.articleId,
  stage: body.stage,
  status: body.status,
  dataKeys: Object.keys(body.data || {}),
})
```

#### 3. WordPress 發布失敗

**症狀**: 文章生成成功，但 WordPress 發布失敗

**可能原因**:
- WordPress 應用密碼錯誤
- WordPress REST API 未啟用
- 權限不足
- WordPress 版本過舊

**解決方法**:
```bash
# 測試 WordPress REST API
curl -X POST https://your-wordpress-site.com/wp-json/wp/v2/posts \
  -u "username:xxxx xxxx xxxx xxxx" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","content":"Test content","status":"draft"}'
```

#### 4. SERP 分析失敗

**症狀**: SERP 分析階段報錯

**可能原因**:
- Perplexity API Key 無效或額度用盡
- SerpAPI Key 無效
- 關鍵字格式問題

**解決方法**:
```bash
# 測試 Perplexity API
curl https://api.perplexity.ai/chat/completions \
  -H "Authorization: Bearer $PLATFORM_PERPLEXITY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonar",
    "messages": [{"role": "user", "content": "Next.js 是什麼？"}]
  }'
```

#### 5. 品質檢查一直不通過

**症狀**: 文章生成成功但品質分數 < 80

**可能原因**:
- 關鍵字密度過低或過高
- 文章結構不符合要求
- 長度不足

**解決方法**:
```typescript
// 在 quality_report 中查看詳細原因
const { data: article } = await supabase
  .from('article_jobs')
  .select('quality_report')
  .eq('id', articleId)
  .single()

console.log('Quality report:', article.quality_report)
// 輸出範例:
// {
//   "score": 75,
//   "passed": false,
//   "failed_checks": [
//     "keyword_density: 0.8% (expected 1.5-2.5%)",
//     "word_count: 1200 (expected 1500-2500)"
//   ]
// }
```

**調整建議**:
- 降低品質門檻（從 80 改為 70）
- 修改 Write Blog prompt，強調關鍵字使用
- 增加文章長度目標

---

## 下一步行動

### 明天（2025-01-24）測試前準備

- [ ] 執行資料庫 migration（新增欄位）
- [ ] 建立 API 端點檔案
- [ ] 修改 `createArticle` action
- [ ] 更新環境變數 `.env.local`
- [ ] 導入並配置 N8N Workflow
- [ ] 啟動 Cloudflare Tunnel（本地測試）
- [ ] 執行端到端測試
- [ ] 記錄測試結果和問題

### 後續優化（測試成功後）

1. **密碼加密**: 實作 pgsodium 加密 WordPress 應用密碼
2. **圖片 CDN**: 整合 Cloudflare Images 或其他 CDN
3. **監控儀表板**: 顯示 Workflow 執行狀態和成功率
4. **重試機制**: 失敗文章自動重試
5. **A/B 測試**: 多個標題/內容版本比較
6. **排程發布**: 設定發布時間（非立即發布）

---

## 附錄

### A. 資料庫 Migration SQL

**檔案**: `supabase/migrations/20250123000000_n8n_integration.sql`

```sql
-- N8N Workflow 整合所需的資料庫調整

-- 1. 擴充 article_jobs 表
ALTER TABLE article_jobs
ADD COLUMN IF NOT EXISTS workflow_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS serp_analysis JSONB,
ADD COLUMN IF NOT EXISTS competitor_analysis JSONB,
ADD COLUMN IF NOT EXISTS content_plan JSONB,
ADD COLUMN IF NOT EXISTS quality_score INTEGER,
ADD COLUMN IF NOT EXISTS quality_report JSONB,
ADD COLUMN IF NOT EXISTS processing_stages JSONB DEFAULT '{}';

COMMENT ON COLUMN article_jobs.workflow_data IS 'N8N workflow 執行的所有中間資料';
COMMENT ON COLUMN article_jobs.serp_analysis IS 'SERP 分析結果（快取用）';
COMMENT ON COLUMN article_jobs.competitor_analysis IS '競爭對手分析結果';
COMMENT ON COLUMN article_jobs.content_plan IS 'Preliminary Plan 內容大綱';
COMMENT ON COLUMN article_jobs.quality_score IS '文章品質分數 (0-100)';
COMMENT ON COLUMN article_jobs.quality_report IS '品質檢查詳細報告';
COMMENT ON COLUMN article_jobs.processing_stages IS '各處理階段的狀態追蹤';

-- 2. 擴充 website_configs 表
ALTER TABLE website_configs
ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS workflow_settings JSONB DEFAULT '{}';

COMMENT ON COLUMN website_configs.n8n_webhook_url IS 'N8N workflow webhook URL（每個網站可有不同 workflow）';
COMMENT ON COLUMN website_configs.workflow_settings IS 'Workflow 自訂設定';

-- 3. 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_article_jobs_quality_score ON article_jobs(quality_score);
CREATE INDEX IF NOT EXISTS idx_article_jobs_processing_stages ON article_jobs USING GIN(processing_stages);
```

### B. 環境變數範本

**檔案**: `.env.n8n.example`

```bash
# N8N 整合專用環境變數範本
# 複製到 .env.local 並填入實際值

# N8N Webhook URL
N8N_WEBHOOK_BASE_URL=https://your-n8n-instance.com/webhook/article-generation

# N8N API Key（用於驗證，建議使用強隨機字串）
# 生成方式: openssl rand -hex 32
N8N_API_KEY=

# AI API Keys
PLATFORM_OPENAI_API_KEY=
PLATFORM_DEEPSEEK_API_KEY=
PLATFORM_PERPLEXITY_API_KEY=
PLATFORM_SERPAPI_API_KEY=

# Google Cloud (圖片生成)
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

### C. N8N Workflow 檢查清單

**匯入 Workflow 前的檢查**:

- [ ] Webhook Trigger 已正確設定
- [ ] API Key 驗證已啟用
- [ ] 所有 AI API credentials 已設定
- [ ] WordPress credentials 已設定
- [ ] Callback 節點已添加到所有關鍵階段
- [ ] 錯誤處理節點已配置
- [ ] 環境變數已設定（`N8N_API_KEY` 等）
- [ ] Workflow 已啟用

---

**文檔版本**: 1.0
**建立日期**: 2025-01-23
**維護者**: Auto Pilot SEO Team

如有任何問題或需要協助，請參考 [故障排除](#故障排除) 章節或聯繫開發團隊。
