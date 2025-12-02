## Context

文章生成系統涉及多個 Agent 協作：

1. **ResearchAgent**：執行深度研究（分析標題、取得外部引用、執行深度研究）
2. **StrategyAgent**：制定文章策略和生成標題
3. **ArticleStorage**：儲存文章，負責 Markdown 到 HTML 轉換

目前系統存在三個主要問題：

1. **Perplexity API 成本過高**：每篇文章 4 次 API 呼叫
2. **外部來源搜尋失敗**：對商業/服務類主題無法找到「權威」來源
3. **標題模板化**：使用固定模板生成標題，缺乏個性化
4. **HTML 轉換失敗**：文章 Markdown 內容未正確轉換為 HTML

## Goals / Non-Goals

**Goals:**

- 減少 Perplexity API 呼叫次數至 1 次
- 接受 Perplexity 返回的任何相關來源（不限制類型）
- 保持研究數據品質（trends、FAQ、authority data）
- 整合用戶 n8n 工作流程的成功模式
- 標題由 AI 根據研究結果自動生成，不使用模板
- 確保 Markdown 正確轉換為 HTML

**Non-Goals:**

- 不改變 `analyzeTitle()` 的 AI 分析邏輯
- 不改變 HTMLAgent 的連結插入邏輯
- 不改變 Perplexity 客戶端的快取機制
- 不改變文章內容的生成邏輯

## Decisions

### Decision 1: 合併所有 Perplexity 查詢為單次呼叫

**What:** 將 `performDeepResearch()` 的 3 個查詢和 `fetchExternalReferences()` 合併為單一查詢。

**Why:**

- 減少 API 成本（從 4 次降為 1 次）
- 避免重複資料
- 更一致的研究結果

**How:**

```typescript
const query = `
請針對「${keyword}」${regionStr} 進行綜合研究，提供：

1. **最新趨勢**（${currentYear}-${nextYear}）：
   - 行業動態、專家見解、發展方向

2. **常見問題與解決方案**：
   - 用戶常見疑問、FAQ、使用體驗

3. **權威數據與統計**：
   - 相關數據、市場資訊、實用統計

4. **實用參考來源**：
   - 請提供 5-8 個最相關、最實用的來源網址
   - 可以是：服務商網站、產業部落格、新聞報導、教學文章
   - 不需要限制為學術或官方來源

請在回答中自然引用來源。
`;
```

**Alternatives considered:**

1. **保持 4 次查詢但加入快取共享** - 仍然成本高
2. **只保留 `fetchExternalReferences`** - 會失去 trends/FAQ 資料
3. **使用更便宜的模型** - 品質可能下降

### Decision 2: 移除外部來源類型限制

**What:** `fetchExternalReferences()` 的 prompt 不再要求特定類型的來源。

**Why:**

- 對於商業服務類主題，Wikipedia/學術來源不存在
- Perplexity 已經會返回最相關的來源
- 實用性比權威性更重要

**How:**

```typescript
// 舊的 prompt（過於嚴格）
const query = `找出關於「${title}」最權威和最新的 5 個外部來源，
請按以下優先順序尋找：
1. Wikipedia 或百科全書
2. 官方文檔或官網
3. 學術研究或報告
...`;

// 新的 prompt（更靈活）
// 已整合到 Decision 1 的綜合查詢中
```

### Decision 3: 擴展來源類型定義

**What:** `ExternalReference.type` 增加新類型。

**Why:**

- 現有類型無法準確描述商業服務網站
- 需要區分「服務商」和「產業部落格」

**How:**

```typescript
type ExternalReferenceType =
  | "wikipedia"
  | "official_docs"
  | "research"
  | "news"
  | "blog"
  | "service" // 新增：服務提供商網站
  | "industry" // 新增：產業資訊網站
  | "tutorial"; // 新增：教學/指南網站
```

### Decision 4: 使用 Perplexity citation metadata

**What:** 優先使用 Perplexity 返回的 citation 物件中的 metadata。

**Why:**

- Perplexity 已經分析過來源
- 可以獲得更準確的標題和描述
- 減少額外的 URL 解析邏輯

**How:**

