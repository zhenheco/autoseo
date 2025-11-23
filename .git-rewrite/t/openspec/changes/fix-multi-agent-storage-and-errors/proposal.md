# 修復多 Agent 架構的文章儲存和錯誤追蹤問題

## Why

當前的多 Agent 文章生成架構存在嚴重的儲存和錯誤追蹤問題：

### 1. **文章生成完成但未儲存到資料庫**

**問題現象**：

- 文章生成流程完成（所有 agents 執行成功）
- `article_generation_jobs` 表中 job status = `'completed'`
- **但是** `generated_articles` 表中沒有對應的記錄
- 導致用戶看不到生成的文章，無法使用

**根本原因**：
從程式碼分析發現：

- `orchestrator.ts:524` 呼叫 `articleStorage.saveArticleWithRecommendations()`
- 這個方法依賴 `result.writing` 和 `result.meta` 必須存在
- **多 Agent 架構中**，content 是由 `ContentAssemblerAgent` 組合的
- `ContentAssemblerAgent` 產生的是 `{ markdown, html, statistics }` 格式
- **但是** `ArticleStorageService` 期望的是 `result.writing` 包含 `{ markdown, html, statistics, readability, keywordUsage, internalLinks }` 格式
- 導致 `saveArticle()` 無法正確取得資料，儲存失敗

**具體程式碼問題**（`orchestrator.ts:200-210`）：

```typescript
writingOutput = await this.executeContentGeneration(
  strategyOutput,
  imageOutput,
  brandVoice,
  agentConfig,
  aiConfig,
  context,
);
// writingOutput 的格式是 ContentAssemblerOutput
// 但 ArticleStorageService 期望的是 WritingAgent 的輸出格式
```

### 2. **錯誤資訊缺失或不完整**

**問題現象**：

- 文章生成失敗時，`article_generation_jobs.error_message` 為 null
- 無法判斷在哪個階段失敗（Research/Strategy/Content/Assembly）
- 無法追蹤具體的錯誤原因
- 除錯困難，無法改進系統

**根本原因**：

- `ErrorTracker` 有實作但沒有正確整合到 `orchestrator`
- 各個 agent 的錯誤沒有統一捕獲和記錄
- try-catch 塊捕獲錯誤但沒有寫入資料庫
- Fallback 機制觸發時沒有記錄原因

### 3. **狀態恢復機制不完整**

**問題現象**：

- `orchestrator` 有實作階段保存（`current_phase`）
- 但是當 Phase 3（Content Generation）失敗後，無法恢復
- 因為 `savedState` 沒有正確儲存中間結果

**根本原因**：

- `updateJobStatus()` 只更新 metadata，但沒有驗證資料格式
- 多 Agent 架構的中間狀態（Introduction/Section/Conclusion/QA）沒有保存
- 失敗重試時無法繼續，只能從頭開始

### 4. **缺乏自動化監控和重試機制**

**問題現象**：

- 文章生成中途卡住，沒有自動檢查和重試
- 生成超時（> 30 分鐘）沒有自動中止和重新生成
- 用戶需要手動刷新頁面才知道生成狀態

**根本原因**：

- 缺少定期檢查 job 狀態的 cron job
- 沒有超時檢測機制
- 沒有自動重試邏輯

### 5. **圖片配置不符合需求**

**問題現象**：

- 圖片數量由用戶配置，但應該固定為：1 張特色圖片 + 每個 H2 一張圖片
- 圖片配置複雜，容易出錯

**根本原因**：

- `ImageAgent` 的圖片數量配置過於靈活
- 沒有根據文章結構（H2 數量）自動計算圖片數量

### 6. **字數配置缺少預設值**

**問題現象**：

- 用戶沒有選擇字數時，系統不知道要生成多少字
- 可能導致文章過短或過長

**根本原因**：

- `workflow_settings.content_length_min` 沒有合理的預設值

## What Changes

### 架構變更

#### 1. 標準化 Writing Output 格式

**新增 Multi-Agent Output Adapter**：

- 建立 `src/lib/agents/output-adapter.ts`
- 將 `ContentAssemblerOutput` 轉換為 `WritingAgentOutput` 格式
- 補充缺失的 `readability`、`keywordUsage`、`internalLinks` 欄位
- 確保儲存服務可以正確處理

**修改 Orchestrator**：

- `orchestrator.ts:210` 加入格式轉換
- 在 `saveArticle` 前驗證輸出格式
- 失敗時提供清晰的錯誤訊息

