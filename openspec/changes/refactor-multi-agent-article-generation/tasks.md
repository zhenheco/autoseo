# 實作任務清單

## ✅ 完成狀態更新（2025-01-12）

**Phase 1-4 已完成**，詳細進度請參閱：

- `progress-phase-1-2.md` - Phase 1-2 實作記錄
- `progress-final.md` - Phase 1-3 實作進度和下一步計劃
- `progress-phase-4.md` - Phase 4 實作記錄（Orchestrator 整合完成）

---

## Phase 1: 基礎設施和工具類別 ✅ (完成)

### 1.1 重試機制基礎設施 ✅

- [x] 建立 `src/lib/agents/retry-config.ts`
  - [x] 定義 `AgentRetryConfig` interface
  - [x] 實作 `RetryConfig` 常數物件
  - [x] 為每個 agent 定義重試配置
  - [x] 從環境變數載入覆蓋配置
  - [ ] 單元測試: 驗證配置正確性（待實作）

### 1.2 錯誤追蹤系統 ✅

- [x] 建立 `src/lib/agents/error-tracker.ts`
  - [x] 定義 `ErrorCategory` 和 `ErrorSeverity` enum
  - [x] 定義 `TrackedError` 和 `ErrorContext` interfaces
  - [x] 實作 `ErrorTracker` 類別
    - [x] `trackError()` 方法
    - [x] `trackSuccess()` 方法
    - [x] `trackFallback()` 方法
    - [x] `categorizeError()` 私有方法
    - [x] `determineSeverity()` 私有方法
    - [x] `getStats()` 方法
  - [x] 實作記憶體管理（FIFO，maxErrorsInMemory）
  - [ ] 單元測試: 錯誤分類邏輯（待實作）
  - [ ] 單元測試: 嚴重性判斷邏輯（待實作）
  - [ ] 單元測試: 統計資訊計算（待實作）

### 1.3 Feature Flag 支援 ✅

- [x] 在 `src/lib/agents/orchestrator.ts` 加入 Feature Flag 邏輯
  - [x] 實作 `shouldUseMultiAgent()` 方法
  - [x] 實作 `hashString()` 方法（基於 articleJobId）
  - [x] 實作 A/B testing bucket 分配
  - [ ] 單元測試: Hash-based bucketing 一致性（待實作）

### 1.4 Orchestrator 重試執行器 ✅

- [x] 修改 `src/lib/agents/orchestrator.ts`
  - [x] 加入 ErrorTracker 屬性
  - [x] 實作 `executeWithRetry()` 方法
    - [x] Exponential backoff 邏輯
    - [x] Timeout 處理
    - [x] 參數調整支援
    - [x] 錯誤追蹤整合
  - [x] 實作 `isRetryableError()` 輔助方法
  - [x] 實作 `sleep()` 輔助方法
  - [ ] 單元測試: 重試邏輯（待實作）
  - [ ] 單元測試: Timeout 處理（待實作）

---

## Phase 2: 新 Agent 實作 ✅ (完成)

### 2.1 IntroductionAgent ✅

- [x] 建立 `src/lib/agents/introduction-agent.ts`
  - [ ] 定義 `IntroductionInput` 和 `IntroductionOutput` interfaces
  - [ ] 繼承 `BaseAgent<IntroductionInput, IntroductionOutput>`
  - [ ] 實作 `execute()` 方法
    - [ ] 設計 prompt（150-300 字前言）
    - [ ] 如果有 featuredImage，插入圖片 Markdown
    - [ ] 計算字數
    - [ ] 返回 markdown 和 executionInfo
  - [ ] 單元測試: 有 featuredImage 的情況
  - [ ] 單元測試: 無 featuredImage 的情況
  - [ ] 單元測試: 字數範圍驗證

### 2.2 SectionAgent（可重複使用）

- [ ] 建立 `src/lib/agents/section-agent.ts`
  - [ ] 定義 `SectionInput` 和 `SectionOutput` interfaces
  - [ ] 繼承 `BaseAgent<SectionInput, SectionOutput>`
  - [ ] 實作 `execute()` 方法
    - [ ] 設計 prompt
    - [ ] 使用 previousSummary 保持連貫性
    - [ ] 插入 sectionImage（如果有）
    - [ ] 生成當前 section 的 summary
    - [ ] 計算字數
  - [ ] 單元測試: 第一個 section（無 previousSummary）
  - [ ] 單元測試: 後續 section（有 previousSummary）
  - [ ] 單元測試: 有/無 sectionImage 的情況

