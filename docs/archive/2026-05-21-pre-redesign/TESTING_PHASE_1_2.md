# Phase 1 & 2 功能測試清單

## 測試環境

- **URL**: http://localhost:3168/dashboard/articles
- **瀏覽器**: Chrome（推薦使用 Chrome DevTools）
- **日期**: 2025-11-15

## Phase 1: 狀態圖示優化 - 測試項目

### ✅ 視覺檢查

- [ ] 文章列表中，狀態顯示為圖示而非文字 Badge
- [ ] 圖示大小為 16px（h-4 w-4）
- [ ] 圖示與標題在同一行顯示
- [ ] 圖示顏色正確：
  - ✅ Check (綠色) - completed
  - ⏰ Clock (灰色) - pending
  - 📅 Calendar (藍色) - scheduled
  - ⚠️ XCircle (紅色) - failed
  - 🔄 Loader2 (黃色, 旋轉動畫) - processing

### ✅ Tooltip 功能

- [ ] 滑鼠移至圖示時顯示 tooltip
- [ ] Tooltip 顯示正確的狀態文字（如「已完成」、「等待中」等）
- [ ] Tooltip 出現延遲約 200ms
- [ ] Tooltip 樣式正確（背景、文字顏色、圓角等）

### ✅ 無障礙功能

- [ ] 使用 Tab 鍵可以導航到圖示
- [ ] 圖示獲得焦點時顯示 focus ring
- [ ] 按下 Enter 或 Space 鍵可以觸發 tooltip
- [ ] 使用螢幕閱讀器（VoiceOver/NVDA）可以正確朗讀狀態
- [ ] 圖示容器包含 `role="img"` 屬性
- [ ] 圖示包含 `aria-label` 屬性

### ✅ 暗色模式

- [ ] 切換到暗色模式
- [ ] 圖示顏色自動調整為暗色模式配色（dark:text-\*-400）
- [ ] Tooltip 在暗色模式下可讀性良好

### ✅ Chrome DevTools 檢查

1. 開啟 Chrome DevTools（F12）
2. 切換到 Elements 面板
3. 檢查圖示元素結構：
   ```html
   <div role="img" aria-label="已完成" tabindex="0" class="...">
     <svg class="h-4 w-4 text-green-600 dark:text-green-400">...</svg>
   </div>
   ```
4. 切換到 Console 面板，確認無錯誤
5. 使用 Accessibility 面板檢查無障礙屬性

---

## Phase 2: 網站選擇器增強 - 測試項目

### ✅ 基本功能

- [ ] 點擊「發布」按鈕打開 PublishControlDialog
- [ ] 對話框中顯示網站選擇下拉選單
- [ ] 選單顯示所有可用網站
- [ ] 每個網站項目包含：
  - 🌐 Globe 圖示
  - 網站名稱（粗體）
  - Hostname（灰色小字，如 example.com）

### ✅ 智慧預設選擇

**測試流程**：

1. **首次發布**：
   - [ ] 選單自動選擇第一個可用網站
   - [ ] 選擇其他網站並發布

2. **第二次發布**：
   - [ ] 選單自動選擇上次使用的網站（從 localStorage）
   - [ ] 檢查 DevTools > Application > Local Storage
   - [ ] 確認存在 key: `last-selected-website-{companyId}`

3. **文章曾發布過的網站**：
   - [ ] 如果文章有 `website_id`，優先選擇該網站
   - [ ] 檢查 Network 面板，確認發送了 `articleWebsiteId` 參數

### ✅ 網站狀態指示

- [ ] Active 網站可以選擇
- [ ] Inactive 網站顯示為灰色（disabled）
- [ ] Inactive 網站附註「（已停用）」標記
- [ ] 嘗試選擇 inactive 網站時無法選中

### ✅ 發布確認 Alert

**PublishControlDialog**：

- [ ] 選擇網站後顯示 Alert
- [ ] Alert 內容：「文章將發布至：{網站名稱}」
- [ ] Alert 包含 Info 圖示
- [ ] Alert 樣式正確（背景、邊框、文字顏色）

**BatchPublishDialog**：

- [ ] 選中多篇文章
- [ ] 點擊「批次發布」
- [ ] 對話框標題顯示「批次發布文章（X 篇）」
- [ ] 選擇網站後顯示 Alert
- [ ] Alert 內容：「確定要將 X 篇文章發布到『{網站名稱}』嗎？」

### ✅ Chrome DevTools 檢查

**1. Console 檢查**

- [ ] 開啟 Console 面板
- [ ] 檢查是否有錯誤或警告
- [ ] 特別注意 React Hooks 相關錯誤

**2. Network 檢查**

