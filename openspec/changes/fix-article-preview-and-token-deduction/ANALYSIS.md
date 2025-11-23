# 深度問題分析報告

## 執行日期

2025-11-14

## 問題調查摘要

經過深入調查，我確認了以下關鍵問題和根本原因：

---

## 問題 1: 文章預覽顯示異常

### 用戶回報

文章列表頁面右側預覽區域顯示 Markdown 連結格式（`https://...`）而非渲染後的 HTML 圖片。

### 調查發現

#### ✅ 內容生成流程正常

1. **ContentAssemblerAgent** (src/lib/agents/content-assembler-agent.ts:83-104)
   - 使用 `marked.parse()` 將 Markdown 轉換為 HTML
   - 返回的 `html` 欄位應該是正確的 HTML 格式
   - **結論：生成的 html_content 應該已經是 HTML**

2. **HTMLAgent** (src/lib/agents/html-agent.ts)
   - 接收 HTML 輸入
   - 使用 linkedom 進行 DOM 操作（插入內部連結、優化圖片等）
   - 返回 `body.innerHTML`
   - **結論：HTMLAgent 不是問題來源**

#### ⚠️ 前端顯示可能的問題

**當前實作** (src/app/(dashboard)/dashboard/articles/page.tsx:315-331)：

```tsx
<div
  className="prose..."
  dangerouslySetInnerHTML={{
    __html: DOMPurify.sanitize(selectedArticle.html_content || '<p>內容載入中...</p>', {
      ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                    'ul', 'ol', 'li', 'blockquote', 'strong',
                    'em', 'a', 'img', ...],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class',
                    'target', 'rel', 'width', 'height'],
    }),
  }}
/>
```

**問題可能來源**：

1. 資料庫中的 `html_content` 實際儲存的是 Markdown（需要用戶確認）
2. DOMPurify 配置可能過濾掉了某些屬性
3. CSS 可能隱藏了圖片

**❗ 無法本地驗證**：

- 本地環境無法直接連接資料庫
- 需要用戶提供實際的 `html_content` 樣本來確認格式

### 建議診斷步驟

用戶應執行以下查詢確認資料庫內容：

```sql
SELECT
  id,
  title,
  SUBSTRING(html_content, 1, 500) as html_preview,
  SUBSTRING(markdown_content, 1, 500) as md_preview
FROM generated_articles
ORDER BY created_at DESC
LIMIT 1;
```

**預期結果**：

- 如果 `html_preview` 顯示 `<img src="...">` → HTML 正確，問題在前端
- 如果 `html_preview` 顯示 `![alt](url)` → Markdown 格式，問題在生成階段

---

## 問題 2: Token 未扣除

### 用戶回報

文章生成完成後，Token 餘額沒有相應減少，導致用戶無法準確追蹤用量。

### 調查發現

#### ✅ Token 扣除服務已實作

**TokenBillingService** (src/lib/billing/token-billing-service.ts)：

- ✅ `completeWithBilling()` - 已實作（用於即時 AI 調用）
- ✅ `deductTokensIdempotent()` - 已實作（支援冪等性）
- ✅ `checkTokenBalance()` - 已實作（餘額檢查）
- ✅ `getCurrentBalance()` - 已實作（查詢餘額）

#### ❌ **關鍵問題：沒有在文章完成時調用扣除邏輯**

**當前流程** (scripts/process-jobs.ts:70-92)：

```typescript
1. orchestrator = new ParallelOrchestrator(supabase)
2. await orchestrator.execute({...})
3. 文章生成完成，儲存到 generated_articles
4. ❌ **沒有調用 Token 扣除**
5. job status 更新為 'completed'
```

**API 階段的餘額檢查** (src/app/api/articles/generate/route.ts:84-101)：

```typescript
const billingService = new TokenBillingService(supabase);
const balance = await billingService.getCurrentBalance(membership.company_id);

if (balance.total < ESTIMATED_TOKENS_PER_ARTICLE) {
  return NextResponse.json(
    {
      error: "Insufficient balance",
      // ...
    },
    { status: 402 },
  );
}
```

**結論**：

- ✅ 建立 job 前有「餘額檢查」（估算）
- ❌ 文章完成後沒有「實際扣除」
- ❌ TokenBillingService 已經實作但未整合到 Orchestrator

