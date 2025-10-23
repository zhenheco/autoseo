# ✅ N8N 整合實作檢查清單

**Auto Pilot SEO** - 完整實作步驟（2025-01-24 測試用）

---

## 📅 實作時程

**預估時間**: 2-3 小時
**建議時段**: 上午進行，確保有足夠時間測試和調整

---

## 🚀 Phase 1: 資料庫準備 (15 分鐘)

### Step 1.1: 執行資料庫 Migration

```bash
# 1. 進入專案目錄
cd /Users/avyshiu/Claudecode/Auto-pilot-SEO

# 2. 建立 migration 檔案
cat > supabase/migrations/20250123000000_n8n_integration.sql << 'EOF'
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
EOF

# 3. 執行 migration
npm run db:migrate
```

**驗證**:
```bash
# 檢查欄位是否已新增
psql $SUPABASE_DB_URL -c "\d article_jobs" | grep -E "workflow_data|serp_analysis|quality_score"
psql $SUPABASE_DB_URL -c "\d website_configs" | grep -E "n8n_webhook_url|workflow_settings"
```

**預期輸出**:
```
 workflow_data          | jsonb                    |
 serp_analysis          | jsonb                    |
 quality_score          | integer                  |
 processing_stages      | jsonb                    |
 n8n_webhook_url        | text                     |
 workflow_settings      | jsonb                    |
```

✅ **完成標記**: [ ]

---

## 🔧 Phase 2: 環境變數配置 (10 分鐘)

### Step 2.1: 更新 `.env.local`

```bash
# 1. 備份現有環境變數
cp .env.local .env.local.backup

# 2. 添加 N8N 相關配置
cat >> .env.local << 'EOF'

# ========================================
# N8N Workflow 整合
# ========================================
# N8N Webhook 基礎 URL
N8N_WEBHOOK_BASE_URL=https://your-n8n-instance.com/webhook/article-generation

# N8N API Key（用於驗證）
# 生成方式: openssl rand -hex 32
N8N_API_KEY=

# ========================================
# AI 服務 API Keys
# ========================================
# Perplexity (SERP 分析)
PLATFORM_PERPLEXITY_API_KEY=

# SerpAPI (SERP 數據)
PLATFORM_SERPAPI_API_KEY=
EOF

# 3. 編輯 .env.local，填入實際值
nano .env.local
```

### Step 2.2: 生成 N8N API Key

```bash
# 生成隨機 API Key
openssl rand -hex 32

# 複製輸出結果，填入 .env.local 的 N8N_API_KEY
```

**必填環境變數檢查**:
- [ ] `N8N_WEBHOOK_BASE_URL` (稍後從 N8N 取得)
- [ ] `N8N_API_KEY` (剛才生成的)
- [ ] `PLATFORM_OPENAI_API_KEY` (已有)
- [ ] `PLATFORM_PERPLEXITY_API_KEY` (需申請)

✅ **完成標記**: [ ]

---

## 💻 Phase 3: 建立 API 端點 (30 分鐘)

### Step 3.1: 建立 N8N Callback 端點

```bash
# 建立目錄
mkdir -p src/app/api/n8n/callback

# 建立檔案
touch src/app/api/n8n/callback/route.ts
```

**複製以下程式碼到 `src/app/api/n8n/callback/route.ts`**:

（請參考 `N8N-INTEGRATION-GUIDE.md` 中的完整程式碼）

關鍵點：
- POST 端點接收 N8N callback
- 驗證 `X-API-Key` header
- 根據 `stage` 更新不同欄位
- 處理 6 個階段：serp_analysis, competitor_analysis, content_plan, content_generation, quality_check, wordpress_publish

### Step 3.2: 建立取得舊文章端點

```bash
# 建立目錄
mkdir -p src/app/api/articles/previous

# 建立檔案
touch src/app/api/articles/previous/route.ts
```

**複製以下程式碼到 `src/app/api/articles/previous/route.ts`**:

（請參考 `N8N-INTEGRATION-GUIDE.md` 中的完整程式碼）

關鍵點：
- GET 端點接收 query parameters: websiteId, limit, keyword
- 查詢已發布的文章
- 返回格式化的文章列表供 N8N 使用