```
發布文章時：
- [ ] 檢查 POST /api/articles/{id}/publish
- [ ] Request Payload 包含 website_id
- [ ] Response 包含網站名稱

批次發布時：
- [ ] 檢查 POST /api/articles/batch-publish
- [ ] Request Payload 包含 website_id
- [ ] Response 包含成功/失敗統計
```

**3. Application 檢查**

- [ ] Local Storage 包含 `last-selected-website-{companyId}` 項目
- [ ] 值為最後選擇的網站 ID（UUID 格式）
- [ ] 切換網站時，localStorage 即時更新

**4. Elements 檢查**
檢查 Select 組件結構：

```html
<div class="flex items-center gap-2">
  <svg class="h-4 w-4 text-muted-foreground"><!-- Globe icon --></svg>
  <div class="flex flex-col items-start">
    <div class="flex items-center gap-2">
      <span class="font-medium">{網站名稱}</span>
      <span class="text-xs text-muted-foreground">（已停用）</span>
      <!-- if inactive -->
    </div>
    <span class="text-xs text-muted-foreground">{hostname}</span>
  </div>
</div>
```

---

## 已知限制和注意事項

### API 驗證（⚠️ 需要後續確認）

由於 Phase 2 的實作主要在前端，以下 API 功能已存在但需要實際測試確認：

- [ ] 伺服器端驗證 `website_id` 屬於使用者的 company
- [ ] 發布成功後更新 `articles.website_id` 欄位
- [ ] 批次發布成功後更新所有文章的 `website_id` 欄位
- [ ] 未授權請求返回 403 Forbidden

**測試方法**：

1. 使用 Chrome DevTools > Network 面板
2. 發布文章後檢查 Response
3. 重新整理頁面，確認文章的 `website_id` 已更新
4. 嘗試使用 Postman/curl 發送不屬於自己的 `website_id`，應返回 403

---

## 測試結果記錄

### Phase 1 測試結果

**日期**: ****\_\_\_****
**測試人員**: ****\_\_\_****

- [ ] ✅ 所有視覺檢查通過
- [ ] ✅ Tooltip 功能正常
- [ ] ✅ 無障礙功能正常
- [ ] ✅ 暗色模式正常
- [ ] ✅ Chrome DevTools 檢查無錯誤

**問題記錄**:

```
（記錄發現的問題）
```

### Phase 2 測試結果

**日期**: ****\_\_\_****
**測試人員**: ****\_\_\_****

- [ ] ✅ 基本功能正常
- [ ] ✅ 智慧預設選擇正常
- [ ] ✅ 網站狀態指示正常
- [ ] ✅ 發布確認 Alert 正常
- [ ] ✅ Chrome DevTools 檢查無錯誤
- [ ] ✅ API 功能驗證通過

**問題記錄**:

```
（記錄發現的問題）
```

---

## 自動化測試建議（未來）

由於無法在 CLI 環境中進行視覺測試，建議未來加入以下自動化測試：

### Playwright E2E 測試

```typescript
// test/e2e/article-status.spec.ts
test("should display article status as icons", async ({ page }) => {
  await page.goto("/dashboard/articles");
  const statusIcon = page.locator('[role="img"][aria-label="已完成"]');
  await expect(statusIcon).toBeVisible();
  await expect(statusIcon).toHaveCSS("width", "16px");
});

test("should show tooltip on hover", async ({ page }) => {
  await page.goto("/dashboard/articles");
  const statusIcon = page.locator('[role="img"][aria-label="已完成"]');
  await statusIcon.hover();
  await expect(page.locator('[role="tooltip"]')).toBeVisible();
});
```

### Cypress 組件測試

```typescript
// cypress/component/ArticleStatusIcon.cy.tsx
describe('ArticleStatusIcon', () => {
  it('renders with correct color and icon', () => {
    cy.mount(<ArticleStatusIcon status="completed" />);
    cy.get('[role="img"]').should('have.class', 'text-green-600');
    cy.get('svg').should('exist');
  });
});
```

### Jest 單元測試

```typescript
// __tests__/components/ArticleStatusIcon.test.tsx
import { render, screen } from '@testing-library/react';
import { ArticleStatusIcon } from '@/components/articles/ArticleStatusIcon';

test('renders completed status icon', () => {
  render(<ArticleStatusIcon status="completed" />);
  const icon = screen.getByRole('img', { name: '已完成' });
  expect(icon).toBeInTheDocument();
  expect(icon).toHaveAttribute('tabIndex', '0');
});
```

---

## 開發服務器資訊

- **命令**: `pnpm run dev`
- **URL**: http://localhost:3168
- **編譯狀態**: ✅ 成功（1510 modules）
- **錯誤**: 無

## 下一步

完成 Phase 1 和 Phase 2 測試後：

1. 記錄所有發現的問題
2. 修復任何 bug
3. 確認所有功能符合提案需求
4. 繼續 Phase 3: WYSIWYG Editor 實作
