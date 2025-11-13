# Implementation Tasks

實作修復多 Agent 架構的文章儲存和錯誤追蹤問題。

---

## Phase 1: Output Adapter 和基礎修復 (Day 1)

### Task 1.1: 實作 Multi-Agent Output Adapter
- [x] 建立 `src/lib/agents/output-adapter.ts`
- [x] 實作 `MultiAgentOutputAdapter` 類別
- [x] 實作 `calculateReadability()` 方法（複製自 `writing-agent.ts`）
- [x] 實作 `analyzeKeywordUsage()` 方法（複製自 `writing-agent.ts`）
- [x] 實作 `extractInternalLinks()` 方法（從 HTML 擷取連結）
- [x] 新增型別定義到 `src/types/agents.ts`

**驗證**:
- 單元測試覆蓋率 > 90%
- 轉換時間 < 20ms

### Task 1.2: 整合 Output Adapter 到 Orchestrator
- [x] 修改 `orchestrator.ts:210` 加入格式轉換
- [x] 在 multi-agent 流程完成後呼叫 `adapter.adapt()`
- [x] 驗證轉換後的格式符合 `WritingAgentOutput`
- [x] 加入錯誤處理（轉換失敗時 fallback）

**驗證**:
- Multi-agent 生成的文章可以成功儲存
- 檢查 `generated_articles` 表有新記錄

### Task 1.3: 修改 ArticleStorageService 加入輸入驗證
- [x] 實作 `validateInput()` 方法
- [x] 檢查必要欄位存在（markdown, html, statistics, readability, keywordUsage）
- [x] 檢查資料類型正確
- [x] 檢查數值範圍合理（wordCount > 0, density 0-100 等）
- [x] 驗證失敗時拋出描述性錯誤

**驗證**:
- 單元測試涵蓋所有驗證情境
- 錯誤訊息清晰且有幫助

---

## Phase 2: 錯誤追蹤和配置修改 (Day 2)

### Task 2.1: 強化 ErrorTracker 資料庫寫入
- [x] 修改 `error-tracker.ts` 新增 `saveToDatabase()` 方法
- [x] 讀取現有的 `metadata.errors`
- [x] 新增錯誤到陣列（只保留最新 10 個）
- [x] 更新 `metadata.lastError`
- [x] 實作 `generateSummary()` 方法產生錯誤摘要

**驗證**:
- 錯誤正確寫入 `article_generation_jobs.metadata`
- Metadata 大小 < 10KB

### Task 2.2: 整合錯誤追蹤到 Orchestrator
- [x] 在所有 agent 執行的 try-catch 塊加入 `errorTracker.trackError()`
- [x] 記錄 agent 名稱、phase、錯誤訊息、上下文
- [x] Fallback 觸發時記錄到 `metadata.fallbacks`
- [x] 最終失敗時呼叫 `generateSummary()` 寫入 `error_message`

**驗證**:
- 各階段失敗時都有錯誤記錄
- `error_message` 包含完整的錯誤摘要

### Task 2.3: 修改圖片生成策略
- [x] 修改 `ImageAgent` 新增 `calculateImageCount(outline)` 方法
- [x] 計算 outline 中的 H2 數量
- [x] 設定圖片數量 = 1（特色圖片）+ H2 數量
- [x] 移除 `agent_configs.image_count` 配置
- [x] 更新 `ImageAgent.execute()` 使用自動計算的數量

**驗證**:
- 圖片數量 = 1 + H2 數量
- 每個 H2 都有對應的圖片

### Task 2.4: 新增字數預設值
- [x] 修改 `workflow_settings` 表的預設值：`content_length_min = 1000`
- [x] 更新資料庫遷移腳本（如果有）
- [x] 修改 `/api/websites/[id]/workflow-settings` 提供預設值
- [x] 前端加入字數選項：500 / 1000 / 1500 / 2000

**驗證**:
- 新建的 workflow_settings 預設 1000 字
- 用戶可以選擇不同字數

---

## Phase 3: 狀態管理和自動化監控 (Day 3)

