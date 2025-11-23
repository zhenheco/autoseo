# 設計文件

## 技術架構決策

### 1. HTML 預覽安全性設計

#### 選擇的解決方案：伺服器端 + 客戶端雙重淨化

**決策理由**：

- OWASP 建議在前後端都實施淨化層，提供縱深防禦（Defense in Depth）
- 即使一層失效，另一層仍能提供保護
- 符合現代 Web 安全最佳實踐

**實作策略**：

```typescript
// Server-side: 文章生成時淨化 HTML
import DOMPurify from 'isomorphic-dompurify'

export async function sanitizeArticleHTML(rawHTML: string): Promise<string> {
  return DOMPurify.sanitize(rawHTML, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'strong', 'em', 'u', 'a',
      'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
      'img', 'figure', 'figcaption'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class',
      'target', 'rel', 'width', 'height'
    ],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'], // 允許外部連結在新視窗開啟
    ADD_URI_SAFE_ATTR: ['src', 'href'],
  })
}

// Client-side: 預覽顯示時額外淨化
'use client'
import DOMPurify from 'isomorphic-dompurify'
import { useMemo } from 'react'

export function ArticlePreview({ htmlContent }: { htmlContent: string }) {
  const sanitizedHTML = useMemo(
    () => DOMPurify.sanitize(htmlContent),
    [htmlContent]
  )

  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  )
}
```

**安全性加固**：

1. **Content Security Policy (CSP)**

   ```typescript
   // next.config.ts
   const cspHeader = `
     default-src 'self';
     script-src 'self' 'unsafe-inline' 'unsafe-eval';
     style-src 'self' 'unsafe-inline';
     img-src 'self' https://drive.google.com https://*.googleusercontent.com blob: data:;
     font-src 'self';
     object-src 'none';
     base-uri 'self';
     form-action 'self';
     frame-ancestors 'none';
   `;
   ```

2. **X-Content-Type-Options Header**

   ```typescript
   // 防止 MIME 類型嗅探
   headers: [
     {
       key: "X-Content-Type-Options",
       value: "nosniff",
     },
   ];
   ```

3. **圖片來源驗證**

   ```typescript
   // 只允許信任的圖片來源
   const TRUSTED_IMAGE_SOURCES = [
     "https://drive.google.com",
     "https://lh3.googleusercontent.com",
   ];

   function validateImageURL(url: string): boolean {
     return TRUSTED_IMAGE_SOURCES.some((source) => url.startsWith(source));
   }
   ```

#### 替代方案及其缺點

**方案 A：只使用客戶端淨化**

- ❌ 缺點：如果客戶端 JavaScript 被繞過，XSS 仍可能發生
- ❌ 缺點：增加客戶端計算負擔

**方案 B：使用 Next.js 內建的 React 組件渲染**

- ❌ 缺點：需要將 HTML 解析為 React 組件樹，複雜度高
- ❌ 缺點：可能無法完整保留 AI 生成的 HTML 結構

**方案 C：完全不淨化，信任 AI 生成內容**

- ❌ 重大安全風險：AI 可能被操縱生成惡意代碼
- ❌ 違反安全最佳實踐

### 2. Token 計費系統設計

#### 冪等性設計（Idempotency Design）

**核心問題**：

- 網路重試可能導致重複扣款
- 系統錯誤可能導致部分失敗（文章生成成功但扣款失敗）
- 需要確保「至多一次」（at-most-once）扣款保證

**解決方案：Idempotency Key + 交易狀態追蹤**

```typescript
interface TokenDeductionRecord {
  id: string; // UUID
  idempotency_key: string; // 由 article_job_id 生成
  company_id: string;
  article_id: string | null;
  amount: number;
  status: "pending" | "completed" | "failed" | "compensated";
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export class IdempotentTokenBillingService {
  /**
   * 扣除 Token，確保冪等性
   */
  async deductTokensIdempotent(params: {
    idempotencyKey: string;
    companyId: string;
    articleId: string | null;
    amount: number;
    metadata: Record<string, unknown>;
  }): Promise<TokenDeductionResult> {
    // 1. 檢查是否已處理過此請求
    const existingRecord = await this.findByIdempotencyKey(
      params.idempotencyKey,
    );

    if (existingRecord) {
      if (existingRecord.status === "completed") {
        // 已完成，返回先前的結果
        return {
          success: true,
          deductionId: existingRecord.id,
          balanceAfter: existingRecord.balance_after,
          isDuplicate: true,
        };
      } else if (existingRecord.status === "pending") {
        // 正在處理中，拒絕重複請求
        throw new Error("Deduction already in progress");
      }
      // 'failed' 狀態允許重試
    }

    // 2. 建立待處理記錄
    const deductionRecord = await this.createPendingRecord(params);

    try {
      // 3. 使用資料庫事務確保原子性
      const result = await this.supabase.rpc("deduct_tokens_atomic", {
        p_company_id: params.companyId,
        p_amount: params.amount,
        p_deduction_id: deductionRecord.id,
      });

      if (!result.success) {
        throw new Error(result.error || "Insufficient balance");
      }

      // 4. 標記為完成
      await this.markAsCompleted(deductionRecord.id, result.balance_after);

      return {
        success: true,
        deductionId: deductionRecord.id,
        balanceAfter: result.balance_after,
        isDuplicate: false,
      };
    } catch (error) {
      // 5. 記錄失敗狀態
      await this.markAsFailed(deductionRecord.id, error.message);
      throw error;
    }
  }
}
```

**資料庫儲存程序（PostgreSQL Function）**：