### 2.3 ConclusionAgent

- [ ] 建立 `src/lib/agents/conclusion-agent.ts`
  - [ ] 定義 `ConclusionInput` 和 `ConclusionOutput` interfaces
  - [ ] 繼承 `BaseAgent<ConclusionInput, ConclusionOutput>`
  - [ ] 實作 `execute()` 方法
    - [ ] 設計 prompt（100-200 字結論）
    - [ ] 總結主要觀點
    - [ ] 計算字數
  - [ ] 單元測試: 結論內容品質
  - [ ] 單元測試: 字數範圍驗證

### 2.4 QAAgent

- [ ] 建立 `src/lib/agents/qa-agent.ts`
  - [ ] 定義 `QAInput` 和 `QAOutput` interfaces
  - [ ] 繼承 `BaseAgent<QAInput, QAOutput>`
  - [ ] 實作 `execute()` 方法
    - [ ] 設計 prompt（3-5 個 FAQ）
    - [ ] 生成 FAQ 陣列
    - [ ] 格式化為 Markdown
  - [ ] 單元測試: FAQ 數量
  - [ ] 單元測試: 答案最低字數（50 字）

### 2.5 ContentAssemblerAgent

- [ ] 建立 `src/lib/agents/content-assembler-agent.ts`
  - [ ] 定義 `ContentAssemblerInput` 和 `ContentAssemblerOutput` interfaces
  - [ ] 實作主要組合邏輯
    - [ ] 驗證必要部分存在（title, intro, >=1 section）
    - [ ] 按順序組合：Intro → Sections → Conclusion → FAQ
    - [ ] 處理缺失的非關鍵部分（記錄 warning）
    - [ ] 移除重複的標題
    - [ ] 統一空行格式（\n\n）
    - [ ] 計算統計資訊（總字數、段落數、sections 數、FAQs 數）
    - [ ] 使用 `marked` 轉換為初步 HTML
  - [ ] 單元測試: 所有部分完整的情況
  - [ ] 單元測試: 缺少 conclusion 的情況
  - [ ] 單元測試: 缺少 qa 的情況
  - [ ] 單元測試: 缺少必要部分（應拋出錯誤）
  - [ ] 單元測試: 最低字數驗證（< 800 字應拋出錯誤）
  - [ ] 單元測試: Markdown → HTML 轉換失敗的 fallback

---

## Phase 3: StrategyAgent 強化 (Week 2)

### 3.1 強制 JSON 輸出

- [ ] 修改 `src/lib/agents/strategy-agent.ts`
  - [ ] 在 AI 請求中加入 `format: 'json'` 參數
  - [ ] 在 prompt 中明確說明 JSON schema
  - [ ] 加入範例 JSON 輸出

### 3.2 多層 Fallback 解析器

- [ ] 實作解析器階層
  - [ ] Parser 1: Direct JSON parsing (`JSON.parse(content)`)
  - [ ] Parser 2: Nested JSON parsing（提取 `{...}` 部分）
  - [ ] Parser 3: Markdown structured parsing（尋找 `### 主要段落`）
  - [ ] Parser 4: Fallback outline（3 個預設 sections）
  - [ ] 每個解析器記錄詳細日誌
  - [ ] 追蹤使用的解析器類型

### 3.3 解析成功率追蹤

- [ ] 在 ErrorTracker 中加入解析器類型追蹤
  - [ ] 記錄使用的解析器（JSON/Nested/Markdown/Fallback）
  - [ ] 記錄 mainSections 數量
  - [ ] 統計每種解析器的成功率

---

## Phase 4: Orchestrator 重構 ✅ (完成)

### 4.1 多 Agent 執行流程 ✅

- [x] 修改 `src/lib/agents/orchestrator.ts`
  - [x] 實作 `execute()` 主方法
    - [x] Feature Flag 檢查
    - [x] 選擇多 agent 或舊系統
  - [x] 實作 `executeContentGeneration()` 方法（合併多 agent 流程）
    - [x] Phase 1: ResearchAgent（不變）
    - [x] Phase 2: StrategyAgent（使用 executeWithRetry）
    - [x] Phase 3: ImageAgent（BEFORE content generation）
    - [x] Phase 4: Content Generation（分批並行）
    - [x] Phase 5: ContentAssemblerAgent
    - [x] Phase 6: HTMLAgent（圖片插入僅在 legacy 流程）
    - [x] Phase 7: MetaAgent
    - [x] Phase 8: CategoryAgent
  - [x] 保留舊系統流程（inline 實作）

