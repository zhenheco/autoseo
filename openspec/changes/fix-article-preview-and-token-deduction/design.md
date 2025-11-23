# Design: 修復文章預覽與 Token 扣除 + npm→pnpm 幽靈依賴處理

## 1. 架構概覽

### 當前流程

```
用戶請求生成文章
    ↓
/api/articles/generate (檢查餘額，建立 job)
    ↓
GitHub Actions: process-jobs.ts
    ↓
ParallelOrchestrator.execute()
    ↓
多個 Agents 並行執行
    ↓
存儲到 generated_articles
    ↓
❌ Token 沒有扣除！
```

### 修復後流程

```
用戶請求生成文章
    ↓
/api/articles/generate (檢查餘額，建立 job)
    ↓
GitHub Actions: process-jobs.ts
    ↓
ParallelOrchestrator.execute()
    ↓
多個 Agents 並行執行
    ↓
存儲到 generated_articles
    ↓
✅ deductTokensIdempotent() (扣除實際消耗)
    ↓
更新 job status = 'completed'
```

## 2. Token 扣除設計

### 2.1 扣除時機

**選擇：文章生成完成後扣除**

理由：

1. 可以計算實際消耗的 token 量（更精確）
2. 避免預扣後生成失敗需要退款的複雜邏輯
3. Idempotency 確保不會重複扣除

### 2.2 Idempotency Key 設計

```typescript
const idempotencyKey = `article-generation-${articleJobId}`;
```

- 使用 `articleJobId` 確保唯一性
- 即使 job 重試，也不會重複扣除
- 資料庫 `token_balance_changes` 表的 `idempotency_key` 欄位儲存

### 2.3 Token 計算邏輯

**方案 A：累積實際使用量**（理想）

```typescript
interface TokenUsageTracker {
  research: number;
  strategy: number;
  writing: number;
  image: number;
  meta: number;
  html: number;
  total: number;
}
```

**方案 B：使用預設值**（備用）

```typescript
const ESTIMATED_TOKENS_PER_ARTICLE = 15000;
```

**實作建議**：

- 先實作方案 B（簡單快速）
- 後續優化為方案 A（需修改每個 agent 記錄 token 使用量）

### 2.4 錯誤處理

```typescript
try {
  await billingService.deductTokensIdempotent({
    idempotencyKey: `article-generation-${articleJobId}`,
    companyId,
    articleId: savedArticle.id,
    amount: totalTokensUsed || ESTIMATED_TOKENS_PER_ARTICLE,
    metadata: {
      modelName: "multi-agent",
      articleTitle: input.title,
    },
  });
} catch (error) {
  // ⚠️ 不阻止文章完成
  console.error("[Orchestrator] Token 扣除失敗:", error);
  await this.errorTracker.trackError(error, {
    phase: "token-deduction",
    articleJobId,
  });
  // 繼續完成流程，後續可手動補扣
}
```

## 3. 文章預覽顯示修復

### 3.1 問題診斷

可能的根因：

1. **HTMLAgent 輸出格式錯誤**

   ```typescript
   // 錯誤示例（Markdown）
   "![alt](https://url.com/image.jpg)";

   // 正確示例（HTML）
   "<img src='https://url.com/image.jpg' alt='alt' />";
   ```

2. **資料庫儲存問題**
   - `html_content` 欄位可能儲存 Markdown 而非 HTML

3. **前端渲染問題**
   - DOMPurify 過濾掉了 `<img>` 標籤
   - 或 CSS 隱藏了圖片

### 3.2 修復策略

#### 策略 1：修正 HTMLAgent 輸出

```typescript
// src/lib/agents/html-agent.ts
class HTMLAgent {
  async execute(markdownContent: string): Promise<string> {
    // 確保 Markdown 圖片轉換為 HTML
    let html = markdownContent.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1" loading="lazy" />',
    );

    // 使用 markdown-it 或其他工具轉換
    // ...

    return html;
  }
}
```

#### 策略 2：改用 ArticleHtmlPreview 組件

