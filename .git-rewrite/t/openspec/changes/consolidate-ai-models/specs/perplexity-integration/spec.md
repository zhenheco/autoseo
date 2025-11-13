# Spec: Perplexity 搜尋整合

## ADDED Requirements

### Requirement: All research phases MUST use Perplexity uniformly

系統必須確保所有需要即時資料和研究的 Agent 都使用 Perplexity Sonar 作為唯一的搜尋來源。

#### Scenario: Research Agent 使用 Perplexity 進行 SERP 分析

**Given** Research Agent 執行關鍵字研究
**When** Agent 需要分析 SERP 和競爭對手
**Then** 應使用 `PerplexityClient.search()` 方法
**And** 查詢應包含：
- 關鍵字
- 目標地區（如有指定）
- 要求競爭對手分析
**And** 回應應包含：
- 搜尋結果內容
- 引用來源 (`citations`)
- 相關圖片（如有）

#### Scenario: Strategy Agent 使用 Perplexity 獲取趨勢

**Given** Strategy Agent 執行大綱規劃
**When** Agent 需要了解當前趨勢和熱門話題
**Then** 應使用 `PerplexityClient.getTrends()` 方法
**And** 指定時間範圍（day/week/month）
**And** 回應應包含：
- 趨勢主題列表
- 相關性分數
- 洞察建議

#### Scenario: Writing Agent 引用 Perplexity 來源

**Given** Writing Agent 生成文章內容
**When** 內容中需要引用外部資料
**Then** 應：
1. 使用 Research Agent 提供的 Perplexity 引用來源
2. 在文章中正確標註來源
3. 儲存引用連結到 `article_sources` 表

---

### Requirement: The system MUST extract and store Perplexity citations

系統必須正確擷取和儲存 Perplexity 回應中的引用來源，並顯示在文章中。

#### Scenario: 擷取 API 返回的 citations

**Given** Perplexity API 回應
**When** 回應包含 `citations` 欄位
**Then** 應：
1. 提取所有 URL
2. 驗證 URL 格式正確
3. 去除重複的 URL
4. 儲存到 Research Agent 的輸出

#### Scenario: 從內容中擷取額外引用

**Given** Perplexity 回應的 `content` 包含引用標記（如 `[1]: https://...`）
**When** 解析內容
**Then** 應：
1. 使用正則表達式提取 URL: `/\[(\d+)\]:\s*(https?:\/\/[^\s]+)/g`
2. 合併 API `citations` 和內容中的引用
3. 去除重複後儲存

#### Scenario: 儲存引用來源到資料庫

**Given** 文章生成完成並包含引用來源
**When** 儲存文章到資料庫
**Then** 應在 `generated_articles` 表中：
- `external_sources`: 儲存為 JSON 陣列
  ```json
  [
    {
      "url": "https://example.com/source1",
      "title": "Source Title",
      "accessed_at": "2025-01-01T00:00:00Z"
    }
  ]
  ```

#### Scenario: 在文章中顯示引用來源

**Given** 文章包含引用來源
**When** 使用者查看文章
**Then** 應在文章底部顯示「參考資料」區塊：
```markdown
## 參考資料

1. [Source Title](https://example.com/source1)
2. [Another Source](https://example.com/source2)
```

---

### Requirement: The system MUST handle Perplexity API errors

系統必須妥善處理 Perplexity API 的錯誤和異常情況。

#### Scenario: API Key 未設定時使用 Mock 資料

**Given** 環境變數 `PERPLEXITY_API_KEY` 未設定
**When** Agent 嘗試使用 Perplexity
**Then** 應：
1. 記錄警告訊息「Perplexity API Key 未設置」
2. 返回 Mock 資料（預先定義的範例回應）
3. Mock 資料應包含 `content` 和 `citations`
4. 標註資料來源為「模擬資料」

#### Scenario: API 請求失敗 Retry

**Given** Perplexity API 請求失敗
**When** 發生網路錯誤或超時
**Then** 應：
1. 自動 retry 最多 3 次
2. 使用指數退避（1s, 2s, 4s）
3. 記錄每次 retry 的狀態
4. 如果全部失敗，返回 Mock 資料並記錄錯誤

#### Scenario: API 回應格式錯誤

**Given** Perplexity API 回應
**When** 回應不符合預期的 Schema
**Then** 應：
1. 使用 Zod 驗證回應格式
2. 記錄驗證錯誤詳情
3. 嘗試提取部分可用的資料
4. 如果完全無法解析，返回 Mock 資料

---

### Requirement: The system MUST optimize Perplexity search

系統必須最佳化 Perplexity 的查詢方式，提升回應品質和效率。

#### Scenario: 針對中文查詢最佳化

**Given** 使用者輸入中文關鍵字
**When** 構建 Perplexity 查詢
**Then** 應：
1. 在 system prompt 中指定：「針對中文查詢，請優先搜尋繁體中文和簡體中文的資源」
2. 使用 `search_domain_filter` 包含台灣、香港、中國的網域
3. 設定 `search_recency_filter` 為最近一個月

#### Scenario: 為研究任務設定適當參數

**Given** Research Agent 執行關鍵字研究
**When** 呼叫 Perplexity API
**Then** 應使用以下參數：
- `model`: `'sonar'` (預設) 或 `'sonar-pro'` (高品質)
- `temperature`: `0.2` (事實性查詢需要低 temperature)
- `max_tokens`: `4000` (確保有足夠內容)
- `return_citations`: `true` (必須)
- `return_images`: `false` (文字研究不需要圖片)

#### Scenario: 為趨勢分析設定適當參數

