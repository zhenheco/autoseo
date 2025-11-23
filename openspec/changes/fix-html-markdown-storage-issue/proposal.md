# 修復 HTML 內容儲存問題

## 概述

資料庫中 `generated_articles.html_content` 欄位錯誤儲存 Markdown 而非 HTML，導致前端預覽顯示 Markdown 語法，WordPress 發布失敗。

## 問題診斷

### 診斷結果（已確認）

執行 `scripts/diagnose-html-issue.ts` 診斷最新 3 篇文章：

```
⚠️  警告: html_content 包含 Markdown 語法！
❌ 問題確認: html_content 儲存的是 Markdown 而非 HTML
```

**具體症狀**：

- `html_content` 包含 `##`、`**` 等 Markdown 語法
- `html_content` 和 `markdown_content` 內容完全相同
- 前端預覽顯示原始 Markdown 而非渲染後的 HTML
- WordPress 發布收到 Markdown 內容

### 影響範圍

- **所有使用 Multi-Agent 架構生成的文章**
- Token/Credit 已扣除但文章無法正常使用
- WordPress 自動發布功能失效

## 根本原因分析

### 1. ContentAssemblerAgent (`src/lib/agents/content-assembler-agent.ts:91-127`)

```typescript
private async convertToHTML(markdown: string): Promise<string> {
  try {
    const html = await marked.parse(markdown);
    // ...驗證邏輯
    return html;
  } catch (error) {
    // ❌ 問題：拋出錯誤但可能在某些環境下被吞沒
    throw new Error(`Failed to convert Markdown to HTML: ...`);
  }
}
```

**問題**：

- `marked.parse()` 在生產環境可能失敗但錯誤未被正確捕獲
- 沒有 fallback 機制
- 驗證不夠嚴格（只檢查長度和 Markdown 語法殘留）

### 2. OutputAdapter (`src/lib/agents/output-adapter.ts:29-53`)

```typescript
adapt(input: {...}): WritingAgentOutput {
  return {
    markdown: assemblerOutput.markdown,
    html: assemblerOutput.html,  // ❌ 直接使用，未驗證
    // ...
  };
}
```

**問題**：

- 假設 `assemblerOutput.html` 已正確轉換
- 沒有驗證 HTML 有效性的邏輯

### 3. ArticleStorage (`src/lib/services/article-storage.ts:203`)

```typescript
const articleData = {
  html_content: result.writing!.html, // ❌ 直接儲存，未驗證
  markdown_content: result.writing!.markdown,
  // ...
};
```

**問題**：

- 儲存前沒有驗證 HTML 是否有效
- 如果 `html` 實際上是 Markdown，會無聲地儲存錯誤資料

## 解決方案

### 核心修復

1. **加強 ContentAssemblerAgent 錯誤處理**
   - 改進 `marked.parse()` 的錯誤捕獲
   - 添加嚴格的 HTML 驗證邏輯
   - 提供 fallback 機制（使用 WritingAgent 的轉換邏輯）

2. **在 OutputAdapter 加入 HTML 驗證**
   - 驗證 `html` 欄位確實包含 HTML 標籤
   - 如果檢測到 Markdown，觸發重新轉換

3. **在 ArticleStorage 加入儲存前驗證**
   - 最後一道防線：驗證 `html_content` 有效性
   - 記錄警告並嘗試自動修復

### 資料修復

創建腳本 `scripts/fix-damaged-articles.ts`：

- 掃描所有 `html_content` 包含 Markdown 語法的文章
- 重新從 `markdown_content` 轉換為 HTML
- 更新資料庫記錄

## 驗收標準

1. ✅ 新生成的文章 `html_content` 包含有效 HTML
2. ✅ 前端預覽正確渲染 HTML
3. ✅ WordPress 發布收到正確的 HTML 內容
4. ✅ 所有受影響的歷史文章已修復
5. ✅ 詳細日誌可追蹤轉換過程

## 相關 Issue

- Credit 扣除邏輯需要驗證（orchestrator.ts:584-629）
- Multi-Agent 架構的錯誤處理機制需要全面review