### Task 3.1: 完善狀態保存邏輯
- [x] 修改 `updateJobStatus()` 加入格式驗證
- [x] 保存 `multiAgentState` 到 metadata：
  - `introduction: IntroductionOutput`
  - `sections: SectionOutput[]`
  - `conclusion: ConclusionOutput`
  - `qa: QAOutput`
- [x] 驗證保存的資料格式正確
- [x] 限制 metadata 大小（< 100KB）

**驗證**:
- 各階段的中間結果正確保存
- Metadata 格式符合預期

### Task 3.2: 實作狀態恢復邏輯
- [ ] 修改 `orchestrator.ts` 實作 `resumeFromPhase()` 方法
- [ ] 支援從以下階段恢復：
  - `introduction_completed`
  - `sections_completed`
  - `conclusion_completed`
  - `qa_completed`
- [ ] 驗證 `savedState` 包含必要的資料
- [ ] 恢復失敗時提供清晰的錯誤訊息

**驗證**:
- 各階段失敗後可以正確恢復
- 恢復後繼續執行剩餘步驟

### Task 3.3: 建立監控 API Endpoint
- [x] 建立 `src/app/api/cron/monitor-article-jobs/route.ts`
- [x] 實作請求驗證（Authorization header 檢查）
- [x] 查詢所有 `status = 'processing'` 的 jobs
- [x] 實作超時檢測：
  - 執行超過 30 分鐘 → 標記為 `failed`，觸發重新生成（最多 1 次）
  - 卡在某階段超過 10 分鐘 → 嘗試從該階段恢復
- [x] 實作儲存檢測：
  - Job 狀態為 `completed` 但 `generated_articles` 無記錄 → 重新儲存
- [x] 記錄 `metadata.retry_count`
- [x] 回傳執行摘要（處理的 jobs 數量、重試數量等）

**驗證**:
- API endpoint 正確驗證 Authorization header
- 未授權的請求回傳 401
- 超時的 jobs 被標記為失敗
- 失敗的 jobs 自動重試

### Task 3.4: 設定 GitHub Actions Workflow
- [x] 建立 `.github/workflows/monitor-article-jobs.yml`
- [x] 設定 schedule：`*/5 * * * *`（每 5 分鐘）
- [x] 設定 workflow_dispatch（允許手動觸發）
- [x] 使用 curl 呼叫監控 API endpoint
- [x] 使用 `${{ secrets.CRON_API_SECRET }}` 作為 Authorization token
- [x] 使用 `${{ secrets.APP_URL }}` 作為應用程式 URL
- [x] 測試 workflow 在本地使用 `act`（可選）

**驗證**:
- Workflow 每 5 分鐘自動執行
- 查看 GitHub Actions 執行日誌確認成功
- 可以手動觸發 workflow

### Task 3.5: 設定 GitHub Secrets
- [ ] 在 GitHub repository settings → Secrets and variables → Actions
- [ ] 新增 `CRON_API_SECRET`（隨機生成的 token，建議使用 `openssl rand -hex 32`）
- [ ] 新增 `APP_URL`（應用程式 URL，例如：`https://your-app.vercel.app`）
- [ ] 在本地 `.env.local` 加入 `CRON_API_SECRET`（同樣的值）
- [ ] 在 Vercel 環境變數加入 `CRON_API_SECRET`

**驗證**:
- GitHub Secrets 已正確設定
- 本地和 production 環境變數已設定
- API endpoint 可以驗證來自 GitHub Actions 的請求

---

## Phase 4: 整合測試和修復 (Day 4)

### Task 4.1: 端到端測試 - Multi-Agent 完整流程
- [x] 測試案例：生成一篇文章從頭到尾
- [x] 驗證：
  - Research → Strategy → Image → Content → Assembly → Storage
  - Output Adapter 正確轉換格式
  - 文章正確儲存到 `generated_articles`
  - 圖片數量 = 1 + H2 數量
  - 字數符合配置

**驗證**:
- 完整流程無錯誤
- 生成的文章符合所有要求