### 解決方案

需要在 `ParallelOrchestrator.execute()` 完成後調用：

```typescript
// 在 orchestrator.ts 的 execute() 方法末尾
try {
  const billingService = new TokenBillingService(supabase);
  await billingService.deductTokensIdempotent({
    idempotencyKey: `article-generation-${input.articleJobId}`,
    companyId: input.companyId,
    articleId: savedArticle.id,
    amount: ESTIMATED_TOKENS_PER_ARTICLE, // 或累積的實際用量
    metadata: {
      modelName: "multi-agent",
      articleTitle: input.title,
    },
  });
} catch (error) {
  console.error("[Orchestrator] Token 扣除失敗:", error);
  // 不阻止文章完成
}
```

---

## 問題 3: npm → pnpm 幽靈依賴與 Vercel ESM 錯誤

### 用戶回報 Vercel 錯誤

```
Error: require() of ES Module /var/task/node_modules/parse5/dist/index.js
from /var/task/node_modules/jsdom/lib/jsdom/browser/parser/html.js not supported.
```

### 調查發現

#### ✅ Lockfile 狀態正常

```bash
$ ls -la | grep -E "package-lock|pnpm-lock"
-rw-r--r-- pnpm-lock.yaml  # ✅ 只有 pnpm lockfile
```

#### ❌ **關鍵問題：DOMPurify 套件配置錯誤**

**當前依賴狀態**：

```json
{
  "dependencies": {
    "isomorphic-dompurify": "^2.32.0" // ❌ 在生產環境
  },
  "devDependencies": {
    "dompurify": "^3.3.0" // ❌ 在開發環境
  }
}
```

**依賴鏈分析**：

```
isomorphic-dompurify@2.32.0
└── jsdom@27.2.0
    └── parse5@8.x (ESM 版本)
```

**問題根源**：

1. `isomorphic-dompurify` 是為了支援 SSR（Server-Side Rendering）
2. 它依賴 `jsdom` 來模擬瀏覽器環境
3. `jsdom` 使用 CommonJS `require()` 引入 `parse5`
4. 但 `parse5@8.x` 改為純 ESM 模組
5. → Vercel serverless 環境不支援這種混合模式

**為什麼會有兩個 DOMPurify？**

- 開發者可能想要在本地使用純瀏覽器版本（`dompurify`）
- 但忘記將其移到 dependencies
- 同時保留了 `isomorphic-dompurify` 用於 SSR

#### ✅ **組件已經是客戶端**

**ArticleHtmlPreview** (src/components/article/ArticleHtmlPreview.tsx:1)：

```tsx
"use client"; // ✅ 已標記為客戶端組件

import { sanitizeArticleHtml } from "@/lib/security/html-sanitizer";
```

**html-sanitizer.ts** (src/lib/security/html-sanitizer.ts:6)：

```typescript
import DOMPurify from "isomorphic-dompurify"; // ❌ 應該使用 dompurify
```

**結論**：

- 組件已經是 'use client'，不需要 SSR 支援
- 應該使用純瀏覽器版本的 `dompurify`
- `isomorphic-dompurify` 是多餘的且導致 Vercel 錯誤

### 解決方案

#### 步驟 1：移除 isomorphic-dompurify

```bash
pnpm remove isomorphic-dompurify
```

#### 步驟 2：將 dompurify 移到 dependencies

```bash
pnpm remove -D dompurify
pnpm add dompurify
```

#### 步驟 3：更新所有 import 語句

```typescript
// src/lib/security/html-sanitizer.ts
- import DOMPurify from 'isomorphic-dompurify'
+ import DOMPurify from 'dompurify'

// src/app/(dashboard)/dashboard/articles/page.tsx
- import DOMPurify from 'isomorphic-dompurify'
+ import DOMPurify from 'dompurify'
```

#### 步驟 4：驗證沒有其他幽靈依賴

```bash
pnpm exec depcheck
```

---

## 其他發現

### ✅ GitHub Actions 已使用 pnpm

**process-article-jobs.yml**：

```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v2
  with:
    version: 9

- name: Install dependencies
  run: pnpm install --frozen-lockfile
```

### ⚠️ Vitest 也依賴 jsdom（但這沒問題）

```
devDependencies:
  vitest@4.0.8
  └── jsdom@27.2.0 peer
```