#### 2. 完善錯誤追蹤和記錄

**強化 Error Tracking**：

- 修改 `error-tracker.ts` 增加資料庫寫入功能
- 每個 agent 執行失敗時立即記錄到 `article_generation_jobs.metadata.errors`
- 記錄格式：
  ```json
  {
    "agent": "IntroductionAgent",
    "phase": "content_generation",
    "timestamp": "2025-01-13T10:30:00Z",
    "error": "AI API timeout",
    "context": { "retryCount": 2, "model": "deepseek-chat" }
  }
  ```

**修改 Orchestrator 錯誤處理**：

- 所有 try-catch 塊都呼叫 `errorTracker.trackError()`
- Fallback 觸發時記錄原因到 `metadata.fallbacks`
- 最終失敗時彙總所有錯誤到 `error_message` 欄位

#### 3. 完善狀態保存和恢復

**修改狀態保存邏輯**：

- `updateJobStatus()` 驗證保存的資料格式
- 多 Agent 架構保存所有中間結果：
  ```json
  {
    "current_phase": "content_generation",
    "introduction": { "markdown": "...", "wordCount": 150 },
    "sections": [{ "markdown": "...", "wordCount": 300 }],
    "conclusion": { "markdown": "...", "wordCount": 100 },
    "qa": { "markdown": "...", "wordCount": 200 }
  }
  ```

**修改恢復邏輯**：

- 檢查 `savedState` 的完整性
- 允許從任意階段恢復（不只是 Research/Strategy/Content）
- 恢復失敗時提供詳細錯誤訊息

#### 4. 新增自動化監控和重試機制

**使用 GitHub Actions 定期監控**：

- 建立 `.github/workflows/monitor-article-jobs.yml`
- 每 5 分鐘執行一次（`schedule: '*/5 * * * *'`）
- 呼叫 `/api/cron/monitor-article-jobs` endpoint
- 使用 GitHub Secrets 儲存 API 認證 token

**API Endpoint 實作**：

- 建立 `/api/cron/monitor-article-jobs/route.ts`
- 驗證請求來源（Authorization header）
- 檢查所有 `processing` 狀態的 jobs
- 檢查邏輯：
  - 如果 job 執行超過 30 分鐘 → 標記為 `failed` 並觸發重新生成（最多重試 1 次）
  - 如果 job 卡在某個階段超過 10 分鐘 → 嘗試從該階段恢復
  - 如果 job 已完成但未儲存到 `generated_articles` → 嘗試重新儲存

**新增重試邏輯**：

- 記錄重試次數到 `metadata.retry_count`
- 第一次失敗：自動重試
- 第二次失敗：標記為永久失敗，通知用戶

**為何選擇 GitHub Actions 而非 Vercel Cron**：

- **成本**：GitHub Actions 對公開 repo 免費；Vercel Cron 免費版限制 2 個 cron jobs
- **彈性**：GitHub Actions 支援任意 cron 表達式；Vercel Cron 免費版只能每小時執行
- **可靠性**：GitHub Actions 久經考驗，適合生產環境

#### 5. 修正圖片生成策略

**固定圖片配置**：

- 特色圖片：1 張（必須）
- 內容圖片：根據文章結構自動計算
  - 計算 H2 數量（從 `strategyOutput.outline` 取得）
  - 每個 H2 配置 1 張圖片
  - 總圖片數 = 1（特色圖片）+ H2 數量

**修改 ImageAgent**：

- 移除 `image_count` 配置（改為自動計算）
- 新增 `calculateImageCount(outline)` 方法

#### 6. 新增字數預設值

**修改 Workflow Settings**：

- `content_length_min` 預設值 = 1000 字
- 用戶可以選擇：500 / 1000 / 1500 / 2000 字
- 儲存到 `workflow_settings` 表

## Impact

### Affected Specs

- `article-generation` (修改) - 新增 Output Adapter 和格式驗證
- `error-handling` (修改) - 強化錯誤追蹤和資料庫整合
- `article-storage` (新建) - 定義儲存服務的介面和格式要求
- `agent-orchestration` (修改) - 完善狀態保存和恢復機制

### Affected Code

#### 新建檔案

- `src/lib/agents/output-adapter.ts` - Output 格式轉換器
- `src/app/api/cron/monitor-article-jobs/route.ts` - 自動化監控 API endpoint
- `.github/workflows/monitor-article-jobs.yml` - GitHub Actions 定期監控 workflow
- `openspec/changes/fix-multi-agent-storage-and-errors/specs/article-storage/spec.md` - 儲存服務規格
- `openspec/changes/fix-multi-agent-storage-and-errors/specs/job-monitoring/spec.md` - Job 監控規格