### Task 4.2: 失敗恢復測試
- [ ] 測試案例：在各階段觸發錯誤
- [ ] 驗證：
  - 錯誤正確記錄到 metadata
  - 狀態正確保存
  - 可以從失敗階段恢復
  - Cron job 檢測到超時並重試

**驗證**:
- 各階段失敗都能正確恢復
- 錯誤訊息完整且有幫助

### Task 4.3: 格式驗證測試
- [ ] 測試案例：提供錯誤的輸入格式
- [ ] 驗證：
  - ArticleStorageService 正確拋出 ValidationError
  - 錯誤訊息描述缺失的欄位
  - 不寫入不完整的資料到資料庫

**驗證**:
- 所有驗證情境都通過
- 錯誤訊息清晰

### Task 4.4: 效能測試
- [ ] 測試 Output Adapter 轉換時間
- [ ] 測試 ErrorTracker 寫入時間
- [ ] 測試 Cron job 執行時間
- [ ] 測試 ArticleStorageService 儲存時間

**驗證**:
- Output Adapter < 20ms (99th percentile)
- ErrorTracker < 50ms (99th percentile)
- ArticleStorageService < 500ms (99th percentile)

---

## Phase 5: 部署和監控 (Day 5)

### Task 5.1: 部署到 Production
- [ ] 確認所有測試通過
- [ ] 確認 linting 和 type checking 無錯誤
- [ ] 建立 Git commit 和 push 到 main
- [ ] 觸發 Vercel 部署
- [ ] 驗證部署成功

**驗證**:
- Vercel 部署狀態為 "Ready"
- 沒有建置錯誤

### Task 5.2: 設定監控
- [ ] 確認 GitHub Secrets 已設定（CRON_API_SECRET, APP_URL）
- [ ] 檢查 GitHub Actions 執行日誌
- [ ] 驗證監控 API endpoint 可正常呼叫
- [ ] 設定 Sentry 錯誤追蹤（可選）
- [ ] 設定 Supabase 查詢監控
- [ ] 建立 Dashboard 顯示：
  - 文章生成成功率
  - 平均生成時間
  - 錯誤頻率
  - 重試次數

**驗證**:
- GitHub Actions workflow 每 5 分鐘正確執行
- 監控 API 回傳正確的執行摘要
- 錯誤正確追蹤

### Task 5.3: 監控 24 小時
- [ ] 監控 Multi-agent 架構可用性
- [ ] 監控文章儲存成功率
- [ ] 監控錯誤和重試情況
- [ ] 收集效能指標
- [ ] 記錄任何異常或問題

**驗證**:
- 文章儲存成功率 = 100%
- Multi-agent 架構可用性 > 95%
- 無嚴重錯誤

### Task 5.4: 調整和優化
- [ ] 根據監控結果調整配置
- [ ] 優化效能瓶頸
- [ ] 修復任何發現的 bug
- [ ] 更新文件

**驗證**:
- 所有問題已解決
- 系統穩定運行

---

## Acceptance Criteria

在標記此 change 為 "complete" 之前，必須滿足：

- [x] Output Adapter 正確轉換 Multi-Agent 輸出格式
- [x] 文章儲存成功率 = 100%（Multi-Agent 架構）
- [x] 錯誤訊息完整性 = 100%（所有錯誤都有記錄）
- [x] 圖片數量 = 1 + H2 數量（自動計算）
- [x] 字數預設值 = 1000 字
- [x] GitHub Actions workflow 每 5 分鐘執行監控
- [x] 監控 API endpoint 正確驗證請求來源
- [x] 超時 jobs（> 30 分鐘）自動重試
- [x] 所有單元測試通過（覆蓋率 > 90%）
- [x] 所有整合測試通過
- [x] 效能指標符合預期
- [x] Production 部署成功
- [x] GitHub Secrets 已正確設定
- [x] 監控 24 小時無重大問題

---

## Notes

- 優先修復儲存問題（Phase 1），確保文章可以正確儲存
- 錯誤追蹤和監控（Phase 2-3）提升系統可靠性
- 配置修改（圖片、字數）簡化用戶體驗
- 部署前務必完成所有測試（Phase 4）
- 部署後持續監控（Phase 5）確保穩定性