### Step 3.3: 測試 API 端點

```bash
# 1. 啟動開發伺服器（另開終端機）
npm run dev

# 2. 測試健康檢查
curl http://localhost:3168/api/n8n/callback

# 預期回應:
# {"status":"ok","endpoint":"N8N Callback API","timestamp":"..."}

# 3. 測試 callback（需要先有 article）
# 稍後在有文章後測試
```

✅ **完成標記**: [ ]

---

## ✏️ Phase 4: 修改 Server Actions (20 分鐘)

### Step 4.1: 備份現有檔案

```bash
cp src/app/\(dashboard\)/dashboard/articles/new/actions.ts \
   src/app/\(dashboard\)/dashboard/articles/new/actions.ts.backup
```

### Step 4.2: 更新 `createArticle` action

**修改 `src/app/(dashboard)/dashboard/articles/new/actions.ts`**:

在檔案開頭添加輔助函數：

```typescript
/**
 * 觸發 N8N Workflow 的函數
 */
async function triggerN8NWorkflow(article: any, website: any) {
  const n8nWebhookUrl = website.n8n_webhook_url || process.env.N8N_WEBHOOK_BASE_URL

  if (!n8nWebhookUrl) {
    throw new Error('N8N Webhook URL 未設定')
  }

  const payload = {
    articleId: article.id,
    websiteId: article.website_id,
    companyId: article.company_id,
    inputType: article.input_type,
    inputContent: article.input_content,
    websiteConfig: {
      siteUrl: website.site_url,
      siteName: website.site_name,
      wpUsername: website.wp_username,
      wpAppPassword: website.wp_app_password,
    },
    brandVoice: website.brand_voice || {},
    workflowSettings: website.workflow_settings || {
      serp_analysis_enabled: true,
      competitor_count: 10,
      quality_threshold: 80,
      auto_publish: true,
      internal_links_count: "3-5",
      image_generation_enabled: false, // 暫時關閉圖片生成
    },
    callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/callback`,
  }

  const response = await fetch(n8nWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.N8N_API_KEY || '',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`N8N Workflow 觸發失敗: ${error}`)
  }

  return await response.json()
}
```

然後修改 `createArticle` 函數中的 TODO 區塊（127-141 行）：

```typescript
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
          created: { status: 'completed', completed_at: new Date().toISOString() },
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
          created: { status: 'completed', completed_at: new Date().toISOString() },
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
```

### Step 4.3: 類型檢查

```bash
npm run type-check
```

**如果有錯誤**: 修正類型問題

✅ **完成標記**: [ ]

---

## 🔗 Phase 5: N8N Workflow 設定 (30 分鐘)

### Step 5.1: 啟動 N8N（如果尚未安裝）

**選項 A: Docker 安裝（推薦）**

```bash
docker run -d --restart always \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  -e N8N_API_KEY=your_api_key_here \
  n8nio/n8n
```

**選項 B: npm 安裝**

```bash
npm install -g n8n
n8n start
```

訪問 N8N: http://localhost:5678

### Step 5.2: 設定 N8N 環境變數

在 N8N 設定中（Settings → Environment Variables）添加：

- `N8N_API_KEY`: (使用之前生成的 API Key)
- `PLATFORM_OPENAI_API_KEY`: (您的 OpenAI API Key)
- `PLATFORM_PERPLEXITY_API_KEY`: (您的 Perplexity API Key)

### Step 5.3: 建立 Credentials

**1. Header Auth (N8N API Key)**
- 名稱: "N8N API Key Auth"
- Header Name: `X-API-Key`
- Header Value: (您的 N8N_API_KEY)

**2. OpenAI API**
- 名稱: "OpenAI API"
- API Key: (您的 PLATFORM_OPENAI_API_KEY)

**3. Perplexity API (HTTP Request)**
- 類型: Generic Credential Type
- 名稱: "Perplexity API"
- 設定為 Authorization Header: `Bearer YOUR_API_KEY`

**4. WordPress API**
- 名稱: "WordPress API"
- URL: (測試用 WordPress 網站 URL)
- Username: (WordPress 使用者名稱)
- Password: (WordPress 應用密碼)

### Step 5.4: 導入 Workflow

1. 在 N8N 介面點擊「Import from file」
2. 選擇 `/Users/avyshiu/Claudecode/Auto-pilot-SEO/docs/n8n-workflow-example.json`
3. 檢查所有節點的 credentials 設定
4. 測試 Webhook 端點

### Step 5.5: 取得 Webhook URL

1. 點擊「Webhook Trigger」節點
2. 複製「Production URL」
3. 範例: `https://your-n8n-instance.com/webhook/article-generation`