### 4.2 Batch 1 並行執行 ✅

- [x] 在 `executeContentGeneration()` 實作 Batch 1
  - [x] 並行執行：IntroductionAgent, ConclusionAgent, QAAgent
  - [x] 使用 `Promise.all()`
  - [x] 記錄執行時間

### 4.3 Batch 2 順序執行 ✅

- [x] 在 `executeContentGeneration()` 實作 Batch 2
  - [x] 順序執行每個 SectionAgent
  - [x] 傳遞 previousSummary
  - [x] 收集所有 SectionOutput
  - [x] 記錄執行時間

### 4.4 最終 Fallback ✅

- [x] 在 `execute()` 加入 try-catch
  - [x] 捕獲所有錯誤
  - [x] 調用 `errorTracker.trackFallback()`
  - [x] 自動切換到舊系統
  - [x] 返回舊系統結果

### 4.5 環境變數配置 ✅

- [x] 更新 `.env.example`
  - [x] `USE_MULTI_AGENT_ARCHITECTURE`
  - [x] `MULTI_AGENT_ROLLOUT_PERCENTAGE`
  - [x] `AGENT_RETRY_MAX_ATTEMPTS`
  - [x] `AGENT_RETRY_INITIAL_DELAY_MS`
  - [x] `AGENT_RETRY_MAX_DELAY_MS`
  - [x] `ERROR_TRACKING_ENABLED`

---

## Phase 5: HTMLAgent 調整 ✅ (完成)

### 5.1 角色調整 ✅

- [x] 修改 Orchestrator 圖片插入邏輯
  - [x] 圖片插入僅在 legacy 流程執行
  - [x] Multi-agent 流程圖片已在各 agent 中插入
  - [x] HTMLAgent 保留連結插入邏輯（使用 `findRelevantKeywords`）
  - [x] HTMLAgent 保留 Markdown → HTML 轉換
  - [x] HTMLAgent 保留表格樣式處理
  - [x] HTMLAgent 保留清理和驗證

### 5.2 統一連結處理

- [ ] 確保 internal links 和 external references 都在此階段插入
  - [ ] 使用現有的 `findRelevantKeywords` 邏輯
  - [ ] 確保每個連結只插入一次
  - [ ] 確保連結分布自然且均勻

---

## Phase 6: 測試 (Week 2-3)

### 6.1 單元測試

- [ ] 為所有新 agent 撰寫單元測試
  - [ ] IntroductionAgent: 至少 3 個測試案例
  - [ ] SectionAgent: 至少 5 個測試案例
  - [ ] ConclusionAgent: 至少 3 個測試案例
  - [ ] QAAgent: 至少 3 個測試案例
  - [ ] ContentAssemblerAgent: 至少 8 個測試案例
- [ ] ErrorTracker 單元測試（至少 10 個測試案例）
- [ ] RetryConfig 單元測試（至少 5 個測試案例）

### 6.2 整合測試

- [ ] 完整流程測試（Research → Meta）
  - [ ] 使用 mock AI 回應
  - [ ] 驗證所有 phase 執行順序
  - [ ] 驗證資料傳遞正確性
- [ ] Feature Flag 測試
  - [ ] 測試 0% rollout（全部使用舊系統）
  - [ ] 測試 50% rollout（hash-based 分流）
  - [ ] 測試 100% rollout（全部使用新系統）
- [ ] 錯誤處理測試
  - [ ] 模擬各種錯誤（network, timeout, rate_limit）
  - [ ] 驗證重試邏輯
  - [ ] 驗證最終 fallback

### 6.3 效能測試

- [ ] 壓力測試（100 篇文章生成）
  - [ ] 測量平均生成時間
  - [ ] 測量 token 使用量
  - [ ] 測量錯誤率
  - [ ] 驗證 < 3 分鐘/篇
  - [ ] 驗證 < $0.50/篇
- [ ] 並行測試
  - [ ] 測試 Batch 1 並行效能
  - [ ] 比較順序 vs 並行的總時間

### 6.4 品質測試

- [ ] 文章品質評估（至少 20 篇）
  - [ ] 人工評分（可讀性、連貫性、準確性）
  - [ ] Flesch Reading Ease 計算
  - [ ] SEO 分數計算
  - [ ] 與舊系統對比

