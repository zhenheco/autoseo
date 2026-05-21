# GitHub Actions 自動觸發設定指南

## 概述

本專案已實作自動觸發 GitHub Actions workflow 的機制。當用戶從前端提交文章標題時，系統會立即觸發 workflow 處理任務，而不需要等待 cron schedule（每分鐘執行一次）。

## 運作原理

1. **前端提交**: 用戶在前端輸入文章標題並提交
2. **創建任務**: API endpoint (`/api/articles/generate-batch`) 在資料庫中創建 `article_jobs`
3. **觸發 workflow**: API 自動調用 GitHub API 發送 `repository_dispatch` 事件
4. **立即執行**: GitHub Actions 收到事件後立即啟動 workflow 處理任務

## 必要設定

### 1. 創建 GitHub Personal Access Token (PAT)

1. 前往 GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 點擊 "Generate new token (classic)"
3. 設定以下選項：
   - **Note**: `Auto-pilot-SEO Workflow Trigger`
   - **Expiration**: 選擇適當的期限（建議 90 天或更長）
   - **Scopes**: 勾選以下權限
     - ✅ `repo` (Full control of private repositories)
     - ✅ `workflow` (Update GitHub Action workflows)

4. 點擊 "Generate token"
5. **重要**: 立即複製 token（只會顯示一次）

### 2. 在 Vercel 設定環境變數

#### 使用 Vercel Dashboard:

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇專案 `Auto-pilot-SEO`
3. 前往 Settings → Environment Variables
4. 新增環境變數：
   - **Key**: `GITHUB_TOKEN`
   - **Value**: 貼上剛才複製的 GitHub PAT
   - **Environment**: 選擇 `Production`, `Preview`, `Development` (全選)
5. 點擊 "Save"

#### 使用 Vercel CLI:

```bash
# 設定 GITHUB_TOKEN
vercel env add GITHUB_TOKEN

# 選擇 Production, Preview, Development 環境
# 貼上 GitHub PAT 值

# 重新部署以套用新的環境變數
vercel --prod
```

### 3. 在 GitHub Secrets 設定（選用，用於 GitHub Actions）

如果需要在 GitHub Actions 中使用相同的 token：

```bash
gh secret set GITHUB_TOKEN --body "your_github_pat_here"
```

## 驗證設定

### 1. 檢查環境變數是否設定成功

```bash
# 使用 Vercel CLI 列出環境變數
vercel env ls

# 應該看到 GITHUB_TOKEN 出現在列表中
```

### 2. 測試自動觸發功能

1. 前往前端頁面
2. 輸入文章標題並提交
3. 檢查 Vercel Logs，應該看到：
   ```
   [Batch] ✅ Article job queued: <文章標題>
   [Batch] ✅ Triggered GitHub Actions workflow for 1 jobs
   ```
4. 前往 GitHub Actions 頁面，應該立即看到新的 workflow run 開始執行

### 3. 查看 GitHub Actions 執行狀態

```bash
# 列出最近的 workflow runs
gh run list --workflow=process-article-jobs.yml --limit 5

# 查看特定 run 的詳細資訊
gh run view <run_id>

# 即時監控 workflow 執行
gh run watch <run_id>
```

## 故障排除

### 問題 1: Vercel Logs 顯示 "GITHUB_TOKEN not configured"

**解決方案**:

- 確認已在 Vercel 環境變數中設定 `GITHUB_TOKEN`
- 確認環境變數已套用到正確的環境（Production/Preview/Development）
- 重新部署專案：`vercel --prod`

### 問題 2: Workflow 沒有自動觸發

**可能原因**:

1. **GITHUB_TOKEN 權限不足**
   - 確認 token 有 `repo` 和 `workflow` 權限

2. **API 調用失敗**
   - 檢查 Vercel Logs 中是否有錯誤訊息
   - 確認 repository 名稱正確（`acejou27/Auto-pilot-SEO`）

3. **Token 已過期**
   - 重新生成 GitHub PAT
   - 更新 Vercel 環境變數

### 問題 3: Workflow 觸發成功但沒有處理任務

**檢查步驟**:

1. 確認任務已創建在資料庫中：

   ```bash
   tsx scripts/check-article-status.ts
   ```

2. 檢查 workflow logs：

   ```bash
   gh run view --log
   ```

3. 確認 workflow 文件配置正確（`.github/workflows/process-article-jobs.yml`）

## 備援機制

即使 `GITHUB_TOKEN` 未設定或自動觸發失敗，系統仍有備援機制：

- **Cron Schedule**: Workflow 會每分鐘自動執行一次，處理所有 pending 狀態的任務
- **手動觸發**: 可以在 GitHub Actions 頁面手動觸發 workflow

## 安全性考量

1. **Token 權限**: 只授予必要的權限（`repo` 和 `workflow`）
2. **Token 期限**: 定期更新 token（建議每 90 天）
3. **Token 保密**: 絕對不要將 token 提交到版本控制或公開分享
4. **定期審查**: 定期檢查 GitHub Settings → Developer settings → Personal access tokens，移除不再使用的 token

## 相關文件

- `.github/workflows/process-article-jobs.yml` - Workflow 配置文件
- `src/app/api/articles/generate-batch/route.ts` - API endpoint 實作
- `scripts/process-jobs.ts` - 任務處理腳本

## 參考資源

- [GitHub REST API: Repository Dispatches](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