#### 修改檔案

- `src/lib/agents/orchestrator.ts` - 加入格式轉換、錯誤追蹤、狀態驗證、重試邏輯
- `src/lib/agents/error-tracker.ts` - 新增資料庫寫入功能
- `src/lib/agents/image-agent.ts` - 根據 H2 數量自動計算圖片數量
- `src/lib/services/article-storage.ts` - 加入輸入驗證和錯誤訊息
- `src/types/agents.ts` - 新增 `OutputAdapter` 相關型別
- `src/app/api/websites/[id]/workflow-settings/route.ts` - 加入字數預設值

#### 資料庫變更

**修改 workflow_settings 預設值**：

- `content_length_min` 預設值改為 1000
- 建議新增 `content_length_options` 欄位（可選）：`[500, 1000, 1500, 2000]`

**修改 agent_configs 欄位**：

- 移除 `image_count` 欄位（改為自動計算）

### Breaking Changes

**無** - 這是修復現有功能，不改變 API 或行為

### Migration Plan

1. **Phase 1 (Day 1)**: 實作 Output Adapter 和單元測試
2. **Phase 2 (Day 2)**: 整合錯誤追蹤到 Orchestrator；修改圖片和字數配置
3. **Phase 3 (Day 3)**: 完善狀態保存和恢復邏輯；實作監控 API endpoint 和 GitHub Actions workflow
4. **Phase 4 (Day 4)**: 整合測試和修復 bug；測試重試機制
5. **Phase 5 (Day 5)**: 部署到 production，設定 GitHub Secrets，監控 24 小時

### Rollback Strategy

- 無需 rollback - 這是向後相容的修復
- 如果有問題，可以暫時禁用多 Agent 架構（設定 `USE_MULTI_AGENT_ARCHITECTURE=false`）
- 舊的 WritingAgent fallback 機制仍然保留

## Success Metrics

### 功能指標

- **文章儲存成功率** = 100%（當前 ~0% for multi-agent）
- **錯誤訊息完整性** = 100%（當前 ~30%）
- **狀態恢復成功率** > 95%（當前 0%）

### 可靠性指標

- 無新增 regression bugs
- Multi-agent 架構可用性 > 95%
- 平均除錯時間 < 5 分鐘（當前 ~30 分鐘）

### 效能指標

- Output adapter 轉換時間 < 10ms
- 錯誤追蹤寫入時間 < 50ms
- 無額外效能開銷（< 1%）

## Dependencies

### 技術依賴

- TypeScript 5.x
- 現有的 Supabase client
- 現有的 ErrorTracker 架構

### 環境變數

**新增**：

- `CRON_API_SECRET` - GitHub Actions 呼叫監控 API 的認證 token（儲存在 GitHub Secrets）

**說明**：

- 此 secret 用於驗證來自 GitHub Actions 的請求
- 需要在 GitHub repository settings → Secrets and variables → Actions 中設定
- API endpoint 會驗證 `Authorization: Bearer ${CRON_API_SECRET}` header

### 外部服務

**新增**：

- **GitHub Actions** - 免費的定期任務執行服務（公開 repo 免費）

## Risks and Mitigations

| 風險                        | 影響 | 機率 | 緩解策略                                          |
| --------------------------- | ---- | ---- | ------------------------------------------------- |
| **Output Adapter 轉換錯誤** | 高   | 低   | 完整的單元測試；輸入驗證；回退機制                |
| **效能開銷**                | 低   | 低   | Adapter 邏輯簡單；無額外 I/O 操作                 |
| **錯誤追蹤資料過大**        | 中   | 低   | 限制 metadata 大小（< 10KB）；只保留最新 5 個錯誤 |
| **狀態恢復失敗**            | 中   | 中   | 驗證 savedState 完整性；提供降級方案              |

## Open Questions

- [x] Output Adapter 是否需要支援 Legacy WritingAgent 的格式？（**否** - 只處理 Multi-Agent 格式）
- [x] 錯誤追蹤是否需要整合 Sentry？（**否** - 先用內建日誌，之後再考慮）
- [ ] 是否需要為每個 Agent 設定專屬的錯誤重試策略？（待討論）
- [ ] 狀態恢復是否需要支援跨 session？（待討論）