```tsx
// src/app/(dashboard)/dashboard/articles/page.tsx
import { ArticleHtmlPreview } from "@/components/article/ArticleHtmlPreview";

// 替換 dangerouslySetInnerHTML
<ArticleHtmlPreview htmlContent={selectedArticle.html_content || ""} />;
```

好處：

- 統一使用安全淨化邏輯
- 已配置正確的 DOMPurify 設定
- 可重用性高

## 4. npm → pnpm 幽靈依賴問題

### 4.1 什麼是幽靈依賴？

**定義**：專案代碼 import 了沒有在 `package.json` 中聲明的套件，但在 npm 的 `node_modules` 平鋪結構中可以訪問到。

**範例**：

```json
// package.json
{
  "dependencies": {
    "next": "^15.0.0" // next 依賴 react
  }
}
```

```typescript
// 代碼中直接 import（幽靈依賴）
import React from "react"; // ❌ 沒有在 dependencies 中聲明
```

在 npm 中可能運作正常（因為 next 安裝了 react），但在 pnpm 的嚴格模式下會失敗！

### 4.2 診斷幽靈依賴

**方法 1：使用 pnpm 的嚴格模式**

```bash
# 刪除 node_modules 和 lockfile
rm -rf node_modules pnpm-lock.yaml

# 使用嚴格模式安裝
pnpm install --strict-peer-dependencies
```

**方法 2：檢查 import 語句**

```bash
# 查找所有 import
rg "^import .* from ['\"]([^@./].*)['\"]" src/ --only-matching

# 對比 package.json dependencies
```

**方法 3：使用工具**

```bash
pnpm exec depcheck
```

### 4.3 常見幽靈依賴清單

以下是 Next.js 專案常見的幽靈依賴：

```json
{
  "dependencies": {
    "react": "^18.0.0", // 經常被忘記
    "react-dom": "^18.0.0", // 經常被忘記
    "@types/react": "^18.0.0", // TypeScript 專案必須
    "@types/react-dom": "^18.0.0", // TypeScript 專案必須
    "@types/node": "^20.0.0" // 使用 Node.js API 時
  }
}
```

### 4.3.1 **緊急問題：jsdom/parse5 ESM 錯誤**（✅ 已確認）

**Vercel 錯誤訊息**：

```
Error: require() of ES Module /var/task/node_modules/parse5/dist/index.js
from /var/task/node_modules/jsdom/lib/jsdom/browser/parser/html.js not supported.
```

**根因分析**（已深入調查）：

1. **套件配置錯誤**：
   - `isomorphic-dompurify` 在 **dependencies**（❌ 錯誤）
   - `dompurify` 在 **devDependencies**（❌ 錯誤）

2. **依賴鏈**：

   ```
   isomorphic-dompurify@2.32.0
   └── jsdom@27.2.0
       └── parse5@8.x (ESM 版本)
   ```

3. **ESM/CommonJS 衝突**：
   - `jsdom` 使用 CommonJS `require()` 引入 `parse5`
   - `parse5@8.x` 改為純 ESM 模組
   - Vercel serverless 環境不支援動態 import

4. **為什麼不需要 isomorphic-dompurify**：
   - `ArticleHtmlPreview` **已經是 'use client' 組件**
   - 只在瀏覽器環境運行，不需要 SSR 支援
   - `isomorphic-dompurify` 是多餘的

**影響範圍**（已確認）：

- ✅ 文章列表頁面使用 `DOMPurify` from `isomorphic-dompurify`
- ✅ `html-sanitizer.ts` 使用 `isomorphic-dompurify`
- ✅ Vercel 建置失敗
- ✅ 生產環境無法部署

**解決方案**：

#### 方案 A：鎖定相容版本（推薦，快速修復）

```json
{
  "dependencies": {
    "jsdom": "^24.0.0",
    "parse5": "^7.1.2" // ← 降級到 v7（CommonJS 版本）
  },
  "pnpm": {
    "overrides": {
      "parse5": "^7.1.2" // ← 強制所有套件使用 v7
    }
  }
}
```

