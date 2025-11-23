# 實作任務清單

## Phase 1: 核心修復（優先）

### Task 1: 加強 ContentAssemblerAgent HTML 轉換邏輯

**檔案**: `src/lib/agents/content-assembler-agent.ts`

- [ ] 改進 `convertToHTML()` 方法的錯誤處理
  - 捕獲所有可能的 `marked.parse()` 錯誤
  - 添加詳細的錯誤日誌（包含 markdown 樣本）
- [ ] 加強 HTML 驗證邏輯
  - 檢查是否包含基本 HTML 標籤（`<p>`, `<h2>`, `<ul>` 等）
  - 檢測 Markdown 殘留語法（`##`, `**`, `- `, `* ` 等）
  - 驗證 HTML 與 Markdown 長度差異（轉換後應該更長）
- [ ] 實作 fallback 機制
  - 如果 `marked.parse()` 失敗，使用備用轉換方法
  - 記錄 fallback 事件以便追蹤問題

**驗證**:

```bash
npx tsx scripts/test-content-assembler.ts
```

---

### Task 2: OutputAdapter 加入 HTML 驗證

**檔案**: `src/lib/agents/output-adapter.ts`

- [ ] 新增 `validateHTML()` 私有方法
  ```typescript
  private validateHTML(html: string): boolean {
    // 檢查是否包含 HTML 標籤
    if (!html.includes('<') || !html.includes('>')) return false;
    // 檢查是否殘留 Markdown 語法
    if (html.includes('##') || html.includes('**')) return false;
    return true;
  }
  ```
- [ ] 在 `adapt()` 方法中加入驗證
  - 如果 HTML 無效，記錄警告
  - 嘗試重新轉換（使用 WritingAgent 的邏輯）
- [ ] 添加詳細日誌
  - 記錄驗證結果
  - 記錄 fallback 觸發事件

**驗證**:

```bash
npx tsx src/lib/agents/__tests__/output-adapter.test.ts
```

---

### Task 3: ArticleStorage 加入儲存前驗證

**檔案**: `src/lib/services/article-storage.ts`

- [ ] 在 `saveArticle()` 方法加入 HTML 驗證
  ```typescript
  // 在準備 articleData 之前
  if (!this.isValidHTML(result.writing!.html)) {
    console.error(
      "[ArticleStorage] Invalid HTML detected, attempting to fix...",
    );
    result.writing!.html = await this.convertMarkdownToHTML(
      result.writing!.markdown,
    );
  }
  ```
- [ ] 新增 `isValidHTML()` 輔助方法
- [ ] 新增 `convertMarkdownToHTML()` 輔助方法
  - 使用與 WritingAgent 相同的 `marked.parse()` 邏輯
- [ ] 添加驗證失敗的告警日誌

**驗證**:

- 執行文章生成流程
- 檢查資料庫 `html_content` 欄位

---

## Phase 2: 資料修復

### Task 4: 創建診斷和修復腳本

**檔案**: `scripts/fix-damaged-articles.ts`

- [ ] 掃描所有受影響的文章
  ```sql
  SELECT id, title, html_content, markdown_content
  FROM generated_articles
  WHERE html_content LIKE '%##%'
     OR html_content LIKE '%**%'
  ORDER BY created_at DESC;
  ```
- [ ] 對每篇受影響的文章：
  - 從 `markdown_content` 重新生成 HTML
  - 驗證新的 HTML 有效性
  - 更新 `html_content` 欄位
  - 記錄修復日誌
- [ ] 生成修復報告
  - 受影響文章總數
  - 成功修復數量
  - 失敗案例（需要人工檢查）

**執行**:

```bash
npx tsx scripts/fix-damaged-articles.ts
```

---

## Phase 3: 監控和測試

### Task 5: 添加集成測試

**檔案**: `src/lib/agents/__tests__/content-generation-integration.test.ts`

- [ ] 測試 Multi-Agent 完整流程
  - 確保生成的 `html` 是有效 HTML
  - 確保不包含 Markdown 語法
- [ ] 測試 fallback 機制
  - 模擬 `marked.parse()` 失敗
  - 驗證 fallback 能正常運作
- [ ] 測試資料儲存
  - 驗證儲存到資料庫的是 HTML 而非 Markdown

**執行**:

```bash
npm test -- content-generation-integration
```

---

### Task 6: 添加監控日誌

**檔案**: 各個 agent 檔案

- [ ] ContentAssemblerAgent 添加指標
  - 轉換成功/失敗次數
  - 轉換耗時
  - Fallback 觸發次數
- [ ] OutputAdapter 添加指標
  - HTML 驗證成功/失敗次數
  - 重新轉換次數
- [ ] ArticleStorage 添加指標
  - 儲存前驗證失敗次數
  - 自動修復次數

---

## Phase 4: 驗證和部署

### Task 7: E2E 驗證

- [ ] 在開發環境生成測試文章
  - 檢查資料庫 `html_content`
  - 檢查前端預覽
- [ ] 執行修復腳本
  - 驗證歷史文章已修復
  - 檢查修復報告
- [ ] WordPress 發布測試
  - 確認發布的是 HTML 而非 Markdown

### Task 8: 部署到生產環境

- [ ] 執行 lint 和 typecheck
- [ ] 提交 PR 並等待 Review
- [ ] 部署到 Vercel
- [ ] 執行生產環境的修復腳本
- [ ] 監控新生成的文章

---

## 依賴關係

```
Task 1 (ContentAssembler)
  ├─> Task 2 (OutputAdapter)
  │    └─> Task 3 (ArticleStorage)
  │         └─> Task 4 (修復腳本)
  └─> Task 5 (測試)

Task 6 (監控) - 可並行
Task 7 (E2E驗證) - 需要 Task 1-4 完成
Task 8 (部署) - 需要 Task 7 通過
```

## 預估工時

- Phase 1: 4-6 小時
- Phase 2: 2-3 小時
- Phase 3: 3-4 小時
- Phase 4: 2-3 小時

**總計**: 11-16 小時
