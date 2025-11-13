# GitHub Actions 文章生成設置指南

## 🎯 概述

此方案使用 GitHub Actions 處理文章生成任務，完全避免 Vercel 5 分鐘超時限制。

### 優勢
- ✅ **30 分鐘執行時間**（足夠處理任何複雜文章）
- ✅ **完全免費**（每月 2000 分鐘免費額度）
- ✅ **自動重試**機制
- ✅ **並行處理**多篇文章

---

## 🔧 設置步驟

### 1. 創建 GitHub Personal Access Token

1. 前往 GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 點擊 "Generate new token (classic)"
3. 設置：
   - **Note**: `Auto-pilot-SEO Actions`
   - **Expiration**: `No expiration` 或 `90 days`
   - **Scopes**: 勾選以下權限
     - ✅ `repo` (Full control of private repositories)
     - ✅ `workflow` (Update GitHub Action workflows)
4. 點擊 "Generate token"
5. **複製 token**（只會顯示一次！）

### 2. 設置 GitHub Repository Secrets

前往您的倉庫 → Settings → Secrets and variables → Actions

點擊 "New repository secret" 添加以下 Secrets：

#### 必要的 Secrets

| Secret Name | 說明 | 來源 |
|------------|------|------|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | 剛才創建的 token | GitHub |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | Supabase Dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名密鑰 | Supabase Dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服務密鑰 | Supabase Dashboard |
| `OPENAI_API_KEY` | OpenAI API Key | OpenAI Platform |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | DeepSeek Platform |
| `ANTHROPIC_API_KEY` | Anthropic API Key | Anthropic Console |
| `OPENROUTER_API_KEY` | OpenRouter API Key | OpenRouter |

### 3. 更新 Vercel 環境變數

在 Vercel Dashboard → Settings → Environment Variables 添加：

```
USE_GITHUB_ACTIONS=true
GITHUB_PERSONAL_ACCESS_TOKEN=<your-token>
```

### 4. 構建腳本（用於 GitHub Actions）

確保您的 `package.json` 包含構建腳本：

```json
{
  "scripts": {
    "build:scripts": "tsc scripts/*.js --outDir dist/scripts --allowJs --esModuleInterop"
  }
}
```

---

## 🚀 使用方式

### 方式 1：自動觸發（推薦）

當用戶在前端點擊生成文章時，系統會：
1. 創建文章 Job
2. 自動觸發 GitHub Actions
3. 在背景處理（無超時限制）
4. 完成後更新資料庫

### 方式 2：手動觸發

前往 GitHub → Actions → "Article Generation Worker" → Run workflow

可選參數：
- `jobId`: 指定要處理的 Job ID

### 方式 3：定時批次處理

系統每 5 分鐘自動檢查並處理待處理的文章。

---

## 📊 監控與日誌

### 查看執行狀態

1. 前往 GitHub → Actions
2. 查看 "Article Generation Worker" workflow
3. 點擊具體的運行查看詳細日誌

### 查看文章狀態

```sql
-- 查看所有文章任務狀態
SELECT
  id,
  title,
  status,
  created_at,
  started_at,
  completed_at,
  metadata->>'processor' as processor
FROM article_generation_jobs
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🔍 故障排除

### 問題 1：GitHub Actions 未觸發

**檢查**：
- Personal Access Token 是否有效
- Repository Secrets 是否正確設置
- Workflow 文件是否在 `.github/workflows/` 目錄

### 問題 2：文章生成失敗

**查看日誌**：
1. GitHub Actions 頁面查看錯誤
2. 檢查 Supabase 中的 `error_message` 欄位

### 問題 3：API Keys 錯誤

**確認**：
- 所有 API Keys 都已設置且有效
- 檢查額度是否充足

---

## 🎨 進階配置

### 調整並行處理數量

編輯 `scripts/process-batch-articles.js`：

```javascript
// 每次最多處理的文章數
.limit(5);  // 可調整為 1-10

// 最多成功處理數
if (results.filter(r => r.success).length >= 3) {
  // 可調整為 1-5
}
```

### 調整執行頻率

編輯 `.github/workflows/article-generation.yml`：

```yaml
schedule:
  - cron: '*/5 * * * *'  # 每 5 分鐘
  # 改為每 10 分鐘：
  # - cron: '*/10 * * * *'
  # 改為每小時：
  # - cron: '0 * * * *'
```

### 調整超時時間

```yaml
timeout-minutes: 30  # 可調整為 10-360 分鐘
```

---

## 📈 使用統計

GitHub Actions 免費額度：
- **公開倉庫**：無限制
- **私有倉庫**：2,000 分鐘/月

使用估算：
- 每篇文章約 3-5 分鐘
- 每月可處理約 400-600 篇文章（私有倉庫）

---

## ✅ 驗證設置

### 測試命令

```bash
# 測試 GitHub Actions 觸發
curl -X POST http://localhost:3168/api/articles/trigger-github \
  -H "Content-Type: application/json" \
  -d '{"jobId": "test-job-id", "title": "Test Article"}'

# 手動執行腳本（本地測試）
node scripts/process-single-article.js --jobId <job-id> --title "Test"
```

---

## 🔄 遷移到 Cloudflare Workers（未來）

當有付費客戶時，可以輕鬆遷移到 Cloudflare Workers：

1. 保持相同的架構
2. 更改處理器從 GitHub Actions 到 Cloudflare Workers
3. 獲得更好的性能和全球分佈

---

## 📝 注意事項

1. **安全性**：Personal Access Token 請妥善保管
2. **成本控制**：監控使用量，避免超出免費額度
3. **備份方案**：保留 Vercel cron job 作為備用

---

## 🤝 支援

如有問題，請查看：
- GitHub Actions 日誌
- Supabase 資料庫狀態
- Vercel Functions 日誌

或聯繫技術支援。