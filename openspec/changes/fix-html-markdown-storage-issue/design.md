# 設計文件：HTML 內容儲存修復

## 架構決策

### 1. 多層防禦策略（Defense in Depth）

我們採用多層驗證和修復機制，而非單點修復：

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: ContentAssemblerAgent                        │
│  - marked.parse() with error handling                  │
│  - Strict HTML validation                              │
│  - Fallback mechanism                                  │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ Layer 2: OutputAdapter                                 │
│  - HTML validity check                                 │
│  - Re-conversion if invalid                            │
│  - Logging and metrics                                 │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ Layer 3: ArticleStorage                                │
│  - Final validation before DB insert                   │
│  - Automatic repair attempt                            │
│  - Error logging for manual review                     │
└─────────────────────────────────────────────────────────┘
```

**理由**：

- 單層修復可能在某些邊緣案例失效
- 多層防禦確保即使一層失敗，其他層也能捕獲問題
- 每一層都記錄日誌，便於追蹤問題根源

---

### 2. 漸進式修復（Graceful Degradation）

當 Markdown→HTML 轉換失敗時，我們使用 fallback 鏈而非直接失敗：

```
Primary: marked.parse()
   ↓ (if fails)
Fallback 1: WritingAgent's markdown-to-html logic
   ↓ (if fails)
Fallback 2: Store markdown as plain text with warning
   ↓
Always: Log detailed error for investigation
```

**理由**：

- 避免因轉換失敗導致整個文章生成流程中斷
- Credit 已扣除的情況下，應盡可能提供可用的輸出
- 詳細日誌確保可以追蹤和修復根本問題

---

### 3. HTML 驗證標準

我們定義嚴格的 HTML 驗證規則：

```typescript
interface HTMLValidationRules {
  // 必須包含至少一個 HTML 標籤
  hasHTMLTags: boolean;

  // 不應包含 Markdown 語法
  noMarkdownSyntax: boolean;

  // HTML 長度應大於 Markdown（標籤增加長度）
  lengthRatio: number; // html.length / markdown.length > 1.1

  // 應包含基本結構標籤
  hasStructuralTags: boolean; // <p>, <h2>, <ul> 等
}
```

**驗證實作**：

````typescript
private isValidHTML(html: string, markdown: string): boolean {
  // Rule 1: 必須包含 HTML 標籤
  if (!html.includes('<') || !html.includes('>')) {
    console.warn('[Validator] No HTML tags found');
    return false;
  }

  // Rule 2: 不應包含 Markdown 語法
  const markdownPatterns = ['##', '**', '```', '* ', '- ', '1. '];
  const hasMarkdown = markdownPatterns.some(p => html.includes(p));
  if (hasMarkdown) {
    console.warn('[Validator] Markdown syntax detected in HTML');
    return false;
  }

  // Rule 3: 長度比例檢查
  const ratio = html.length / markdown.length;
  if (ratio < 1.05) { // 允許 5% 的誤差
    console.warn('[Validator] HTML not longer than markdown', { ratio });
    return false;
  }

  // Rule 4: 結構標籤檢查
  const structuralTags = ['<p>', '<h2>', '<h3>', '<ul>', '<ol>'];
  const hasStructure = structuralTags.some(tag => html.includes(tag));
  if (!hasStructure) {
    console.warn('[Validator] No structural HTML tags found');
    return false;
  }

  return true;
}
````

---

### 4. 錯誤處理和日誌策略

我們使用結構化日誌記錄所有關鍵事件：

```typescript
// 成功案例
console.log("[ContentAssembler] ✅ Markdown → HTML conversion successful", {
  markdownLength: markdown.length,
  htmlLength: html.length,
  ratio: html.length / markdown.length,
  executionTime: Date.now() - startTime,
});

// 驗證失敗案例
console.warn("[ContentAssembler] ⚠️  HTML validation failed", {
  markdownSample: markdown.substring(0, 200),
  htmlSample: html.substring(0, 200),
  validationRules: {
    hasHTMLTags: false,
    noMarkdownSyntax: false,
    lengthRatio: 0.98,
  },
});

// Fallback 觸發案例
console.warn("[ContentAssembler] 🔄 Falling back to alternative conversion", {
  primaryError: error.message,
  fallbackMethod: "WritingAgent.convertToHTML",
  attemptNumber: 2,
});

// 嚴重錯誤案例
console.error("[ContentAssembler] ❌ All conversion methods failed", {
  error: error.stack,
  markdown: markdown.substring(0, 500),
  fallbacksAttempted: ["marked.parse", "WritingAgent.convert"],
});
```

**日誌等級**：

- `log`: 正常操作
- `warn`: 潛在問題（觸發 fallback、驗證失敗）
- `error`: 嚴重問題（所有方法都失敗）

---

### 5. 資料修復策略

對於已損壞的歷史資料，我們使用批量修復腳本：