這是 **devDependency**，不會影響生產環境。

---

## 優先級建議

### 🔴 **緊急修復**（影響生產環境）

1. **修復 Vercel ESM 錯誤**（最高優先）
   - 移除 `isomorphic-dompurify`
   - 使用純瀏覽器版本 `dompurify`
   - 更新所有 import 語句
   - **預計修復時間**：15 分鐘
   - **風險**：低（只是替換套件）

### 🟡 **重要修復**（影響用戶體驗）

2. **實作 Token 扣除邏輯**
   - 在 `ParallelOrchestrator.execute()` 整合 `deductTokensIdempotent()`
   - 測試 idempotency 機制
   - **預計修復時間**：30-45 分鐘
   - **風險**：中（需要小心處理 idempotency）

3. **確認並修復文章預覽顯示**
   - **需要用戶提供資料庫樣本**
   - 確認 `html_content` 實際格式
   - 如果是 HTML，可能只需調整前端顯示
   - 如果是 Markdown，需要修復生成流程
   - **預計修復時間**：取決於根本原因（15-60 分鐘）
   - **風險**：低到中

### 🟢 **預防性維護**

4. **執行完整的幽靈依賴檢查**
   - 使用 `depcheck` 掃描
   - 檢查所有 import 語句
   - 確認所有套件都在 `package.json` 中聲明
   - **預計時間**：20 分鐘
   - **風險**：低

---

## 需要用戶提供的資訊

為了完成文章預覽問題的診斷，需要：

1. **資料庫查詢結果**：

   ```sql
   SELECT
     id,
     title,
     SUBSTRING(html_content, 1, 500) as html_preview,
     SUBSTRING(markdown_content, 1, 500) as md_preview
   FROM generated_articles
   ORDER BY created_at DESC
   LIMIT 1;
   ```

2. **截圖或描述**：
   - 文章預覽實際顯示的內容
   - 是否看到任何 HTML 標籤或只看到純文字/URL

3. **瀏覽器 Console 錯誤**（如果有）：
   - 打開開發者工具（F12）
   - 查看 Console 標籤
   - 複製任何錯誤訊息

---

## 建議的執行順序

### Phase 1: 立即修復 Vercel 錯誤（15 分鐘）

1. 移除 `isomorphic-dompurify`
2. 將 `dompurify` 移到 dependencies
3. 更新所有 import 語句
4. 測試本地建置
5. 部署到 Vercel 驗證

### Phase 2: 等待用戶資訊（同時進行）

1. 請用戶提供資料庫查詢結果
2. 請用戶提供預覽顯示截圖
3. 請用戶檢查瀏覽器 Console

### Phase 3: 實作 Token 扣除（30-45 分鐘）

1. 修改 `ParallelOrchestrator.execute()`
2. 整合 `deductTokensIdempotent()`
3. 添加錯誤處理
4. 本地測試
5. 部署驗證

### Phase 4: 根據用戶資訊修復預覽（15-60 分鐘）

1. 分析資料庫內容格式
2. 確定根本原因
3. 實作修復
4. 測試驗證

### Phase 5: 完整測試與文件更新（20 分鐘）

1. 執行 `depcheck` 檢查幽靈依賴
2. 更新 CLAUDE.md
3. 更新 OpenSpec 文件
4. 標記變更為已完成

---

## 總結

### 已確認的問題

1. ✅ **Vercel ESM 錯誤**：`isomorphic-dompurify` → `jsdom` → `parse5` 依賴鏈導致
2. ✅ **Token 未扣除**：Orchestrator 沒有調用 `deductTokensIdempotent()`
3. ⚠️ **文章預覽顯示**：需要用戶提供資料庫內容確認

### 已準備好的解決方案

1. ✅ 替換 DOMPurify 套件（清晰明確）
2. ✅ 整合 Token 扣除邏輯（已有服務可用）
3. ⚠️ 文章預覽修復（取決於根本原因）

### 風險評估

- **低風險**：DOMPurify 替換、Token 扣除整合
- **中風險**：文章預覽修復（取決於資料庫內容）
- **已緩解**：pnpm 遷移完成，lockfile 乾淨

### 預計總修復時間

- **最小**：1 小時（如果預覽問題簡單）
- **最大**：2.5 小時（如果預覽問題複雜）
