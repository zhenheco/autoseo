# 🚀 GitHub Actions 測試指南

## ✅ 所有修正已完成！

GitHub Actions 工作流程現在已經可以正常運作。我們已經成功解決了所有錯誤並完成了端對端測試。

## 🔧 已修正的問題

1. **資料表名稱不一致**
   - ❌ 舊：`article_generation_jobs`
   - ✅ 新：`article_jobs` (實際資料庫表名)

2. **TypeScript 編譯問題**
   - ✅ 添加 `tsconfig.scripts.json` 配置
   - ✅ 路徑別名 `@/` 解析支援

3. **環境變數載入**
   - ✅ 所有腳本添加 `dotenv` 載入
   - ✅ GitHub Actions 中正確傳遞環境變數

4. **欄位處理**
   - ✅ 標題從 `metadata.title` 讀取（表中無 `title` 欄位）

## 🎯 測試步驟

### 1️⃣ 創建測試任務

```bash
# 創建一個測試任務到資料庫
node scripts/create-test-job.js
```

輸出範例：
```
✅ 測試任務創建成功！
   ID: 1a0503a3-e41d-4d48-9604-544a7d709d10
   Job ID: test-job-1763012597377
   標題: 測試文章：AI 如何改變數位行銷
   狀態: pending
```

### 2️⃣ 本地測試單一任務處理

```bash
# 使用上面取得的 ID 測試本地執行
node scripts/process-single-article.js --jobId YOUR_JOB_ID
```

⚠️ **注意**：本地測試需要所有環境變數配置正確

### 3️⃣ 透過 GitHub Actions 處理任務

#### 方法 A：使用 API 觸發（推薦）

```bash
# 替換 YOUR_GITHUB_TOKEN, YOUR_JOB_ID 和 YOUR_TITLE
# 從環境變數讀取 token（更安全）
curl -X POST https://api.github.com/repos/acejou27/Auto-pilot-SEO/dispatches \
  -H "Authorization: token ${GITHUB_PERSONAL_ACCESS_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "generate-article", "client_payload": {"jobId": "YOUR_JOB_ID", "title": "YOUR_TITLE"}}'
```

**⚠️ 安全提醒**：不要在命令中直接使用 token，應該設定環境變數：
```bash
export GITHUB_PERSONAL_ACCESS_TOKEN="your_token_here"
```

#### 方法 B：從 GitHub 網頁手動觸發

1. 前往 https://github.com/acejou27/Auto-pilot-SEO/actions
2. 選擇 "Article Generation Worker" workflow
3. 點擊 "Run workflow"
4. 輸入 Job ID（可選）
5. 點擊 "Run workflow"

### 4️⃣ 批次處理測試

批次處理會自動每 5 分鐘執行一次，或手動觸發：

```bash
# 使用環境變數中的 token
curl -X POST https://api.github.com/repos/acejou27/Auto-pilot-SEO/dispatches \
  -H "Authorization: token ${GITHUB_PERSONAL_ACCESS_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "batch-process", "client_payload": {"debug": true}}'
```

## 📊 監控執行狀態

### 查看最近的 Workflow 執行

```bash
# 使用 gh CLI（推薦）或環境變數中的 token
gh run list --limit 5

# 或使用 curl（需要環境變數）
curl -s -H "Authorization: token ${GITHUB_PERSONAL_ACCESS_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/acejou27/Auto-pilot-SEO/actions/runs?per_page=5" \
  | jq '.workflow_runs[] | {id: .id, name: .name, status: .status, conclusion: .conclusion, created_at: .created_at}'
```

### 查看特定 Workflow 詳情

```bash
# 替換 WORKFLOW_RUN_ID
# 使用 gh CLI（推薦）
gh run view WORKFLOW_RUN_ID

# 或使用 curl（需要環境變數）
curl -s -H "Authorization: token ${GITHUB_PERSONAL_ACCESS_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/acejou27/Auto-pilot-SEO/actions/runs/WORKFLOW_RUN_ID" \
  | jq '{status: .status, conclusion: .conclusion}'
```

## ✨ 完整測試結果

- ✅ **19321871765**: 成功處理測試文章（AI 如何改變數位行銷）
- ✅ **19321688108**: 批次處理成功
- ✅ 資料庫表名修正完成
- ✅ TypeScript 編譯正常
- ✅ 環境變數載入正常

## 🔑 環境變數確認清單

確保 GitHub Secrets 包含以下變數：

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `DEEPSEEK_API_KEY`
- [ ] `OPENAI_API_KEY`
- [ ] `GH_PERSONAL_ACCESS_TOKEN` (用於 API 觸發)

## 📝 注意事項

1. **執行時間**：完整文章生成可能需要 5-10 分鐘
2. **費用考量**：每次執行會消耗 AI API 配額
3. **並行限制**：建議同時處理不超過 3 篇文章
4. **錯誤恢復**：失敗的任務會在下次批次處理時重試

## 🎉 總結

GitHub Actions 整合現已完全正常運作！您可以：

1. **手動創建任務**並通過 API 觸發處理
2. **自動批次處理**每 5 分鐘檢查待處理任務
3. **監控執行狀態**透過 GitHub Actions 儀表板或 API

所有測試均已通過，系統已準備就緒供生產使用！