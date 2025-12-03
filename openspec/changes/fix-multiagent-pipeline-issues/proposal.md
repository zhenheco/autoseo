## Why

文章生成的 multi-agent pipeline 存在多個嚴重問題，導致：

1. **JSON 解析失敗**：DeepSeek 返回思考過程（"首先，用户要求我只输..."）而非純 JSON，導致 `SyntaxError: Unexpected token`
2. **selectedTitle 直接使用關鍵字**：fallback 標題品質差，直接套用「${keyword}完整解析」等模板
3. **industry 欄位邏輯錯誤**：應以 UI 下拉式選單為主，網站設定只是預設值
4. **精選圖片 prompt 未使用 selectedTitle**：`buildPrompt()` 使用 `input.title`（原始關鍵字）而非最終選定的標題
5. **OutputAdapter HTML validation 失敗**：`html` 欄位可能是物件而非字串，導致 `Validation failed: html is not a string { type: 'object' }`
6. **HTML 顯示 `[object Promise]`**：某處傳遞了未 await 的 Promise，導致 HTML 編輯框顯示 `[object Promise]` 而非實際內容
7. **tokenUsage 警告過多**：ImageAgent 無 tokenUsage 屬性，產生 `executionInfo 中沒有 tokenUsage 屬性` 警告
8. **各 Agent JSON 解析邏輯重複**：`strategy-agent`、`content-plan-agent`、`unified-strategy-agent` 都有獨立的 `cleanContent` 邏輯，未統一使用 `AIResponseParser`

## What Changes

### P0 - 必須修復（核心穩定性）

- **啟用 AI JSON Mode + 模型能力偵測**：對需要 JSON 輸出的 API 呼叫啟用 `response_format: { type: "json_object" }`（參考 N8N 的 `jsonOutput: true`），建立 `MODEL_CAPABILITIES` 表記錄各模型支援情況
- **結構化 JSON 提取（語言無關）**：使用括號平衡演算法提取 JSON，不依賴語言特定的 pattern，確保多語系相容
- **統一 Agent JSON 解析 + Zod 驗證**：所有 Agent 改用 `AIResponseParser.parse(content, schema)`，使用 Zod 驗證結構完整性
- **強化 Prompt 輸出約束**：學習 N8N 的嚴格格式要求（「直接以 { 開頭」「最後一個字符必須是 }」「禁止邊界標記」）
- **解析失敗重試機制**：第一次解析失敗後，使用更嚴格的 prompt 重試一次
- **修復 selectedTitle 生成邏輯**：確保 AI 生成標題而非使用 fallback 模板
- **修復精選圖片 prompt**：`FeaturedImageAgent.buildPrompt()` 應使用 `selectedTitle` 而非 `input.title`（N8N 使用 `Title1.output`）

### P0 - 代碼執行層（學習 N8N Code 節點）

- **內容類型選擇器**：純代碼隨機選擇內容類型（教學攻略、推薦清單、比較分析等），不依賴 AI
- **SERP 數據分析器**：純代碼計算競爭程度、識別內容缺口、統計權威網站數量
- **Slug 驗證器**：純代碼驗證和調整 slug 長度（15-30 字元），智能截斷和後綴添加
- **分類標籤整合器**：處理 AI 輸出的分類/標籤選擇，確保格式正確

### P1 - 重要修復（邏輯正確性）

- **industry 欄位優先邏輯**：UI 下拉選單值 > 網站設定值 > 空值
- **OutputAdapter HTML validation 增強**：增加物件類型、Promise、空字串、JSON 殘留檢測
- **修復 `[object Promise]` 問題**：追查並修復未 await 的 Promise，確保所有 async 呼叫正確 await
- **HTML 重轉換邏輯**：當 html 不是字串時，嘗試從 markdown 重新轉換

### P2 - 優化（減少噪音 + 可觀測性）

- **移除 tokenUsage 警告**：ImageAgent 等無 tokenUsage 的 phase 不再輸出警告，改用 DEBUG 級別或完全跳過
- **增加 Fallback Root Cause Tracking**：記錄 fallback 觸發原因（原始回應、模型 ID、失敗策略）至 PipelineLogger

## 解決方案評估

### 方案 A：語言相依的 Pattern 匹配（不推薦）

在 `THINKING_PATTERNS` 增加中文、日文等語言的思考模式：

```typescript
/^(?:首先|好的|让我|我来)[\s\S]*?(?=\{|\[)/gim;
```

**優點**：實作簡單
**缺點**：需持續維護語言清單、不同模型有不同模式、維護負擔重

### 方案 B：結構化 JSON 提取（推薦）

使用括號平衡演算法提取 JSON，語言無關：

```typescript
// 找到第一個 { 或 [
const jsonStart = content.search(/[\{\[]/);
// 使用括號平衡演算法提取完整 JSON
return extractBalancedJSON(content.substring(jsonStart));
```

**優點**：語言無關、模型無關、無需維護 pattern 清單
**缺點**：需要處理 JSON 內的轉義字元

### 方案 C：AI JSON Mode + 模型能力偵測

建立模型能力表，支援的模型使用原生 JSON Mode：

```typescript
const MODEL_CAPABILITIES = {
  "deepseek-reasoner": { jsonMode: false, purpose: "reasoning" },
  "deepseek-chat": { jsonMode: true, purpose: "text-generation" },
  "gemini-2.5-flash-image": { jsonMode: false, purpose: "image-generation" },
  "gpt-image-1-mini": { jsonMode: false, purpose: "image-generation" },
  "gpt-5-mini": { jsonMode: true, purpose: "text-generation" },
  "perplexity-research": { jsonMode: false, purpose: "research" },
};
```

**優點**：根本性解決、最乾淨的輸出
**缺點**：需要維護模型能力表

## 建議

採用 **方案 B + 方案 C + Prompt 強化 + 重試機制**：

1. 建立 `MODEL_CAPABILITIES` 表，支援的模型優先使用 JSON Mode
2. 實作結構化 JSON 提取作為 fallback（語言無關）
3. 在 prompt 中明確要求 JSON 輸出格式
4. 解析失敗時用更嚴格的 prompt 重試一次
5. 使用 Zod 驗證解析結果的結構完整性
6. 增加 fallback 日誌以便追蹤問題根因

## Impact

- 受影響 specs: `article-generation`
- 受影響程式碼:
  - `src/lib/ai/ai-client.ts`（AI JSON Mode、MODEL_CAPABILITIES）
  - `src/lib/ai/json-parser.ts`（結構化 JSON 提取、Zod 驗證、重試機制）
  - `src/lib/agents/strategy-agent.ts`（統一使用 AIResponseParser、selectedTitle 邏輯）
  - `src/lib/agents/content-plan-agent.ts`（統一使用 AIResponseParser）
  - `src/lib/agents/unified-strategy-agent.ts`（統一使用 AIResponseParser）
  - `src/lib/agents/featured-image-agent.ts`（buildPrompt 使用 selectedTitle）
  - `src/lib/agents/output-adapter.ts`（HTML validation 增強）
  - `src/lib/agents/orchestrator.ts`（移除 tokenUsage 警告、industry 傳遞邏輯）
  - `src/app/(dashboard)/dashboard/articles/components/ArticleForm.tsx`（industry 下拉選單邏輯）
- 新增程式碼（代碼執行層）:
  - `src/lib/utils/content-type-selector.ts`（內容類型選擇器）
  - `src/lib/utils/serp-analyzer.ts`（SERP 數據分析器）
  - `src/lib/utils/slug-validator.ts`（Slug 驗證器）
  - `src/lib/utils/category-tag-integrator.ts`（分類標籤整合器）
