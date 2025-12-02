# Tasks: enhance-article-generation-pipeline

## Phase 1: ResearchAgent Perplexity 深度整合 ✅

### 1.1 更新類型定義

- [x] 在 `src/types/agents.ts` 新增 `DeepResearchResult` 介面
- [x] 在 `ResearchOutput` 介面新增 `deepResearch?: DeepResearchResult` 欄位

### 1.2 實作深度研究方法

- [x] 在 `src/lib/agents/research-agent.ts` 新增 `performDeepResearch()` 方法
- [x] 實作趨勢查詢：`{keyword} {region} 2024 2025 最新趨勢 專家見解`
- [x] 實作問題查詢：`{keyword} 常見問題 解決方案 FAQ 用戶體驗`
- [x] 實作數據查詢：`{keyword} {region} 官方來源 權威數據 統計資料`
- [x] 使用 `Promise.all` 並行執行三個查詢
- [x] 實作 `executeDeepResearchQuery()` 解析 Perplexity 回應

### 1.3 整合到 process 方法

- [x] 在 `ResearchAgent.process()` 中調用 `performDeepResearch()`
- [x] 將 `deepResearch` 加入 `ResearchOutput` 返回值
- [x] 實作錯誤處理：查詢失敗時設為 undefined 並繼續流程

### 1.4 驗證

- [x] 建置成功

---

## Phase 2: StrategyAgent 標題優化（純 SEO 導向）✅

### 2.1 修改標題生成 Prompt

- [x] 更新 `src/lib/agents/strategy-agent.ts` 的 `generateTitleOptions()` 方法
- [x] 移除品牌聲音區塊（品牌聲音只影響內文，不影響標題）
- [x] 加入禁止使用清單（泛用模板詞、年份）
- [x] 根據語系調整標題長度要求（`getTitleLengthRange()`）

### 2.2 純 SEO 評分（100分滿分）

- [x] 移除 `scoreBrandConsistency()` 方法（品牌一致性不影響標題）
- [x] 移除 `buildBrandVoicePromptSection()` 方法
- [x] 移除 `extractToneKeywords()`, `scoreStyleMatch()` 輔助方法
- [x] 修改 `scoreTitleSEO()` 為純 SEO 評分：
  - 關鍵字匹配：35分
  - 標題長度：25分
  - Power Words：20分
  - 數字使用：20分

### 2.3 調整 Temperature

- [x] 將 `generateTitleOptions()` 的預設 temperature 從 0.3 改為 0.6

### 2.4 驗證

- [x] 建置成功

---

## Phase 3: 新增 ContentPlanAgent ✅

### 3.1 類型定義

- [x] 在 `src/types/agents.ts` 新增 `ContentPlanInput` 介面
- [x] 新增 `ContentPlanOutput` 介面
- [x] 新增 `SpecialBlock` 介面（expert_tip, local_advantage, expert_warning）
- [x] 新增 `SectionPlan`, `FAQPlan` 等子類型

### 3.2 實作 ContentPlanAgent

- [x] 創建 `src/lib/agents/content-plan-agent.ts`
- [x] 繼承 `BaseAgent<ContentPlanInput, ContentPlanOutput>`
- [x] 實作 `get agentName()` 返回 "ContentPlanAgent"
- [x] 實作 `process()` 方法

### 3.3 Prompt 設計

- [x] 實作 `buildPrompt()` 方法
- [x] 整合 StrategyOutput（標題、大綱）
- [x] 整合 ResearchOutput（搜尋意圖、內容缺口、deepResearch）
- [x] 整合 CompetitorAnalysisOutput（缺失角度、內容推薦）
- [x] 整合 BrandVoice（品牌名稱、語調、目標讀者）
- [x] 實作 `determineSpecialBlockType()` 特殊區塊選擇邏輯

### 3.4 回應解析

- [x] 實作 `parseResponse()` 方法
- [x] 處理 JSON 解析錯誤
- [x] 實作 `buildFallbackContentPlan()` 作為 fallback

### 3.5 驗證

- [x] 建置成功

---

## Phase 4: 更新寫作 Agents ✅

### 4.1 類型定義

- [x] 在 `src/types/agents.ts` 新增 `ContentContext` 介面
- [x] 修改 `SectionInput` 加入 `contentContext?: ContentContext`
- [x] 修改 `SectionInput` 加入 `specialBlock?: SpecialBlock`
- [x] 修改 `IntroductionInput` 加入 `contentContext`
- [x] 修改 `ConclusionInput` 加入 `contentContext`
- [x] 修改 `QAInput` 加入 `contentContext`

### 4.2 更新 SectionAgent

- [x] 修改 `src/lib/agents/section-agent.ts`
- [x] 新增 `buildTopicAlignmentSection()` 方法
- [x] 新增 `buildSpecialBlockSection()` 方法
- [x] 在 prompt 開頭加入主題對齊約束
- [x] 加入特殊區塊渲染邏輯