#### 方案 B：只在客戶端使用 DOMPurify

```tsx
// src/components/article/ArticleHtmlPreview.tsx
"use client";

import { useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";

export function ArticleHtmlPreview({ htmlContent }: { htmlContent: string }) {
  const sanitizedHTML = useMemo(() => {
    // 只在瀏覽器環境執行
    if (typeof window === "undefined") {
      return htmlContent; // SSR 時直接返回原始 HTML
    }
    return DOMPurify.sanitize(htmlContent, {
      ALLOWED_TAGS: [
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul",
        "ol",
        "li",
        "blockquote",
        "strong",
        "em",
        "a",
        "img",
        "code",
        "pre",
      ],
      ALLOWED_ATTR: ["href", "src", "alt", "title"],
    });
  }, [htmlContent]);

  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  );
}
```

#### 方案 C：替換為純瀏覽器 DOMPurify

```bash
# 移除 isomorphic-dompurify
pnpm remove isomorphic-dompurify jsdom

# 安裝純瀏覽器版本
pnpm add dompurify
pnpm add -D @types/dompurify
```

```tsx
// src/components/article/ArticleHtmlPreview.tsx
"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify"; // ← 只在客戶端運行

export function ArticleHtmlPreview({ htmlContent }: { htmlContent: string }) {
  const sanitizedHTML = useMemo(
    () =>
      DOMPurify.sanitize(htmlContent, {
        ALLOWED_TAGS: [
          "p",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "ul",
          "ol",
          "li",
          "blockquote",
          "strong",
          "em",
          "a",
          "img",
          "code",
          "pre",
        ],
        ALLOWED_ATTR: ["href", "src", "alt", "title"],
      }),
    [htmlContent],
  );

  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  );
}
```

**✅ 推薦方案：方案 C（已調查確認可行）**

**執行步驟**：

```bash
# 1. 移除 isomorphic-dompurify
pnpm remove isomorphic-dompurify

# 2. 將 dompurify 移到 dependencies
pnpm remove -D dompurify
pnpm add dompurify

# 3. 確認 @types/dompurify 也在 dependencies（或 devDependencies 也可）
pnpm add -D @types/dompurify
```

**需要更新的檔案**：

1. `src/lib/security/html-sanitizer.ts:6`

   ```typescript
   - import DOMPurify from 'isomorphic-dompurify'
   + import DOMPurify from 'dompurify'
   ```

2. `src/app/(dashboard)/dashboard/articles/page.tsx:4`
   ```typescript
   - import DOMPurify from 'isomorphic-dompurify'
   + import DOMPurify from 'dompurify'
   ```

**驗證步驟**：

1. ✅ `pnpm run build` 成功
2. ✅ Vercel 建置成功
3. ✅ 文章預覽正常顯示（無 parse5 錯誤）

### 4.4 修復策略

#### 步驟 1：移除 npm 殘留

```bash
# 移除 npm lockfile
rm -f package-lock.json

# 確保 .gitignore 包含
echo "package-lock.json" >> .gitignore
echo "node_modules/" >> .gitignore
```

#### 步驟 2：使用 pnpm 重新安裝

```bash
# 清理
rm -rf node_modules

# 重新安裝
pnpm install
```

#### 步驟 3：修復幽靈依賴錯誤

如果出現錯誤：

```
Error: Cannot find module 'xxx'
```

解決：

```bash
pnpm add xxx
```

#### 步驟 4：更新 Vercel 設定

**在 Vercel Dashboard**：

1. 前往 Project Settings
2. Build & Development Settings
3. Package Manager: 選擇 `pnpm`
4. Install Command: `pnpm install`
5. Build Command: `pnpm run build`

**或使用 vercel.json**：

```json
{
  "buildCommand": "pnpm run build",
  "installCommand": "pnpm install"
}
```

### 4.5 驗證清單

