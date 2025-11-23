# Tasks: 修復文章預覽顯示與 Token 扣除邏輯

## Phase 1: 問題診斷與驗證

- [ ] 1.1 查詢資料庫確認 `html_content` 實際儲存格式
  - 連接資料庫
  - 查詢最近生成的文章
  - 檢查 `html_content` 欄位內容
  - 確認是 HTML 還是 Markdown 格式

- [ ] 1.2 檢查 HTMLAgent 輸出
  - 閱讀 `src/lib/agents/html-agent.ts`
  - 確認圖片 URL 是否轉換為 `<img>` 標籤
  - 驗證輸出格式是否符合預期

- [ ] 1.3 檢查 Vercel 部署設定
  - 確認 Vercel 是否使用 pnpm
  - 檢查是否有 `package-lock.json` 殘留
  - 驗證 GitHub Actions 和 Vercel 使用相同的 package manager

## Phase 2: 修復文章預覽顯示

- [ ] 2.1 如果 `html_content` 是 Markdown，修正 HTMLAgent
  - 確保 HTMLAgent 產生完整 HTML
  - 將 Markdown 圖片語法轉換為 `<img>` 標籤
  - 測試修正後的輸出

- [ ] 2.2 改進前端顯示組件
  - 使用 `ArticleHtmlPreview` 組件替代 `dangerouslySetInnerHTML`
  - 確保 DOMPurify 配置正確
  - 測試圖片顯示是否正常

- [ ] 2.3 移除獨立預覽頁面（如不需要）
  - 移除 `src/app/(dashboard)/dashboard/articles/[id]/preview/page.tsx`
  - 移除相關路由和連結
  - 僅保留列表頁面右側預覽

## Phase 3: 實作 Token 扣除邏輯

- [ ] 3.1 修改 `ParallelOrchestrator` 整合 Token 扣除
  - 在 `execute()` 方法末尾加入 Token 扣除邏輯
  - 使用 `deductTokensIdempotent()` 方法
  - 以 `articleJobId` 作為 idempotency key
  - 記錄所有 AI 調用的 token 使用量

- [ ] 3.2 計算實際 Token 消耗
  - 累積所有 agent 的 token 使用量
  - 或使用預設值（15000 tokens/article）
  - 將詳細資訊記錄到 `token_usage_logs`

- [ ] 3.3 錯誤處理
  - Token 扣除失敗時記錄錯誤但不阻止文章完成
  - 使用 try-catch 包裹扣除邏輯
  - 記錄到 error tracking 系統

- [ ] 3.4 測試 Idempotency
  - 模擬重複執行相同 job
  - 確認不會重複扣除 Token
  - 驗證資料庫記錄正確

## Phase 4: 清理 Package Manager 相關問題

- [ ] 4.1 移除 npm 相關檔案（如存在）
  - 刪除 `package-lock.json`
  - 檢查 `.gitignore` 是否包含 `package-lock.json`
  - 確保只有 `pnpm-lock.yaml`

- [ ] 4.2 更新 Vercel 設定
  - 檢查 Vercel 專案設定
  - 確認使用 pnpm 作為 package manager
  - 更新建置指令（如需要）

- [ ] 4.3 驗證 GitHub Actions
  - 檢查所有 workflow 檔案
  - 確認都使用 `pnpm` 指令
  - 移除任何 `npm` 指令

## Phase 5: 測試與驗證

- [ ] 5.1 本地測試
  - 啟動開發伺服器 `pnpm run dev`
  - 生成一篇測試文章
  - 驗證預覽顯示正確（HTML 含圖片）
  - 確認 Token 正確扣除

- [ ] 5.2 資料庫驗證
  - 檢查 `generated_articles.html_content` 格式
  - 檢查 `company_subscriptions` 餘額更新
  - 檢查 `token_usage_logs` 記錄完整
  - 驗證 `token_balance_changes` 變更記錄

- [ ] 5.3 GitHub Actions 測試
  - 觸發文章生成 workflow
  - 查看 Actions 日誌
  - 確認無 package manager 錯誤
  - 驗證文章生成成功且 Token 扣除

- [ ] 5.4 Vercel 部署驗證
  - 部署到 Vercel
  - 檢查 build logs
  - 測試生產環境功能
  - 確認 Token 扣除正常運作

## Phase 6: 文件更新

- [ ] 6.1 更新 CLAUDE.md
  - 記錄 Token 扣除邏輯
  - 更新預覽顯示說明
  - 記錄 package manager 統一為 pnpm

- [ ] 6.2 更新 README（如需要）
  - 更新安裝指令（使用 pnpm）
  - 更新開發指令
  - 更新 Token 計費說明

- [ ] 6.3 更新 OpenSpec 規範
  - 將 Token 扣除邏輯加入 `token-billing` spec
  - 更新相關需求描述
  - 標記此變更為已完成

## 驗證清單

完成所有 tasks 後，確認以下項目：

- [ ] ✅ 文章預覽正確顯示 HTML 內容（含圖片）
- [ ] ✅ Token 在文章完成時正確扣除
- [ ] ✅ Token 餘額顯示即時更新
- [ ] ✅ Idempotency 正確運作（同一文章不重複扣除）
- [ ] ✅ 只使用 pnpm，無 npm 相關檔案
- [ ] ✅ GitHub Actions 成功運行
- [ ] ✅ Vercel 部署成功
- [ ] ✅ 所有測試通過