```typescript
// Perplexity citation 結構（若可用）
interface PerplexityCitation {
  url: string;
  title?: string;
  snippet?: string;
  domain?: string;
}

// 處理邏輯
for (const citation of result.citations) {
  const ref: ExternalReference = {
    url: typeof citation === "string" ? citation : citation.url,
    title: citation.title || this.extractTitleFromUrl(citation.url),
    description: citation.snippet || `關於「${title}」的參考來源`,
    type: this.categorizeUrl(citation.url),
    domain: citation.domain || new URL(citation.url).hostname,
  };
  references.push(ref);
}
```

### Decision 5: 移除標題模板，改用 AI 分析生成

**What:** 移除 `StrategyAgent.getFallbackTitles()` 的模板邏輯，改用 AI 根據研究結果生成標題。

**Why:**

- 模板化標題過於公式化（如「{keyword}：2025年最新實用技巧」）
- 無法反映文章的實際內容和價值
- 用戶希望標題更自然、更有針對性

**How:**

```typescript
// 舊的模板邏輯
private getFallbackTitles(title: string): string[] {
  const year = new Date().getFullYear();
  return [
    `${title}：${year}年最新實用技巧`,
    `${title}怎麼做？專家分享 5 個關鍵步驟`,
    `${title}必知重點：避開常見錯誤`,
  ];
}

// 新的 AI 生成邏輯
private async generateTitlesFromResearch(
  keyword: string,
  researchData: ResearchData
): Promise<string[]> {
  const prompt = `
根據以下研究資料，為關鍵字「${keyword}」生成 3 個吸引人的文章標題：

研究資料摘要：
${researchData.trends?.content || ''}
${researchData.userQuestions?.content || ''}

要求：
1. 標題應反映文章的核心價值
2. 自然且吸引讀者點擊
3. 包含關鍵字但不生硬
4. 避免過於模板化的表達方式
`;
  // AI 生成標題
}
```

### Decision 6: 修復 HTML 轉換邏輯

**What:** 調查並修復 `article-storage.ts` 中 Markdown 到 HTML 轉換失敗的問題。

**Why:**

- 資料庫顯示 `html_content` 為空但 `markdown_content` 有資料
- 用戶在編輯器中看到空白內容
- 這是一個阻斷用戶使用的關鍵問題

**How:**

1. 檢查 `saveArticle()` 中的 `marked.parse()` 呼叫
2. 增加錯誤處理和日誌
3. 確保 fallback 邏輯正確執行

```typescript
// 增加錯誤處理
try {
  const htmlContent = await marked.parse(markdownContent);
  if (!htmlContent || htmlContent.length === 0) {
    console.error("[ArticleStorage] HTML conversion returned empty result");
    // Fallback: 將 Markdown 直接作為 HTML
    return `<pre>${markdownContent}</pre>`;
  }
  return htmlContent;
} catch (error) {
  console.error("[ArticleStorage] HTML conversion failed:", error);
  throw error;
}
```

## Risks / Trade-offs

| Risk                           | Mitigation                                                    |
| ------------------------------ | ------------------------------------------------------------- |
| 合併查詢可能降低資料細緻度     | 使用結構化 prompt 確保涵蓋所有面向                            |
| 接受任何來源可能包含低品質網站 | 保留 `categorizeUrl()` 進行基本分類，HTMLAgent 可選擇是否使用 |
| Perplexity API 格式變更        | 保留 fallback 邏輯處理純字串 citations                        |
| AI 生成標題品質不穩定          | 保留人工審核機制，用戶可在發布前修改標題                      |
| HTML 轉換 fallback 格式較差    | 優先修復根本原因，fallback 僅作為最後防線                     |

## Migration Plan

1. 修改 `ResearchAgent.process()` 流程
2. 新增 `executeUnifiedResearch()` 方法
3. 棄用 `performDeepResearch()` 和 `fetchExternalReferences()`（保留但標記 deprecated）
4. 更新 `ExternalReference` 類型定義
5. 修改 `StrategyAgent` 標題生成邏輯
6. 修復 `article-storage.ts` HTML 轉換
7. 測試確認輸出格式相容現有 HTMLAgent

## Open Questions

- [ ] 是否需要保留舊方法作為 fallback？
- [ ] 合併查詢的 max_tokens 應設為多少？（建議 4000-5000）
- [x] 標題生成應在哪個階段執行？（Answer: StrategyAgent）
- [ ] HTML 轉換失敗的根本原因是什麼？需要進一步調查