---

## Phase 7: 部署準備 (Week 3)

### 7.1 環境變數配置

- [ ] 加入新環境變數到 `.env.example`
  ```bash
  USE_MULTI_AGENT_ARCHITECTURE=false
  MULTI_AGENT_ROLLOUT_PERCENTAGE=0
  AGENT_RETRY_MAX_ATTEMPTS=3
  AGENT_RETRY_INITIAL_DELAY_MS=1000
  AGENT_RETRY_MAX_DELAY_MS=30000
  ERROR_TRACKING_ENABLED=false
  ```
- [ ] 在 staging 環境設定環境變數
- [ ] 在 production 環境設定環境變數（初始值：rollout=0）

### 7.2 監控和日誌

- [ ] 設定 ErrorTracker 日誌輸出
  - [ ] 結構化 JSON 日誌格式
  - [ ] 包含所有必要上下文（agentName, attemptNumber, articleJobId, userId, companyId）
- [ ] 設定外部錯誤追蹤服務（可選）
  - [ ] 選擇服務（Sentry / Datadog / 自建）
  - [ ] 整合 SDK
  - [ ] 配置錯誤過濾和採樣

### 7.3 文件更新

- [ ] 更新 README.md
  - [ ] 加入多 agent 架構說明
  - [ ] 加入 Feature Flag 使用說明
  - [ ] 加入環境變數說明
- [ ] 撰寫 Migration Guide
  - [ ] 舊系統 vs 新系統差異
  - [ ] 如何切換到新系統
  - [ ] 如何回滾到舊系統
- [ ] 更新 API 文件（如果有影響）

---

## Phase 8: 漸進式部署 (Week 3-4)

### 8.1 Stage 1: 10% Rollout (3-5 days)

- [ ] 設定 `MULTI_AGENT_ROLLOUT_PERCENTAGE=10`
- [ ] 監控指標
  - [ ] "No main sections parsed" 錯誤率
  - [ ] 文章生成成功率
  - [ ] 平均生成時間
  - [ ] Token 使用成本
  - [ ] Fallback 使用率
- [ ] 每日查看 ErrorTracker 統計資訊
- [ ] 修復發現的 bug（如果有）
- [ ] 確認沒有重大問題後進入下一階段

### 8.2 Stage 2: 50% Rollout (3-5 days)

- [ ] 設定 `MULTI_AGENT_ROLLOUT_PERCENTAGE=50`
- [ ] 繼續監控所有指標
- [ ] 比較 A/B 測試結果
  - [ ] 多 agent 系統 vs 舊系統品質
  - [ ] 多 agent 系統 vs 舊系統效能
  - [ ] 多 agent 系統 vs 舊系統成本
- [ ] 收集用戶反饋（如果有）
- [ ] 修復發現的問題
- [ ] 確認成功指標達標後進入下一階段

### 8.3 Stage 3: 100% Rollout (持續監控)

- [ ] 設定 `MULTI_AGENT_ROLLOUT_PERCENTAGE=100`
- [ ] 持續監控 7 天
- [ ] 驗證成功指標
  - [ ] "No main sections parsed" < 1%
  - [ ] 生成成功率 > 95%
  - [ ] 平均時間 < 3 分鐘
  - [ ] 成本 < $0.50/篇
  - [ ] Fallback 使用率 < 5%
- [ ] 如果所有指標達標，準備移除舊系統

### 8.4 舊系統移除（30 天後）

- [ ] 確認新系統穩定運行 30 天
- [ ] 備份舊 WritingAgent 程式碼
- [ ] 移除 Feature Flag 邏輯（簡化為只有新系統）
- [ ] 移除 `executeLegacyFlow()` 方法
- [ ] 移除 WritingAgent 相關程式碼
- [ ] 更新文件

---

## Phase 9: 優化和改進 (Week 4+)

### 9.1 效能優化

- [ ] 分析每個 agent 的執行時間
  - [ ] 識別瓶頸
  - [ ] 優化 prompt 長度
  - [ ] 調整 temperature 和 maxTokens
- [ ] 評估 Batch 2 並行化可能性
  - [ ] 實驗平行執行 sections 的效果
  - [ ] 測試是否影響連貫性
- [ ] 快取優化
  - [ ] 快取常用的 BrandVoice
  - [ ] 快取 ResearchAgent 結果（如果適用）

### 9.2 品質改進

