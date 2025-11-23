# Tasks: 修復文章儲存流程與 Token 扣除邏輯

## Phase 1: 問題驗證與資料檢查

- [ ] 1.1 驗證重複生成問題
  - 檢查資料庫中是否有同一個 `article_job_id` 對應多筆 `generated_articles`
  - 查詢 `article_jobs` 表，確認 status 和 metadata 狀態
  - 記錄重複生成的模式（是否在特定階段觸發）

- [ ] 1.2 驗證 Token 扣除問題
  - 查詢 `token_usage_logs` 確認是否有記錄
  - 檢查 `company_subscriptions` 餘額是否在文章生成後減少
  - 確認 `TokenBillingService.deductTokensIdempotent()` 方法可用

- [ ] 1.3 驗證 HTML 預覽問題
  - 查詢最近生成的 `generated_articles.html_content`
  - 確認內容是 HTML 還是 Markdown 格式
  - 檢查 `HTMLAgent` 輸出格式

## Phase 2: 防止重複生成

- [ ] 2.1 在文章儲存時記錄文章 ID 到 metadata
  - 修改 `orchestrator.ts` line 545-560
  - 儲存成功後更新 `article_jobs.metadata.saved_article_id`
  - 同時更新 `article_jobs.metadata.generation_completed_at`

- [ ] 2.2 在生成開始前檢查是否已生成
  - 在 `orchestrator.execute()` 開頭檢查 `metadata.saved_article_id`
  - 如果已存在文章 ID，從資料庫載入文章並返回
  - 避免重複執行 AI 生成流程

- [ ] 2.3 確保 job status 正確更新
  - 驗證 `updateJobStatus()` 在所有階段正確調用
  - 確保 `status = 'completed'` 時不會被重新觸發

## Phase 3: 實作 Token 扣除邏輯

- [ ] 3.1 累積所有 AI 調用的 token 使用量
  - 在 `orchestrator.execute()` 中記錄每個 agent 的 token 使用量
  - 累加 research, strategy, writing, meta, image 等階段的 tokens
  - 儲存到 `result.executionStats.totalTokenUsage`

- [ ] 3.2 在文章儲存後調用 Token 扣除
  - 在 `orchestrator.ts` Phase 8 文章儲存成功後
  - 調用 `TokenBillingService.deductTokensIdempotent()`
  - 使用 `articleJobId` 作為 idempotency key
  - 傳入實際的 token 使用量和 metadata

- [ ] 3.3 錯誤處理與記錄
  - Token 扣除失敗時記錄錯誤但不中斷流程
  - 使用 try-catch 包裹扣除邏輯
  - 記錄到 `error_tracker` 和 `article_jobs.metadata.token_deduction_error`

- [ ] 3.4 驗證 Idempotency
  - 測試重複調用同一個 `articleJobId` 的扣除
  - 確認不會重複扣除 Token
  - 檢查 `token_usage_logs` 只有一筆記錄

## Phase 4: 修正 HTML 預覽顯示

- [ ] 4.1 驗證 HTMLAgent 輸出格式
  - 檢查 `html-agent.ts` 確保輸出是 HTML
  - 確認 Markdown 到 HTML 的轉換正確
  - 測試圖片 URL 是否轉換為 `<img>` 標籤

- [ ] 4.2 確保正確儲存 HTML
  - 檢查 `article-storage.ts` line 202
  - 確認儲存的是 `writing.html` 而非 `writing.markdown`
  - 如果 `html` 不存在，才使用 `markdown` 作為備選

- [ ] 4.3 前端顯示驗證
  - 確認 `articles/page.tsx` 使用 DOMPurify 渲染
  - 驗證 `ALLOWED_TAGS` 包含 `<img>` 標籤
  - 測試預覽是否正確顯示圖片

## Phase 5: 整合測試

- [ ] 5.1 端到端測試：完整文章生成流程
  - 從關鍵字輸入到文章完成
  - 驗證只生成一篇文章
  - 確認 Token 正確扣除
  - 檢查預覽正確顯示 HTML

- [ ] 5.2 測試重複觸發保護
  - 嘗試重複生成同一個 `article_job_id`
  - 確認系統返回已存在的文章
  - 驗證不會重複扣除 Token

- [ ] 5.3 測試 Token 扣除失敗場景
  - 模擬資料庫錯誤
  - 確認文章仍然生成成功
  - 驗證錯誤被正確記錄

- [ ] 5.4 資料庫驗證
  - 檢查 `generated_articles` 只有一筆記錄
  - 檢查 `article_jobs.status = 'completed'`
  - 檢查 `token_usage_logs` 有正確記錄
  - 檢查 `company_subscriptions` 餘額減少

## Phase 6: 部署與監控

- [ ] 6.1 部署到 Vercel
  - 執行 `pnpm run build` 確認無錯誤
  - 推送到 GitHub 觸發 Vercel 部署
  - 檢查部署日誌無錯誤

- [ ] 6.2 生產環境驗證
  - 在實際環境生成測試文章
  - 驗證三個問題都已解決
  - 檢查 Vercel logs 無異常

- [ ] 6.3 監控與回滾準備
  - 監控文章生成成功率
  - 監控 Token 扣除準確性
  - 準備回滾方案（如發現問題）

## Phase 7: 文件更新

- [ ] 7.1 更新 CHANGELOG.md
  - 記錄三個問題的修復
  - 說明技術細節和影響範圍

- [ ] 7.2 更新相關文件
  - 更新文章生成流程文件
  - 更新 Token 計費說明
  - 記錄防重複生成機制