### Step 5.6: 更新環境變數

```bash
# 編輯 .env.local
nano .env.local

# 更新 N8N_WEBHOOK_BASE_URL 為實際的 Webhook URL
N8N_WEBHOOK_BASE_URL=https://your-n8n-instance.com/webhook/article-generation
```

### Step 5.7: 啟用 Workflow

在 N8N 介面中，將 Workflow 狀態切換為「Active」

✅ **完成標記**: [ ]

---

## 🌐 Phase 6: 本地測試設定 (15 分鐘)

### Step 6.1: 安裝 Cloudflare Tunnel

```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# 驗證安裝
cloudflared --version
```

### Step 6.2: 啟動 Tunnel

```bash
# 在新的終端機視窗中執行
cloudflared tunnel --url http://localhost:3168
```

**輸出範例**:
```
2025-01-24T10:00:00Z INF Your free tunnel has started! Visit it at:
2025-01-24T10:00:00Z INF https://random-words-abc123.trycloudflare.com
```

**複製這個 URL！**

### Step 6.3: 更新環境變數（暫時）

```bash
# 編輯 .env.local
nano .env.local

# 暫時更新為 tunnel URL
NEXT_PUBLIC_APP_URL=https://random-words-abc123.trycloudflare.com
```

### Step 6.4: 重啟開發伺服器

```bash
# Ctrl+C 停止舊的，然後重新啟動
npm run dev
```

✅ **完成標記**: [ ]

---

## 🧪 Phase 7: 端到端測試 (30 分鐘)

### Test Case 1: 單一關鍵字文章生成

#### 7.1 準備測試資料

1. 登入平台: http://localhost:3168
2. 確保已有測試用 WordPress 網站
3. 如果沒有，先到「網站管理」新增一個

#### 7.2 觸發文章生成

1. 前往「生成新文章」
2. 選擇「📝 關鍵字輸入」
3. 輸入關鍵字: **"Next.js 教學"**
4. 選擇測試網站
5. 點擊「開始生成」

#### 7.3 監控平台狀態

```bash
# 在另一個終端機查看文章狀態（每 5 秒刷新）
watch -n 5 "psql $SUPABASE_DB_URL -c \"SELECT id, article_title, status, processing_stages FROM article_jobs ORDER BY created_at DESC LIMIT 1;\""
```

**預期狀態變化**:
```
pending → processing (workflow_triggered) → processing (各階段) → published 或 failed
```

#### 7.4 檢查 N8N Workflow 執行

1. 在 N8N 介面查看「Executions」
2. 點擊最新的執行記錄
3. 檢查每個節點是否成功

#### 7.5 檢查 Callback 是否成功

```bash
# 查看開發伺服器日誌
# 應該看到類似的輸出:
# POST /api/n8n/callback 200 in 123ms
# Callback received: { articleId: '...', stage: 'serp_analysis', status: 'completed' }
```

#### 7.6 驗證最終結果

1. 前往「文章管理」頁面
2. 找到剛才生成的文章
3. 點擊「查看」檢查詳細資訊

**檢查項目**:
- [ ] 文章狀態為 `published`
- [ ] 有 WordPress Post ID
- [ ] 有生成內容（HTML）
- [ ] 有品質分數（≥ 80）
- [ ] `processing_stages` 顯示所有階段完成

#### 7.7 檢查 WordPress

1. 登入測試用 WordPress 後台
2. 前往「文章」列表
3. 找到剛才發布的文章

**檢查項目**:
- [ ] 文章已發布（或為草稿，視設定而定）
- [ ] 標題正確
- [ ] 內容完整
- [ ] 有 SEO slug
- [ ] 有 meta description

✅ **Test Case 1 完成**: [ ]

