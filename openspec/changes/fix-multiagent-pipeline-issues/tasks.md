## 1. P0 - JSON 解析增強

- [ ] 1.1 啟用 AI JSON Mode + 模型能力偵測
  - 建立 `MODEL_CAPABILITIES` 常數表（記錄各模型是否支援 jsonMode、structuredOutput）
  - 修改 `src/lib/ai/ai-client.ts` 支援 `response_format: { type: "json_object" }`
  - 對 `generateTitleOptions()`、`generateOutline()` 等需要 JSON 的方法啟用
  - 模型不支援 JSON mode 時，自動 fallback 到解析策略
- [ ] 1.2 實作結構化 JSON 提取（語言無關）
  - 移除 `THINKING_PATTERNS` 中的語言相依模式
  - 實作 `extractJSONStructurally()` 方法：找到第一個 `{` 或 `[` 的位置
  - 實作 `extractBalancedJSON()` 方法：使用括號平衡演算法提取完整 JSON
  - 解析優先順序：直接解析 → Markdown 移除 → 結構化提取 → 正則提取
- [ ] 1.3 更新所有 Agent 統一使用 `AIResponseParser` + Zod 驗證
  - 定義各 Agent 的輸出 Schema（TitleOptionsSchema, OutlineSchema 等）
  - `strategy-agent.ts` 移除獨立的 cleanContent，改用 `AIResponseParser.parse(content, schema)`
  - `content-plan-agent.ts` 移除獨立的 cleanContent，改用 `AIResponseParser.parse(content, schema)`
  - `unified-strategy-agent.ts` 移除獨立的 cleanContent，改用 `AIResponseParser.parse(content, schema)`
  - 解析後使用 Zod 驗證結構完整性