- [ ] 移除 `package-lock.json`
- [ ] `.gitignore` 包含 `package-lock.json`
- [ ] 只存在 `pnpm-lock.yaml`
- [ ] `pnpm install` 無錯誤
- [ ] `pnpm run build` 成功
- [ ] GitHub Actions 使用 pnpm
- [ ] Vercel 設定為 pnpm
- [ ] 執行 `depcheck` 無幽靈依賴

## 5. 資料庫 Schema 確認

### 5.1 必要欄位檢查

```sql
-- generated_articles 表
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'generated_articles'
  AND column_name IN ('id', 'html_content', 'markdown_content');

-- token_usage_logs 表
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'token_usage_logs';

-- token_balance_changes 表（確認 idempotency_key 欄位）
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'token_balance_changes'
  AND column_name = 'idempotency_key';
```

### 5.2 如需新增欄位

```sql
-- 如果 token_balance_changes 缺少 idempotency_key
ALTER TABLE token_balance_changes
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_token_balance_changes_idempotency_key
ON token_balance_changes(idempotency_key);
```

## 6. 測試策略

### 6.1 單元測試

```typescript
// tests/token-deduction.test.ts
describe("Token Deduction", () => {
  it("should deduct tokens after article generation", async () => {
    // 測試 Token 扣除邏輯
  });

  it("should not deduct twice for same article (idempotency)", async () => {
    // 測試冪等性
  });

  it("should handle deduction failure gracefully", async () => {
    // 測試錯誤處理
  });
});
```

### 6.2 整合測試

```bash
# 1. 生成測試文章
pnpm exec tsx scripts/test-article-generation.ts

# 2. 檢查 Token 扣除
psql $DATABASE_URL -c "
  SELECT * FROM token_balance_changes
  WHERE description LIKE '%article-generation%'
  ORDER BY created_at DESC LIMIT 1;
"

# 3. 驗證餘額更新
psql $DATABASE_URL -c "
  SELECT monthly_quota_balance, purchased_token_balance
  FROM company_subscriptions
  WHERE company_id = 'test-company-id';
"
```

### 6.3 E2E 測試

使用 Chrome DevTools skill 測試前端：

```typescript
// 測試腳本
1. 登入系統
2. 前往文章管理頁面
3. 生成新文章
4. 確認預覽顯示正確（含圖片）
5. 確認 Token 餘額減少
6. 檢查 Console 無錯誤
```

## 7. 部署計劃

### 7.1 部署前檢查

```bash
# 1. 本地測試
pnpm run build
pnpm run typecheck
pnpm run lint

# 2. 資料庫遷移（如需要）
psql $DATABASE_URL -f migrations/xxx.sql

# 3. 環境變數檢查
# 確認 Vercel 環境變數完整
```

### 7.2 灰度發布

1. **Phase 1**: 部署到 Preview 環境測試
2. **Phase 2**: 生成 1-2 篇測試文章
3. **Phase 3**: 確認 Token 正確扣除
4. **Phase 4**: 部署到 Production

### 7.3 監控指標

部署後監控：

- Token 扣除成功率
- 文章預覽載入錯誤率
- GitHub Actions 執行時間
- Vercel build 成功率
- Console 錯誤數量

## 8. 回滾計劃

如果出現問題：

```bash
# 1. 立即回滾部署
vercel rollback

# 2. 檢查錯誤日誌
vercel logs

# 3. 修復問題
# 根據日誌定位問題

# 4. 重新部署
git commit --amend
git push --force
```

## 總結

這個設計涵蓋：

1. ✅ Token 扣除邏輯整合到 Orchestrator
2. ✅ 文章預覽顯示修復策略
3. ✅ npm → pnpm 幽靈依賴完整處理方案
4. ✅ 資料庫 Schema 驗證
5. ✅ 測試與部署計劃

重點關注：

- **Idempotency** 避免重複扣除
- **幽靈依賴** 完整清理和驗證
- **錯誤處理** 不阻止文章完成
- **監控** 確保上線後穩定運行