### Test Case 2: 批量關鍵字生成

#### 7.8 觸發批量生成

1. 前往「生成新文章」
2. 選擇「📋 批量關鍵字」
3. 輸入關鍵字列表（每行一個）:
   ```
   React 入門
   TypeScript 基礎
   Tailwind CSS 教學
   ```
4. 點擊「批量生成」

#### 7.9 監控批量處理

```bash
# 查看所有處理中的文章
psql $SUPABASE_DB_URL -c "SELECT article_title, status, quality_score FROM article_jobs WHERE status IN ('pending', 'processing') ORDER BY created_at DESC;"
```

**預期**: 3 篇文章依序或並行處理

✅ **Test Case 2 完成**: [ ]

### Test Case 3: 品質檢查失敗情況

#### 7.10 觸發低品質文章

1. 使用一個非常冷門的關鍵字（例如: "asdfghjkl123456"）
2. 觀察品質檢查是否正確判斷為失敗
3. 確認狀態為 `failed`
4. 檢查 `quality_report` 中的詳細原因

✅ **Test Case 3 完成**: [ ]

---

## 📊 Phase 8: 結果驗證與記錄 (15 分鐘)

### 8.1 測試結果記錄表

| 測試項目 | 預期結果 | 實際結果 | 狀態 | 備註 |
|---------|---------|---------|------|------|
| 資料庫 migration | 新欄位已新增 | | ⬜ | |
| API 端點健康檢查 | 返回 200 OK | | ⬜ | |
| N8N Workflow 觸發 | Webhook 接收成功 | | ⬜ | |
| SERP 分析回調 | 平台狀態更新 | | ⬜ | |
| 內容計劃回調 | 平台狀態更新 | | ⬜ | |
| 文章生成回調 | 平台狀態更新 | | ⬜ | |
| 品質檢查回調 | 平台狀態更新 | | ⬜ | |
| WordPress 發布 | 文章成功發布 | | ⬜ | |
| 批量生成 | 3 篇文章全部成功 | | ⬜ | |
| 品質檢查失敗 | 正確標記為失敗 | | ⬜ | |

### 8.2 效能記錄

記錄單篇文章生成的時間：

- **SERP 分析**: _____ 秒
- **競爭對手分析**: _____ 秒（如有啟用）
- **內容計劃**: _____ 秒
- **文章撰寫**: _____ 秒
- **品質檢查**: _____ 秒
- **WordPress 發布**: _____ 秒
- **總計**: _____ 秒

### 8.3 已知問題記錄

**問題 1**: _____________________
- 錯誤訊息: _____________________
- 重現步驟: _____________________
- 暫時解法: _____________________

**問題 2**: _____________________
- 錯誤訊息: _____________________
- 重現步驟: _____________________
- 暫時解法: _____________________

✅ **驗證完成**: [ ]

---

## 🐛 Phase 9: 常見問題排除

### 問題 1: Webhook 觸發失敗

**症狀**: 文章狀態停留在 "pending"

**檢查步驟**:

```bash
# 1. 測試 N8N Webhook 是否可訪問
curl -X POST $N8N_WEBHOOK_BASE_URL \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $N8N_API_KEY" \
  -d '{"test": true}'

# 2. 檢查 N8N 是否執行
docker ps | grep n8n
# 或
ps aux | grep n8n

# 3. 查看 Next.js 開發伺服器日誌
# 應該看到觸發 N8N 的請求

# 4. 查看 N8N 日誌
docker logs n8n --tail 50
```

**解決方法**:
- 確認 N8N Workflow 已啟用（Active）
- 確認 API Key 正確
- 確認 Webhook URL 正確

### 問題 2: Callback 未更新狀態

**症狀**: N8N 執行成功，但平台狀態未更新

**檢查步驟**:

```bash
# 1. 測試 Callback 端點
curl http://localhost:3168/api/n8n/callback

# 2. 檢查 Tunnel 是否運行
curl https://random-words-abc123.trycloudflare.com/api/n8n/callback

# 3. 查看 Next.js 伺服器日誌
# 應該看到 POST /api/n8n/callback 請求
```

**解決方法**:
- 確認 Cloudflare Tunnel 正在運行
- 確認 `NEXT_PUBLIC_APP_URL` 設定正確
- 確認 N8N 中的 Callback URL 正確