- [ ] 1.4 強化 Prompt 輸出約束（學習 N8N）
  - 加入「直接以 { 開頭，最後一個字符必須是 }」
  - 加入「禁止邊界標記：```json、---、===等」
  - 加入「內容前後不得有額外文字」
- [ ] 1.5 增加 Fallback Root Cause Tracking
  - 記錄原始回應前 200 字元
  - 記錄使用的模型 ID
  - 記錄失敗的解析策略（直接解析、markdown 移除、結構化提取、正則提取）
  - 整合到 PipelineLogger
- [ ] 1.6 實作解析失敗重試機制
  - 第一次解析失敗後，使用更嚴格的 prompt 重試一次
  - 重試 prompt 加入：「⚠️ 只輸出 JSON，第一個字符必須是 { 或 [，禁止任何解釋」
  - 記錄重試次數和結果至日誌

## 2. P0 - 代碼執行層（學習 N8N Code 節點）

### 2.1 內容類型選擇器（純代碼，不依賴 AI）

- [ ] 2.1.1 建立 `src/lib/utils/content-type-selector.ts`
- [ ] 2.1.2 定義內容類型常數（參考 N8N）：
  ```typescript
  const CONTENT_TYPES = [
    {
      type: "教學攻略",
      style: "step-by-step詳細教學",
      structure: "問題分析 → 解決步驟 → 實用技巧 → 常見問題",
    },
    {
      type: "推薦清單",
      style: "精選推薦列表，包含評比",
      structure: "推薦標準 → 詳細清單 → 比較分析 → 選擇建議",
    },
    {
      type: "比較分析",
      style: "深度比較不同選項",
      structure: "比較維度 → 詳細對比 → 優缺點分析 → 選擇建議",
    },
    {
      type: "新聞趨勢",
      style: "最新趨勢分析",
      structure: "趨勢背景 → 現況分析 → 影響評估 → 未來預測",
    },
    {
      type: "How-to指南",
      style: "實用操作指南",
      structure: "問題定義 → 準備工作 → 操作步驟 → 結果驗證",
    },
  ];
  ```
- [ ] 2.1.3 實作 `selectContentType(userType?: string)` 方法（用戶指定優先，否則隨機）
- [ ] 2.1.4 整合到 orchestrator 的 research 階段

### 2.2 SERP 數據分析器（純代碼計算）

- [ ] 2.2.1 建立 `src/lib/utils/serp-analyzer.ts`
- [ ] 2.2.2 實作 `calculateCompetitionLevel(serpResults)` 方法：
  - 定義權威網站清單：wikipedia、facebook、youtube、shopee、momo 等
  - 計算前 10 名中權威網站數量
  - 返回競爭程度：極高(>=7) / 高(>=5) / 中(>=3) / 低
- [ ] 2.2.3 實作 `identifyContentGaps(titles)` 方法：
  - 統計內容類型分佈（tutorial, review, comparison, news, product）
  - 識別缺失的內容類型
- [ ] 2.2.4 實作 `extractRelatedQueries(serpData)` 方法
- [ ] 2.2.5 整合到 ResearchAgent

### 2.3 Slug 驗證器（純代碼處理）

- [ ] 2.3.1 建立 `src/lib/utils/slug-validator.ts`
- [ ] 2.3.2 實作 `validateAndAdjustSlug(slug)` 方法（參考 N8N）：
  - 移除引號和多餘空格
  - 如果太短（<15字），智能添加後綴（guide, tips, best）
  - 如果太長（>30字），智能截斷到最後一個連字符
- [ ] 2.3.3 定義後綴映射表：
  ```typescript
  const SUFFIX_MAP = {
    interior: ["design", "tips", "ideas"],
    food: ["guide", "spots", "best"],
    travel: ["guide", "tips", "plan"],
    // ...
  };
  ```
- [ ] 2.3.4 整合到 MetaAgent

### 2.4 分類標籤整合器（AI 輸出後處理）

- [ ] 2.4.1 建立 `src/lib/utils/category-tag-integrator.ts`
- [ ] 2.4.2 實作 `integrateCategorySelection(aiResult)` 方法：
  - 處理 AI 返回的分類選擇
  - 提取 ID 陣列
  - 處理預設分類（ID=1）fallback
- [ ] 2.4.3 實作 `integrateTagSelection(aiResult)` 方法
- [ ] 2.4.4 整合到 CategoryAgent

## 3. P0 - selectedTitle 生成邏輯

- [ ] 3.1 修改 `getFallbackTitles()` 使用更有創意的標題模板（非直接套用關鍵字）
- [ ] 3.2 增加日誌記錄 fallback 使用次數，方便追蹤問題根因
- [ ] 3.3 驗證：生成文章，確認標題非「${keyword}完整解析」等模板

## 4. P0 - 精選圖片 prompt 修復

- [ ] 4.1 修改 `src/lib/agents/featured-image-agent.ts` 的 `FeaturedImageInput` 介面
  - 新增 `selectedTitle?: string` 欄位
- [ ] 4.2 修改 `buildPrompt()` 優先使用 `input.selectedTitle`，其次使用 `input.title`
- [ ] 4.3 修改 `src/lib/agents/orchestrator.ts` 的 `executeImageAgent()`
  - 傳遞 `selectedTitle` 給 FeaturedImageAgent
- [ ] 4.4 驗證：確認精選圖片 prompt 使用的是最終標題

## 5. P1 - Industry 欄位邏輯

- [ ] 5.1 修改 `src/app/(dashboard)/dashboard/articles/components/ArticleForm.tsx`
  - 選擇網站時，若網站有設定 industry，自動帶入下拉選單
  - 用戶可手動更改（UI 值優先）
- [ ] 5.2 修改 `src/lib/agents/orchestrator.ts`
  - 優先使用 `input.industry`（來自 UI）
  - 其次使用 `websiteSettings.industry`
  - 最後為空值
- [ ] 5.3 驗證：確認 industry 邏輯正確

## 6. P1 - OutputAdapter HTML Validation 增強

- [ ] 6.1 修改 `src/lib/agents/output-adapter.ts` 的 `validateHTML()` 方法
  - 增加 `typeof html !== 'string'` 檢測
  - 增加 `html === null || html === undefined` 檢測
  - 增加 Promise 檢測：`html instanceof Promise` 或 `html?.then`
  - 增加空字串檢測：`html.trim() === ''`
  - 增加 JSON 物件殘留檢測：`html.startsWith('{')` 或 `html.startsWith('[')`
- [ ] 6.2 修改 `adapt()` 方法
  - 當 `assemblerOutput.html` 不是字串時，嘗試：
    1. 如果是 Promise，await 它（修復 `[object Promise]` 問題）
    2. 如果是物件且有 `html` 屬性，提取該屬性
    3. 從 `markdown` 重新轉換
    4. 使用 fallback HTML
- [ ] 6.3 追查 Promise 來源
  - 在 orchestrator 中找出哪個階段傳遞了未 await 的 Promise
  - 確保所有 async 函式呼叫都正確 await
- [ ] 6.4 驗證：確認無「html is not a string」和「[object Promise]」錯誤

## 7. P2 - 移除 tokenUsage 警告

- [ ] 7.1 修改 `src/lib/agents/orchestrator.ts` 的 `calculateTotalTokenUsage()` 方法
  - 對於 ImageAgent 等無 tokenUsage 的 phase，不輸出警告
  - 使用 DEBUG 級別日誌或完全跳過
- [ ] 7.2 確認只有在 DEBUG 模式下才輸出「沒有 tokenUsage 屬性」訊息
- [ ] 7.3 驗證：確認正常運行時無多餘警告

## 8. P2 - 品牌聲音配置（學習 N8N 的 Set 節點）

- [ ] 8.1 確認 `websiteSettings` 包含完整的品牌聲音欄位：
  - `brandName` 品牌名稱
  - `tone` 語調
  - `vocabulary` 用詞
  - `sentenceStyle` 句式
  - `interactivity` 互動性
- [ ] 8.2 在 StrategyAgent 和 WritingAgent 的 prompt 中整合品牌聲音配置
- [ ] 8.3 驗證：確認生成的文章符合品牌聲音

## 9. 最終驗證

- [ ] 9.1 執行 `pnpm run build` 確保無編譯錯誤
- [ ] 9.2 執行 `pnpm run typecheck` 確保無型別錯誤
- [ ] 9.3 手動觸發文章生成，觀察 GitHub Actions logs
- [ ] 9.4 確認所有問題已修復：
  - [ ] 無 JSON 解析錯誤（"Unexpected token" / "is not valid JSON"）
  - [ ] 標題由 AI 生成（非 fallback 模板）
  - [ ] 精選圖片 prompt 使用 selectedTitle
  - [ ] industry 從 UI 正確傳遞
  - [ ] 無「html is not a string」錯誤
  - [ ] 無多餘 tokenUsage 警告
  - [ ] Slug 長度在 15-30 字元之間
  - [ ] 內容類型正確選擇