```sql
CREATE OR REPLACE FUNCTION deduct_tokens_atomic(
  p_company_id UUID,
  p_amount INTEGER,
  p_deduction_id UUID
) RETURNS jsonb AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- 1. 鎖定公司訂閱記錄（防止併發扣款）
  SELECT
    COALESCE(monthly_quota_balance, 0) + COALESCE(purchased_token_balance, 0)
  INTO v_current_balance
  FROM company_subscriptions
  WHERE company_id = p_company_id
    AND status = 'active'
  FOR UPDATE; -- 重要：行級鎖定

  -- 2. 檢查餘額
  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient token balance'
    );
  END IF;

  -- 3. 扣除 Token（優先使用 monthly_quota_balance）
  UPDATE company_subscriptions
  SET
    monthly_quota_balance = CASE
      WHEN monthly_quota_balance >= p_amount
      THEN monthly_quota_balance - p_amount
      ELSE 0
    END,
    purchased_token_balance = CASE
      WHEN monthly_quota_balance >= p_amount
      THEN purchased_token_balance
      ELSE purchased_token_balance - (p_amount - monthly_quota_balance)
    END,
    updated_at = NOW()
  WHERE company_id = p_company_id
    AND status = 'active'
  RETURNING
    COALESCE(monthly_quota_balance, 0) + COALESCE(purchased_token_balance, 0)
  INTO v_new_balance;

  -- 4. 記錄使用日誌
  INSERT INTO token_usage_logs (
    id,
    company_id,
    deduction_id,
    token_amount,
    balance_before,
    balance_after,
    created_at
  ) VALUES (
    gen_random_uuid(),
    p_company_id,
    p_deduction_id,
    p_amount,
    v_current_balance,
    v_new_balance,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'balance_after', v_new_balance
  );
END;
$$ LANGUAGE plpgsql;
```

#### 重試策略（Retry Strategy）

**指數退避（Exponential Backoff）**：

```typescript
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
  } = {},
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // 不可重試的錯誤（如餘額不足）
      if (error.message.includes("Insufficient balance")) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delayMs = Math.min(
          initialDelayMs * Math.pow(backoffMultiplier, attempt),
          maxDelayMs,
        );

        console.log(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms`,
        );
        await sleep(delayMs);
      }
    }
  }

  throw lastError!;
}
```

#### 對帳機制（Reconciliation）

**定期檢查未完成的扣款**：

```typescript
// 每小時執行一次
export async function reconcileStuckDeductions() {
  // 1. 找出超過 1 小時仍在 pending 的記錄
  const stuckRecords = await supabase
    .from("token_deduction_records")
    .select("*")
    .eq("status", "pending")
    .lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  for (const record of stuckRecords.data || []) {
    // 2. 檢查文章是否實際生成
    const article = await supabase
      .from("generated_articles")
      .select("id")
      .eq("id", record.article_id)
      .single();

    if (article.data) {
      // 文章存在但扣款卡住 → 重試扣款
      console.log(`Retrying stuck deduction: ${record.id}`);
      await retryDeduction(record.id);
    } else {
      // 文章不存在 → 標記為失敗
      console.log(`Marking failed deduction: ${record.id}`);
      await markAsFailed(record.id, "Article generation failed");
    }
  }
}
```

### 3. 移除批次清除功能

**決策**：完全移除而非修復

**理由**：

1. 功能複雜度高，修復成本高於價值
2. 使用者很少需要批次清除（通常是逐個檢視和刪除）
3. 可能導致誤操作（不小心清除重要任務）
4. 簡化 UI，降低認知負擔

**影響範圍**：

- 移除前端按鈕和事件處理
- 刪除 API 路由 `/api/articles/jobs/clear`
- 清理相關 TypeScript 類型定義

## 資料流程圖

### 文章預覽流程

```
使用者點擊「預覽」
    ↓
載入文章資料（含 html_content）
    ↓
伺服器端檢查（已在生成時淨化）
    ↓
客戶端 useMemo 淨化（雙重保護）
    ↓
dangerouslySetInnerHTML 渲染
    ↓
CSP 防護（執行階段）
```

### Token 扣款流程

```
文章生成請求
    ↓
生成 idempotency_key (= article_job_id)
    ↓
檢查是否已處理（by idempotency_key）
    ├─ 已完成 → 返回先前結果
    ├─ 處理中 → 拒絕重複請求
    └─ 未處理/失敗 → 繼續
         ↓
    建立 pending 記錄
         ↓
    資料庫事務：檢查餘額 + 扣款 + 寫日誌
         ├─ 成功 → 標記 completed
         └─ 失敗 → 標記 failed + 重試（最多3次）
              ↓
    更新 Dashboard 顯示
```

## 效能考量

1. **HTML 淨化快取**：使用 `useMemo` 避免每次渲染都淨化
2. **資料庫索引**：在 `token_deduction_records.idempotency_key` 加上唯一索引
3. **行級鎖定**：使用 `FOR UPDATE` 防止併發扣款
4. **批次查詢**：Dashboard 使用 JOIN 一次性取得餘額和使用記錄

## 監控指標

1. **安全指標**：
   - XSS 攻擊嘗試次數（CSP 違規報告）
   - 淨化被觸發的次數

2. **計費指標**：
   - 扣款成功率
   - 扣款延遲（P50, P95, P99）
   - 重試次數分佈
   - 卡住的扣款數量

3. **使用者體驗指標**：
   - 預覽頁面載入時間
   - 餘額不足錯誤頻率