### 問題 3: WordPress 發布失敗

**症狀**: 文章生成成功，但 WordPress 發布失敗

**檢查步驟**:

```bash
# 測試 WordPress REST API
curl -X POST https://your-wordpress-site.com/wp-json/wp/v2/posts \
  -u "username:xxxx xxxx xxxx xxxx" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","content":"Test content","status":"draft"}'
```

**解決方法**:
- 確認 WordPress 應用密碼正確
- 確認 WordPress REST API 已啟用
- 確認 WordPress 使用者有發布權限

### 問題 4: Perplexity API 錯誤

**症狀**: SERP 分析階段失敗

**檢查步驟**:

```bash
# 測試 Perplexity API
curl https://api.perplexity.ai/chat/completions \
  -H "Authorization: Bearer $PLATFORM_PERPLEXITY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonar",
    "messages": [{"role": "user", "content": "Test"}]
  }'
```

**解決方法**:
- 確認 API Key 正確
- 確認 API 額度足夠
- 暫時停用 SERP 分析功能（設定 `serp_analysis_enabled: false`）

---

## 📝 Phase 10: 更新文檔 (10 分鐘)

### 10.1 更新 CHANGELOG.md

```bash
# 在 CHANGELOG.md 的 [Unreleased] 區塊添加

### 🔗 N8N Workflow 整合 - ✅ 已完成 (2025-01-24)

#### 新增 (Added)

##### [2025-01-24] - N8N 整合完整實作
- 資料庫擴充
  - 新增 `article_jobs.workflow_data` JSONB 欄位
  - 新增 `article_jobs.processing_stages` JSONB 欄位
  - 新增 `article_jobs.quality_score` INTEGER 欄位
  - 新增 `website_configs.n8n_webhook_url` TEXT 欄位
  - 新增 `website_configs.workflow_settings` JSONB 欄位
- API 端點
  - 檔案: `src/app/api/n8n/callback/route.ts`
  - 功能: 接收 N8N workflow 各階段回調
  - 檔案: `src/app/api/articles/previous/route.ts`
  - 功能: 提供舊文章列表供內部連結使用
- Server Actions 修改
  - 檔案: `src/app/(dashboard)/dashboard/articles/new/actions.ts`
  - 功能: 觸發 N8N Workflow
  - 功能: 處理觸發失敗情況
- 文檔
  - 檔案: `N8N-INTEGRATION-GUIDE.md`
  - 檔案: `docs/n8n-workflow-example.json`
  - 檔案: `N8N-IMPLEMENTATION-CHECKLIST.md`

#### 測試結果
- [記錄測試結果]
```

### 10.2 建立測試報告

建立 `TEST-REPORT-2025-01-24.md` 記錄測試結果

✅ **文檔更新完成**: [ ]

---

## 🎉 完成確認

### 最終檢查清單

- [ ] 資料庫 migration 成功
- [ ] 環境變數設定完成
- [ ] API 端點運作正常
- [ ] N8N Workflow 已配置並啟用
- [ ] 單一文章生成測試成功
- [ ] 批量生成測試成功
- [ ] 品質檢查機制正常
- [ ] WordPress 發布成功
- [ ] 所有 callback 正確更新狀態
- [ ] 文檔已更新
- [ ] 已知問題已記錄

### 效能基準

**目標效能** (單篇文章):
- SERP 分析: < 30 秒
- 內容計劃: < 20 秒
- 文章撰寫: < 60 秒
- 品質檢查: < 10 秒
- WordPress 發布: < 10 秒
- **總計**: < 130 秒 (約 2 分鐘)

**實際效能**: _____ 秒

### 下一步行動

測試成功後：
- [ ] 部署到生產環境
- [ ] 配置生產環境 N8N
- [ ] 設定監控和告警
- [ ] 實作密碼加密
- [ ] 優化 AI prompt
- [ ] 添加圖片生成功能

---

**測試日期**: 2025-01-24
**測試人員**: _________________
**測試結果**: ✅ 成功 / ⚠️ 部分成功 / ❌ 失敗
**備註**: _________________

---

**Good luck! 🚀**