```typescript
async function fixDamagedArticles() {
  // Step 1: 識別受影響的文章
  const damagedArticles = await supabase
    .from("generated_articles")
    .select("id, markdown_content, html_content")
    .or("html_content.like.%##%,html_content.like.%**%");

  console.log(`Found ${damagedArticles.length} damaged articles`);

  // Step 2: 批量修復（並行處理，限制並發數）
  const results = await pLimit(
    5,
    damagedArticles.map((article) => async () => {
      try {
        const html = await marked.parse(article.markdown_content);

        if (!isValidHTML(html, article.markdown_content)) {
          throw new Error("Conversion resulted in invalid HTML");
        }

        await supabase
          .from("generated_articles")
          .update({ html_content: html })
          .eq("id", article.id);

        return { id: article.id, status: "success" };
      } catch (error) {
        return { id: article.id, status: "failed", error };
      }
    }),
  );

  // Step 3: 生成報告
  const report = {
    total: damagedArticles.length,
    success: results.filter((r) => r.status === "success").length,
    failed: results.filter((r) => r.status === "failed"),
    timestamp: new Date().toISOString(),
  };

  console.log("[FixScript] Repair complete:", report);
  return report;
}
```

**批量處理考量**：

- 限制並發數（5），避免資料庫負載過高
- 記錄每個修復結果
- 生成詳細報告供人工審查失敗案例

---

## 設計權衡（Trade-offs）

### 選擇 1: 多層驗證 vs. 單點修復

**選擇**：多層驗證
**理由**：

- ✅ 更高的可靠性
- ✅ 更容易追蹤問題根源
- ❌ 增加代碼複雜度
- ❌ 可能增加執行時間（~10-20ms per article）

**結論**：可靠性優先，少量的執行時間增加是可接受的。

### 選擇 2: 即時修復 vs. 事後修復

**選擇**：即時修復（with fallback）
**理由**：

- ✅ 用戶體驗更好（無需等待批量修復）
- ✅ 減少資料污染擴散
- ❌ 增加實時處理的複雜度

**結論**：即時修復為主，批量修復為輔。

### 選擇 3: 嚴格驗證 vs. 寬鬆驗證

**選擇**：嚴格驗證
**理由**：

- ✅ 及早發現問題
- ✅ 確保資料質量
- ❌ 可能誤判邊緣案例

**結論**：嚴格驗證，但提供詳細日誌以便調整規則。

---

## 測試策略

### 單元測試

```typescript
describe("ContentAssemblerAgent", () => {
  describe("convertToHTML", () => {
    it("should convert valid markdown to HTML", async () => {
      const markdown = "## Heading\n\nParagraph";
      const html = await agent.convertToHTML(markdown);
      expect(html).toContain("<h2>");
      expect(html).toContain("<p>");
      expect(html).not.toContain("##");
    });

    it("should handle conversion errors gracefully", async () => {
      // Mock marked.parse to throw error
      jest.spyOn(marked, "parse").mockRejectedValue(new Error("Parse failed"));

      // Should fallback without throwing
      const html = await agent.convertToHTML("## Test");
      expect(html).toBeDefined();
    });
  });
});
```

### 集成測試

```typescript
describe("Article Generation E2E", () => {
  it("should generate article with valid HTML content", async () => {
    const result = await orchestrator.execute(input);

    expect(result.writing.html).toBeDefined();
    expect(result.writing.html).toContain("<");
    expect(result.writing.html).not.toContain("##");
    expect(result.writing.html.length).toBeGreaterThan(
      result.writing.markdown.length,
    );
  });
});
```

---

## 部署計劃

### Phase 1: 開發環境驗證

1. 部署修復代碼
2. 生成測試文章（至少 10 篇）
3. 驗證所有文章的 `html_content` 有效
4. 執行修復腳本測試

### Phase 2: Staging 環境測試

1. 部署到 staging
2. 執行完整 E2E 測試
3. 監控日誌和指標
4. 修復任何發現的問題

### Phase 3: 生產環境部署

1. 部署代碼到生產環境
2. 立即執行修復腳本修復歷史資料
3. 監控新生成的文章（首 24 小時密切監控）
4. 準備回滾計劃（如有問題）

---

## 監控指標

部署後需要監控的關鍵指標：

```typescript
const metrics = {
  // 轉換成功率
  conversionSuccessRate: successCount / totalCount,

  // Fallback 觸發率
  fallbackTriggerRate: fallbackCount / totalCount,

  // HTML 驗證失敗率
  validationFailureRate: validationFailures / totalCount,

  // 平均轉換時間
  averageConversionTime: totalTime / totalCount,

  // 資料庫修復次數
  databaseFixCount: storageLayerFixes,
};

// 告警閾值
const alerts = {
  conversionSuccessRate: { threshold: 0.95, severity: "critical" },
  fallbackTriggerRate: { threshold: 0.1, severity: "warning" },
  validationFailureRate: { threshold: 0.05, severity: "warning" },
};
```

---

## 未來改進

1. **探索 marked 的替代方案**
   - 調查其他 Markdown→HTML 庫（markdown-it, remark）
   - 性能和可靠性比較

2. **實作預編譯機制**
   - 在文章生成時同時生成多種格式（HTML, Plain Text）
   - 減少對單一轉換庫的依賴

3. **加強監控和告警**
   - 集成 Sentry 或其他 APM 工具
   - 實時告警機制