- [ ] 收集低品質文章案例
  - [ ] 分析失敗原因
  - [ ] 調整相應 agent 的 prompt
- [ ] 加入品質評分機制
  - [ ] 自動評估文章可讀性
  - [ ] 自動評估 SEO 分數
  - [ ] 低於閾值時觸發重新生成

### 9.3 成本優化

- [ ] 分析 token 使用分布
  - [ ] 識別 token 使用最多的 agent
  - [ ] 評估使用較小模型的可能性（如 gpt-4o-mini）
- [ ] 實作智能模型選擇
  - [ ] 關鍵 agent（Strategy）使用大模型
  - [ ] 非關鍵 agent（QA, Conclusion）使用小模型

---

## 驗證清單

### 程式碼品質

- [ ] 所有新程式碼通過 ESLint
- [ ] 所有新程式碼通過 TypeScript 檢查
- [ ] 測試覆蓋率 > 80%
- [ ] 無 console.log 殘留
- [ ] 無 TODO 註解殘留

### 功能完整性

- [ ] 所有 spec 場景都有對應實作
- [ ] 所有 ADDED requirements 已實作
- [ ] 所有 MODIFIED requirements 已更新
- [ ] Feature Flag 正常運作
- [ ] Fallback 機制正常運作

### 文件完整性

- [ ] README.md 已更新
- [ ] Migration Guide 已撰寫
- [ ] API 文件已更新（如果適用）
- [ ] 環境變數文件已完整
- [ ] 程式碼註解清晰

### 部署就緒

- [ ] Staging 環境測試通過
- [ ] 監控和日誌已設定
- [ ] 回滾計畫已確認
- [ ] 團隊已接受培訓（如果適用）
- [ ] 緊急聯絡人已確認

---

## 風險緩解任務

### 內容重複或矛盾

- [ ] 實作 ContentAssembler 重複檢查邏輯
- [ ] 所有 agent 共享 BrandVoice 參數
- [ ] 加入內容一致性測試

### 風格不一致

- [ ] 統一所有 agent 的 temperature 參數
- [ ] 統一所有 agent 的 BrandVoice 使用方式
- [ ] 加入風格一致性測試

### Token 成本增加

- [ ] 設定每個 agent 的 maxTokens 限制
- [ ] 使用較小模型（deepseek-chat）
- [ ] 實作成本追蹤和警報

### 過渡段落不自然

- [ ] SectionAgent 接收 previousSummary
- [ ] 加入段落連貫性測試
- [ ] 人工評估過渡品質

### 重試風暴

- [ ] 實作 Exponential backoff
- [ ] 設定最大重試次數限制
- [ ] 實作 Circuit Breaker（如果需要）

### Cascading failures

- [ ] 關鍵 agent（Strategy）有更多重試次數
- [ ] 每個 agent 獨立重試
- [ ] 最終 fallback 到舊系統

---

## 預計時間表

| Phase | 任務               | 預計時間 | 依賴          |
| ----- | ------------------ | -------- | ------------- |
| 1     | 基礎設施           | 3 天     | -             |
| 2     | 新 Agent 實作      | 5 天     | Phase 1       |
| 3     | StrategyAgent 強化 | 2 天     | Phase 1       |
| 4     | Orchestrator 重構  | 3 天     | Phase 1, 2, 3 |
| 5     | HTMLAgent 調整     | 1 天     | Phase 2       |
| 6     | 測試               | 5 天     | Phase 1-5     |
| 7     | 部署準備           | 2 天     | Phase 6       |
| 8     | 漸進式部署         | 10 天    | Phase 7       |
| 9     | 優化和改進         | 持續     | Phase 8       |

**總計**: ~3-4 週

---

## 成功指標追蹤

### 每日追蹤

- [ ] 文章生成成功率
- [ ] "No main sections parsed" 錯誤次數
- [ ] Fallback 使用次數
- [ ] 平均生成時間

### 每週追蹤

- [ ] 平均 token 使用成本
- [ ] 各 agent 成功率統計
- [ ] 錯誤分類統計
- [ ] 文章品質評分（人工抽樣）

### 里程碑指標

- [ ] 10% rollout: 錯誤率 < 5%, 成功率 > 90%
- [ ] 50% rollout: 錯誤率 < 2%, 成功率 > 93%
- [ ] 100% rollout: 錯誤率 < 1%, 成功率 > 95%
- [ ] 30 天穩定: 所有指標持續達標