**Given** Strategy Agent 獲取趨勢
**When** 呼叫 Perplexity API
**Then** 應使用以下參數：
- `model`: `'sonar'`
- `search_recency_filter`: `'week'` (最近一週的趨勢)
- `return_citations`: `true`
- `return_related_questions`: `false` (不需要相關問題)

---

### Requirement: The system MUST implement Perplexity search caching

系統必須實作快取機制，避免對相同查詢重複呼叫 Perplexity API。

#### Scenario: 快取搜尋結果

**Given** 首次使用 Perplexity 搜尋某個關鍵字
**When** 搜尋完成
**Then** 應：
1. 計算查詢的 hash key: `perplexity:search:${hash(keyword + region)}`
2. 將結果儲存到 Redis，TTL 為 3600 秒（1 小時）
3. 快取內容應包含 `content`, `citations`, `images`

#### Scenario: 使用快取的搜尋結果

**Given** 快取中已有相同查詢的結果
**When** 再次執行相同查詢
**Then** 應：
1. 檢查 Redis 快取
2. 如果找到且未過期，直接返回快取結果
3. 記錄日誌「使用快取的 Perplexity 結果」
4. 不呼叫 Perplexity API

#### Scenario: 快取過期後重新查詢

**Given** 快取中的結果已過期（> 1 小時）
**When** 執行查詢
**Then** 應：
1. 呼叫 Perplexity API 獲取最新資料
2. 更新快取
3. 返回新結果

---

### Requirement: The system MUST track Perplexity usage

系統必須追蹤 Perplexity API 的使用量和成本。

#### Scenario: 記錄 Perplexity API 使用

**Given** 成功呼叫 Perplexity API
**When** 收到回應
**Then** 應記錄到 `agent_cost_tracking` 表：
- `agent_name`: `'research'` 或 `'strategy'`
- `model`: `'perplexity-sonar'`
- `input_tokens`: 從 `usage.prompt_tokens` 取得
- `output_tokens`: 從 `usage.completion_tokens` 取得
- `cost_usd`: 根據 Perplexity 定價計算

#### Scenario: 計算 Perplexity 成本

**Given** Perplexity 的定價為 $0.001 per 1K tokens (input + output)
**When** 記錄使用量
**Then** 成本計算公式：
```
cost_usd = (input_tokens + output_tokens) × 0.001 / 1000
```
**And** 如果使用 `sonar-pro`，定價為 $0.003 per 1K tokens

#### Scenario: 在成本報告中顯示 Perplexity 使用

**Given** 使用者查看成本報告
**When** 顯示各 Agent 的成本
**Then** 應單獨列出 Perplexity 的使用：
```
Research Agent:
- AI Model (deepseek-reasoner): $0.0044
- Perplexity Search: $0.0012
Total: $0.0056
```

---

## MODIFIED Requirements

### Requirement: PerplexityClient MUST support multiple query methods

`PerplexityClient` 必須提供不同的查詢方法以支援各種使用場景。

#### Scenario: 通用搜尋查詢

**Given** Agent 需要執行一般搜尋
**When** 呼叫 `perplexity.search(query, options)`
**Then** 應返回：
```typescript
{
  content: string;         // 搜尋結果內容
  citations?: string[];    // 引用來源 URLs
  images?: string[];       // 相關圖片 URLs
}
```

#### Scenario: 競爭對手分析查詢

**Given** Research Agent 需要分析競爭對手
**When** 呼叫 `perplexity.analyzeCompetitors(keyword, domain?)`
**Then** 應返回結構化的競爭對手分析：
```typescript
{
  topCompetitors: Array<{
    domain: string;
    title: string;
    description: string;
    strengths: string[];
  }>;
  contentGaps: string[];
  recommendations: string[];
}
```

#### Scenario: 趨勢分析查詢

**Given** Strategy Agent 需要獲取趨勢
**When** 呼叫 `perplexity.getTrends(topic, timeframe)`
**Then** 應返回趨勢資訊：
```typescript
{
  trends: Array<{
    topic: string;
    description: string;
    relevance: number;
  }>;
  insights: string[];
}
```

#### Scenario: 深度主題研究

**Given** Agent 需要深度研究某個主題
**When** 呼叫 `perplexity.researchTopic(topic, aspects?)`
**Then** 應返回詳細研究結果：
```typescript
{
  summary: string;
  keyPoints: string[];
  statistics: Array<{ stat: string; source: string }>;
  expertOpinions: string[];
  relatedTopics: string[];
}
```

---

## REMOVED Requirements

無移除需求。

---

## Cross-References

- Related to: `model-configuration` - Perplexity 作為固定的搜尋來源
- Related to: `agent-model-selection` - Research 和 Strategy Agent 使用 Perplexity
- Implements: 搜尋和研究功能的核心實作

---

## Non-Functional Requirements

### Performance
- Perplexity API 回應時間 < 5 秒
- 快取命中率 > 60%（相同關鍵字的重複查詢）
- 引用來源提取 < 100ms

### Reliability
- API 請求成功率 > 95%（含 retry）
- 當 Perplexity 不可用時，系統仍能使用 Mock 資料繼續運作
- 引用來源必須 100% 儲存（不可遺失）

### Quality
- 中文查詢的回應必須優先包含繁體中文和簡體中文來源
- 引用來源必須可驗證（有效的 URL）
- 搜尋結果必須相關且即時（使用 `search_recency_filter`）

### Cost Optimization
- 透過快取減少 API 呼叫次數
- 記錄所有使用量以便成本分析
- 在開發環境使用 Mock 資料節省成本

### Monitoring
- 追蹤 Perplexity API 的可用性
- 追蹤快取命中率
- 追蹤引用來源的數量和品質
- 監控 API 使用量和成本
