# Design Document: Fix Article UI Issues

## Architecture Overview

本次修復涉及三個主要系統組件的調整：
1. 文章生成工作流程（Workflow）
2. Token 餘額管理系統（Billing）
3. 文章內容渲染管道（Content Pipeline）

## Design Decisions

### 1. 關鍵字與標題分離設計

#### 現有問題分析
目前系統將關鍵字直接當作標題處理，導致概念混淆。根據截圖分析，用戶輸入「5個跡象顯示AI程式設計師即將取代人類」作為關鍵字，但系統又基於此生成新標題，造成重複。

#### 解決方案架構
```
輸入流程重新設計：
[主題輸入] → [標題生成] → [標題確認] → [加入佇列] → [批次生成]
     ↓            ↓            ↓            ↓            ↓
  關鍵字/方向   AI 建議標題   用戶選擇    進行中列表   文章生成
```

#### 實作策略
- 修改 `ArticleGenerationButtons` 組件的標籤和提示文字
- 在 metadata 中明確區分 `topic` (主題) 和 `title` (標題)
- 調整 API payload 結構，將關鍵字作為 context 而非 title

### 2. Token 餘額即時更新機制

#### 現有問題分析
- 餘額組件使用 SWR 輪詢（5秒間隔）
- 文章生成完成後沒有觸發餘額更新
- 位置不當，影響使用流程

#### 解決方案架構
```
事件驅動更新模式：
[文章生成] → [扣除 Token] → [發送更新事件] → [SWR mutate] → [UI 更新]
```

#### 實作策略
- 在文章生成 API 返回時觸發 `mutate('/api/billing/balance')`
- 保留輪詢作為備援機制
- 使用 React Context 或事件總線協調更新

#### 位置調整方案
```tsx
<div className="dashboard-header">
  <h1>文章管理</h1>
  <TokenBalanceDisplay />  // 移至此處
  <ArticleGenerationButtons />
</div>
```

### 3. Markdown 到 HTML 渲染管道

#### 現有問題分析
根據程式碼檢查，系統在 `article-storage.ts` 中已經處理 markdown 和 html 轉換，但預覽時可能使用了錯誤的欄位。

#### 解決方案架構
```
內容處理管道：
[Markdown] → [HTML 轉換] → [安全淨化] → [儲存] → [渲染]
     ↓            ↓            ↓          ↓         ↓
  原始內容    marked/remark  DOMPurify   DB     dangerouslySetInnerHTML
```

#### 實作策略
1. **生成階段**：確保 `WritingAgent` 同時輸出 markdown 和 html
2. **儲存階段**：驗證 `html_content` 欄位正確儲存
3. **渲染階段**：使用適當的 prose CSS 類別支援

#### HTML 淨化策略（2024 最佳實踐）

根據 2024 年的安全研究，採用多層防禦策略：

```typescript
import DOMPurify from 'isomorphic-dompurify';

// 伺服器端和客戶端通用配置
const sanitizeConfig = {
  ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                 'ul', 'ol', 'li', 'blockquote', 'strong',
                 'em', 'a', 'img', 'code', 'pre', 'mark', 'del',
                 'ins', 'sub', 'sup', 'table', 'thead', 'tbody',
                 'tr', 'td', 'th'],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class',
                 'target', 'rel', 'width', 'height'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload']
};

// 自訂 Hook 模式（推薦）
export function useSecureHTML(content: string) {
  return useMemo(() => {
    if (typeof window !== 'undefined') {
      return DOMPurify.sanitize(content, sanitizeConfig);
    }
    // 伺服器端使用 isomorphic-dompurify
    return DOMPurify.sanitize(content, sanitizeConfig);
  }, [content]);
}
```

**關鍵安全原則**：
- 在 `dangerouslySetInnerHTML` 之前立即淨化（避免中間修改）
- 使用 `isomorphic-dompurify` 支援 SSR
- 實施 Content Security Policy (CSP) 作為額外防護層
- 伺服器端儲存前也要淨化（雙重防護）

## Component Dependencies

### 受影響的組件
1. **前端組件**
   - `/src/app/(dashboard)/dashboard/articles/page.tsx`
   - `/src/components/articles/ArticleGenerationButtons.tsx`
   - `/src/components/billing/TokenBalanceDisplay.tsx`

2. **API 路由**
   - `/api/articles/generate-batch`
   - `/api/billing/balance`
   - `/api/articles`

3. **服務層**
   - `/src/lib/services/article-storage.ts`
   - `/src/lib/billing/token-billing-service.ts`
   - `/src/lib/agents/writing-agent.ts`

## Performance Considerations

### Token 餘額更新優化
- 使用 debounce 避免頻繁更新
- 實作樂觀更新（Optimistic UI）
- 批次操作時只在最後更新一次

### 預覽渲染優化
- 實作虛擬捲動以處理長文章
- 懶加載圖片
- 快取已渲染的 HTML

## Security Considerations

### XSS 防護
- 所有用戶輸入的 HTML 必須經過 DOMPurify 淨化
- 禁止內嵌 JavaScript
- 限制允許的 HTML 標籤和屬性

### Token 餘額安全
- 服務端驗證餘額扣除
- 防止重複扣款（冪等性）
- 記錄所有 Token 交易

## Migration Strategy

### 資料遷移
1. 檢查現有文章的 `html_content` 欄位
2. 對缺少 HTML 的文章執行批次轉換
3. 確保新舊資料格式相容

### 版本相容
- 保持 API 向後相容
- 使用 feature flags 控制新功能
- 分階段部署

## Testing Requirements

### 單元測試
- Token 餘額計算邏輯
- Markdown 到 HTML 轉換
- 關鍵字/標題分離邏輯

### 整合測試
- 完整的文章生成流程
- Token 扣除和更新
- 預覽渲染

### E2E 測試
- 用戶完整操作流程
- 餘額即時更新
- 預覽效果驗證

## Rollback Plan

如果部署後發現問題：
1. 回滾程式碼至上一版本
2. 清除瀏覽器快取
3. 恢復資料庫 schema（如有變更）
4. 通知受影響用戶