### 4.3 更新 IntroductionAgent

- [x] 修改 `src/lib/agents/introduction-agent.ts`
- [x] 新增 `buildTopicAlignmentSection()` 方法
- [x] 在 prompt 加入主題對齊約束

### 4.4 更新 ConclusionAgent

- [x] 修改 `src/lib/agents/conclusion-agent.ts`
- [x] 新增 `buildTopicAlignmentSection()` 方法
- [x] 在 prompt 加入主題對齊約束

### 4.5 更新 QAAgent

- [x] 修改 `src/lib/agents/qa-agent.ts`
- [x] 新增 `buildTopicAlignmentSection()` 方法
- [x] 在 prompt 加入主題對齊約束

### 4.6 驗證

- [x] 建置成功

---

## Phase 5: 更新 Orchestrator ✅

### 5.1 導入 ContentPlanAgent

- [x] 在 `src/lib/agents/orchestrator.ts` 導入 ContentPlanAgent
- [x] 導入 `ContentPlanOutput`, `ContentContext` 類型

### 5.2 整合 ContentPlanAgent 調用

- [x] 在 CompetitorAnalysisAgent 之後新增 ContentPlanAgent 調用（階段 2.6）
- [x] 傳遞正確的輸入參數
- [x] 處理 ContentPlanAgent 執行錯誤並使用 fallback ContentContext

### 5.3 構建 ContentContext

- [x] 在 ContentPlanAgent 成功後構建 ContentContext
- [x] 從各個輸出中提取所需資料（primaryKeyword, selectedTitle, searchIntent 等）

### 5.4 更新寫作階段調用

- [x] 修改 `executeContentGeneration()` 簽名加入 `contentContext`, `contentPlan` 參數
- [x] 傳遞 contentContext 給 IntroductionAgent
- [x] 傳遞 contentContext 給 ConclusionAgent
- [x] 傳遞 contentContext 給 QAAgent
- [x] 傳遞 contentContext 和 specialBlock 給 SectionAgent

### 5.5 向後兼容

- [x] 確保 deepResearch 不存在時流程正常
- [x] 確保 ContentPlanAgent 失敗時使用 fallback ContentContext
- [x] 確保 competitorAnalysis 可選

### 5.6 驗證

- [x] `pnpm run build` 成功

---

## Phase 6: 最終驗證 ✅

### 6.1 TypeScript 編譯

- [x] 執行 `pnpm run build` 確認無類型錯誤

---

## 實作摘要

### 修改的檔案

1. **`src/types/agents.ts`**
   - 新增 `DeepResearchResult`, `ContentContext`, `SpecialBlock` 介面
   - 新增 `ContentPlanInput`, `ContentPlanOutput`, `SectionPlan`, `FAQPlan` 等
   - 修改 `ResearchOutput` 加入 `deepResearch`
   - 修改 `IntroductionInput`, `SectionInput`, `ConclusionInput`, `QAInput` 加入 `contentContext`
   - 修改 `SectionInput` 加入 `specialBlock`

2. **`src/lib/agents/research-agent.ts`**
   - 新增 `performDeepResearch()` 方法（3 個並行 Perplexity 查詢）
   - 新增 `executeDeepResearchQuery()` 輔助方法

3. **`src/lib/agents/strategy-agent.ts`**
   - 新增 `getTitleLengthRange()` 方法
   - 修改 `scoreTitleSEO()` 為純 SEO 評分（100分滿分）
   - 移除品牌聲音相關方法（品牌聲音只影響內文）
   - 修改 temperature 從 0.3 到 0.6

4. **`src/lib/agents/content-plan-agent.ts`** [新增]
   - 完整實作 ContentPlanAgent
   - `buildPrompt()`, `buildDeepResearchSection()`, `determineSpecialBlockType()`
   - `parseResponse()`, `buildFallbackContentPlan()`, `validateContentPlan()`

5. **`src/lib/agents/section-agent.ts`**
   - 新增 `buildTopicAlignmentSection()` 方法
   - 新增 `buildSpecialBlockSection()` 方法

6. **`src/lib/agents/introduction-agent.ts`**
   - 新增 `buildTopicAlignmentSection()` 方法

7. **`src/lib/agents/conclusion-agent.ts`**
   - 新增 `buildTopicAlignmentSection()` 方法

8. **`src/lib/agents/qa-agent.ts`**
   - 新增 `buildTopicAlignmentSection()` 方法

9. **`src/lib/agents/orchestrator.ts`**
   - 導入 ContentPlanAgent, ContentPlanOutput, ContentContext
   - 新增階段 2.6: ContentPlanAgent 調用
   - 修改 `executeContentGeneration()` 傳遞 contentContext 和 contentPlan
