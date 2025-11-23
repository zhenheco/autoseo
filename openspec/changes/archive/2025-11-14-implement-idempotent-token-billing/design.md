# 設計文件：冪等性 Token 計費系統

## 架構概覽

本設計實作基於 idempotency key 的 Token 計費系統，參考 **Stripe/PayPal** 的最佳實踐，確保同一次文章生成操作只扣款一次，即使發生網路重試或系統錯誤。

### 設計原則（來自業界最佳實踐）

1. **Stripe 模式**：使用 UUID idempotency key + 24 小時結果快取
2. **PostgreSQL 原子性**：所有操作在單一事務中，失敗自動回滾
3. **FOR UPDATE 鎖定**：防止併發 race condition
4. **狀態機模式**：pending → completed/failed，清晰的狀態轉換

### 核心組件

1. **token_deduction_records 表**：扣款記錄和狀態追蹤（參考 Stripe 的 idempotency 表）
2. **deduct_tokens_atomic PostgreSQL 函數**：原子性扣款操作（解決現有代碼的 4 個獨立操作問題）
3. **TokenBillingService.deductTokensIdempotent()**：冪等性扣款方法
4. **Retry Logic**：指數退避重試邏輯（1s, 2s, 4s）
5. **Reconciliation Script**：對帳機制處理卡住的記錄

### 現有代碼問題修復對照表

| 問題       | 現有代碼         | 新設計                      |
| ---------- | ---------------- | --------------------------- |
| 無冪等性   | 每次調用都扣款   | idempotency_key 去重        |
| 非原子性   | 4 個獨立 DB 操作 | PostgreSQL 儲存程序單一事務 |
| 扣款順序錯 | 購買 Token 優先  | 月配額優先（會過期）        |
| 無併發控制 | 沒有鎖定         | FOR UPDATE 鎖定訂閱記錄     |
| 錯誤處理弱 | 沒有重試邏輯     | 指數退避 + 對帳機制         |

---

## 資料庫 Schema

### token_deduction_records 表

```sql
CREATE TABLE token_deduction_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idempotency_key TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES companies(id),
  article_id UUID REFERENCES generated_articles(id),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'compensated')),
  balance_before INTEGER,
  balance_after INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_token_deduction_idempotency ON token_deduction_records(idempotency_key);
CREATE INDEX idx_token_deduction_company ON token_deduction_records(company_id);
CREATE INDEX idx_token_deduction_status ON token_deduction_records(status);
CREATE INDEX idx_token_deduction_created ON token_deduction_records(created_at);
```

**欄位說明**：

- `idempotency_key`: 冪等性金鑰（通常為 article_job_id）
- `status`: 狀態
  - `pending`: 處理中（佔位，防止重複請求）
  - `completed`: 扣款完成
  - `failed`: 扣款失敗（可重試）
  - `compensated`: 已補償（用於對帳後的修正）
- `balance_before/after`: 扣款前後的餘額，用於審計
- `retry_count`: 重試次數，最多 3 次
- `metadata`: 額外資訊（如使用的模型、Token 明細等）

---

## PostgreSQL 儲存程序

### deduct_tokens_atomic 函數

```sql
CREATE OR REPLACE FUNCTION deduct_tokens_atomic(
  p_idempotency_key TEXT,
  p_company_id UUID,
  p_article_id UUID,
  p_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_subscription_id UUID;
  v_monthly_balance INTEGER;
  v_purchased_balance INTEGER;
  v_total_balance INTEGER;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_deducted_from_monthly INTEGER := 0;
  v_deducted_from_purchased INTEGER := 0;
  v_record_id UUID;
BEGIN
  -- 1. 檢查是否已存在扣款記錄（冪等性檢查）
  SELECT id, status, balance_after INTO v_record_id, v_status, v_balance_after
  FROM token_deduction_records
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_status = 'completed' THEN
      -- 已完成，返回原始結果
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'record_id', v_record_id,
        'balance_after', v_balance_after
      );
    ELSIF v_status = 'pending' THEN
      -- 正在處理中，拒絕重複請求
      RAISE EXCEPTION 'Deduction already in progress for idempotency_key: %', p_idempotency_key;
    END IF;
    -- status = 'failed' 則繼續執行，允許重試
  END IF;

  -- 2. 建立 pending 記錄（佔位）
  INSERT INTO token_deduction_records (
    idempotency_key,
    company_id,
    article_id,
    amount,
    status
  ) VALUES (
    p_idempotency_key,
    p_company_id,
    p_article_id,
    p_amount,
    'pending'
  )
  ON CONFLICT (idempotency_key) DO UPDATE
    SET retry_count = token_deduction_records.retry_count + 1
  RETURNING id INTO v_record_id;

  -- 3. 鎖定公司訂閱記錄（FOR UPDATE）
  SELECT
    id,
    monthly_quota_balance,
    purchased_token_balance
  INTO
    v_subscription_id,
    v_monthly_balance,
    v_purchased_balance
  FROM company_subscriptions
  WHERE company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE token_deduction_records
    SET status = 'failed', error_message = 'Subscription not found'
    WHERE id = v_record_id;
    RAISE EXCEPTION 'Subscription not found for company_id: %', p_company_id;
  END IF;

  -- 4. 計算總餘額
  v_total_balance := COALESCE(v_monthly_balance, 0) + COALESCE(v_purchased_balance, 0);
  v_balance_before := v_total_balance;

  -- 5. 檢查餘額是否足夠
  IF v_total_balance < p_amount THEN
    UPDATE token_deduction_records
    SET
      status = 'failed',
      error_message = 'Insufficient balance',
      balance_before = v_balance_before
    WHERE id = v_record_id;
    RAISE EXCEPTION 'Insufficient balance: required %, available %', p_amount, v_total_balance;
  END IF;

  -- 6. 優先從月配額扣除，再從購買的 Token 扣除
  -- 【重要】：修正現有代碼的扣款順序錯誤
  -- 現有代碼：購買 Token 優先（src/lib/billing/token-billing-service.ts:112）
  -- 新設計：月配額優先（會過期），購買的 Token 次之（永久有效）
  IF v_monthly_balance >= p_amount THEN
    -- 情況 1：月配額足夠，全部從月配額扣
    v_deducted_from_monthly := p_amount;
    v_deducted_from_purchased := 0;
  ELSIF v_monthly_balance > 0 THEN
    -- 情況 2：月配額不足，先扣完月配額，再扣購買的 Token
    v_deducted_from_monthly := v_monthly_balance;
    v_deducted_from_purchased := p_amount - v_monthly_balance;
  ELSE
    -- 情況 3：月配額為 0（免費方案），全部從購買的 Token 扣
    v_deducted_from_monthly := 0;
    v_deducted_from_purchased := p_amount;
  END IF;

  -- 7. 更新訂閱餘額
  UPDATE company_subscriptions
  SET
    monthly_quota_balance = monthly_quota_balance - v_deducted_from_monthly,
    purchased_token_balance = purchased_token_balance - v_deducted_from_purchased,
    last_token_deduction_at = NOW()
  WHERE id = v_subscription_id;

  v_balance_after := v_total_balance - p_amount;

  -- 8. 更新扣款記錄為 completed
  UPDATE token_deduction_records
  SET
    status = 'completed',
    balance_before = v_balance_before,
    balance_after = v_balance_after,
    completed_at = NOW(),
    metadata = jsonb_build_object(
      'deducted_from_monthly', v_deducted_from_monthly,
      'deducted_from_purchased', v_deducted_from_purchased
    )
  WHERE id = v_record_id;

  -- 9. 插入 token_usage_logs（保持現有的審計邏輯）
  -- 這部分在應用層處理，避免儲存程序過於複雜

  -- 10. 返回成功結果
  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'record_id', v_record_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'deducted_from_monthly', v_deducted_from_monthly,
    'deducted_from_purchased', v_deducted_from_purchased
  );
END;
$$;
```

**設計要點**：

1. **冪等性檢查**：函數開始時檢查 idempotency_key
2. **Pending 佔位**：建立 pending 記錄防止併發請求
3. **FOR UPDATE 鎖定**：確保同一時間只有一個事務能修改訂閱
4. **原子性**：所有操作在同一個事務中，失敗則全部回滾
5. **優先順序**：優先從月配額扣除，再從購買的 Token 扣除
6. **審計追蹤**：記錄 balance_before/after 和詳細 metadata

---

## 應用層實作

### TokenBillingService.deductTokensIdempotent()

```typescript
// src/lib/billing/token-billing-service.ts

interface DeductTokensIdempotentParams {
  idempotencyKey: string;
  companyId: string;
  articleId?: string;
  amount: number;
  metadata?: {
    modelName?: string;
    articleTitle?: string;
    [key: string]: any;
  };
}

interface DeductTokensResult {
  success: boolean;
  idempotent: boolean; // true 表示是重複請求
  recordId: string;
  balanceBefore: number;
  balanceAfter: number;
  deductedFromMonthly: number;
  deductedFromPurchased: number;
}

export class TokenBillingService {
  /**
   * 冪等性 Token 扣款
   *
   * @throws {InsufficientBalanceError} 餘額不足（不可重試）
   * @throws {DeductionInProgressError} 重複請求，正在處理中（不可重試）
   * @throws {DatabaseError} 資料庫錯誤（可重試）
   */
  async deductTokensIdempotent(
    params: DeductTokensIdempotentParams,
  ): Promise<DeductTokensResult> {
    const { idempotencyKey, companyId, articleId, amount, metadata } = params;

    // 使用 Supabase RPC 調用 PostgreSQL 函數
    const { data, error } = await this.supabase.rpc("deduct_tokens_atomic", {
      p_idempotency_key: idempotencyKey,
      p_company_id: companyId,
      p_article_id: articleId || null,
      p_amount: amount,
    });

    if (error) {
      // 區分不同錯誤類型
      if (error.message.includes("Insufficient balance")) {
        throw new InsufficientBalanceError(
          `餘額不足：需要 ${amount} tokens，請升級方案或購買 Token`,
        );
      }
      if (error.message.includes("already in progress")) {
        throw new DeductionInProgressError(
          `扣款正在處理中，請稍後再試（idempotency_key: ${idempotencyKey}）`,
        );
      }
      // 其他錯誤視為暫時性錯誤，可重試
      throw new DatabaseError(error.message);
    }

    // 如果不是冪等性重複請求，記錄到 token_usage_logs
    if (!data.idempotent) {
      await this.logTokenUsage({
        companyId,
        articleId,
        amount,
        recordId: data.record_id,
        metadata,
      });
    }

    return {
      success: data.success,
      idempotent: data.idempotent,
      recordId: data.record_id,
      balanceBefore: data.balance_before,
      balanceAfter: data.balance_after,
      deductedFromMonthly: data.deducted_from_monthly,
      deductedFromPurchased: data.deducted_from_purchased,
    };
  }

  private async logTokenUsage(params: {
    companyId: string;
    articleId?: string;
    amount: number;
    recordId: string;
    metadata?: any;
  }): Promise<void> {
    // 插入 token_usage_logs
    await this.supabase.from("token_usage_logs").insert({
      company_id: params.companyId,
      article_id: params.articleId,
      token_amount: params.amount,
      deduction_record_id: params.recordId,
      usage_type: "article_generation",
      metadata: params.metadata,
    });
  }
}
```

---

## 重試邏輯

### 指數退避重試策略

```typescript
// src/lib/utils/retry.ts

interface RetryOptions {
  maxRetries: number;
  baseDelay: number; // 初始延遲（毫秒）
  maxDelay: number; // 最大延遲（毫秒）
  shouldRetry: (error: Error) => boolean;
}

export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay, shouldRetry } = options;
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // 如果是不可重試的錯誤，直接拋出
      if (!shouldRetry(lastError)) {
        throw lastError;
      }

      // 如果已達最大重試次數，拋出錯誤
      if (attempt === maxRetries) {
        throw new MaxRetriesExceededError(
          `Operation failed after ${maxRetries} retries: ${lastError.message}`,
          lastError,
        );
      }

      // 計算延遲時間（指數退避）
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      console.log(
        `[Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms...`,
        lastError.message,
      );

      // 等待
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// 使用範例
export async function deductTokensWithRetry(
  service: TokenBillingService,
  params: DeductTokensIdempotentParams,
): Promise<DeductTokensResult> {
  return retryWithExponentialBackoff(
    () => service.deductTokensIdempotent(params),
    {
      maxRetries: 3,
      baseDelay: 1000, // 1 秒
      maxDelay: 10000, // 10 秒
      shouldRetry: (error) => {
        // 不重試的錯誤
        if (error instanceof InsufficientBalanceError) return false;
        if (error instanceof DeductionInProgressError) return false;

        // 其他錯誤（如資料庫連接錯誤）可重試
        return true;
      },
    },
  );
}
```

---

## 整合文章生成流程

### 修改 Article Generation Workflow

```typescript
// src/app/api/articles/jobs/route.ts

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { keywords } = await request.json();

  // 1. 檢查 Token 餘額（前置檢查，避免浪費資源）
  const billingService = new TokenBillingService();
  const estimatedTokens = estimateTokensForArticle(keywords);

  const balance = await billingService.getCompanyBalance(
    session.user.companyId,
  );
  if (balance.total < estimatedTokens) {
    return NextResponse.json(
      {
        error: "Insufficient tokens",
        message: `餘額不足。需要約 ${estimatedTokens} tokens，目前餘額 ${balance.total} tokens。`,
        upgradeUrl: "/dashboard/billing/upgrade",
      },
      { status: 402 }, // Payment Required
    );
  }

  // 2. 建立文章任務
  const { data: job } = await supabase
    .from("article_jobs")
    .insert({
      company_id: session.user.companyId,
      user_id: session.user.id,
      keywords,
      status: "pending",
    })
    .select()
    .single();

  // 3. 觸發 GitHub Actions workflow
  await triggerArticleGeneration({
    jobId: job.id,
    keywords,
  });

  return NextResponse.json({ job });
}
```

### GitHub Actions Workflow 修改

```yaml
# .github/workflows/generate-articles.yml

- name: Deduct tokens after generation
  if: success()
  env:
    JOB_ID: ${{ github.event.inputs.job_id }}
    ARTICLE_ID: ${{ steps.generate.outputs.article_id }}
    TOKEN_AMOUNT: ${{ steps.generate.outputs.token_amount }}
  run: |
    node scripts/deduct-tokens.js
```

```javascript
// scripts/deduct-tokens.js

const { createClient } = require("@supabase/supabase-js");

async function main() {
  const jobId = process.env.JOB_ID;
  const articleId = process.env.ARTICLE_ID;
  const tokenAmount = parseInt(process.env.TOKEN_AMOUNT);

  const billingService = new TokenBillingService();

  try {
    const result = await deductTokensWithRetry(billingService, {
      idempotencyKey: jobId, // 使用 job_id 作為冪等性金鑰
      companyId: companyId,
      articleId: articleId,
      amount: tokenAmount,
      metadata: {
        modelName: "gpt-4o-mini",
        articleTitle: articleTitle,
      },
    });

    console.log("Token deduction successful:", result);

    if (result.idempotent) {
      console.log(
        "Note: This was a duplicate request, no additional tokens deducted",
      );
    }
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      console.error("Insufficient balance, marking job as failed");
      // 更新任務狀態為 failed
      await supabase
        .from("article_jobs")
        .update({
          status: "failed",
          error_message: error.message,
        })
        .eq("id", jobId);
    } else {
      console.error("Token deduction failed:", error);
      // 標記為待補扣款
      await supabase
        .from("article_jobs")
        .update({
          metadata: {
            pending_token_deduction: true,
            deduction_error: error.message,
          },
        })
        .eq("id", jobId);
    }
    throw error;
  }
}

main();
```

---

## 對帳機制

### 對帳 Script

```typescript
// scripts/reconcile-token-deductions.ts

/**
 * 對帳卡住的 Token 扣款記錄
 *
 * 執行時機：每小時執行一次（cron job）
 */
async function reconcileStuckDeductions() {
  const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000);

  // 1. 查找超過 1 小時的 pending 記錄
  const { data: stuckRecords } = await supabase
    .from("token_deduction_records")
    .select("*")
    .eq("status", "pending")
    .lt("created_at", ONE_HOUR_AGO.toISOString());

  console.log(`Found ${stuckRecords.length} stuck deduction records`);

  for (const record of stuckRecords) {
    try {
      // 2. 檢查對應的文章是否存在
      const { data: article } = await supabase
        .from("generated_articles")
        .select("id")
        .eq("id", record.article_id)
        .single();

      if (article) {
        // 文章存在，重試扣款
        console.log(`Retrying deduction for record ${record.id}`);

        // 重新調用扣款函數（會因為 idempotency_key 已存在而更新 retry_count）
        await retryStuckDeduction(record);
      } else {
        // 文章不存在，標記為 failed
        console.log(
          `Article not found for record ${record.id}, marking as failed`,
        );

        await supabase
          .from("token_deduction_records")
          .update({
            status: "failed",
            error_message: "Article not found, likely generation failed",
          })
          .eq("id", record.id);
      }
    } catch (error) {
      console.error(`Failed to reconcile record ${record.id}:`, error);
    }
  }
}

async function retryStuckDeduction(record: any) {
  // 使用 idempotency_key 重新調用扣款
  // PostgreSQL 函數會檢測到 pending 狀態並增加 retry_count
  // ... 實作細節
}

// Cron job 設定
if (require.main === module) {
  reconcileStuckDeductions()
    .then(() => console.log("Reconciliation completed"))
    .catch((error) => console.error("Reconciliation failed:", error));
}
```

---

## 前端錯誤處理

### Dashboard 餘額顯示

```typescript
// src/components/billing/TokenBalanceDisplay.tsx

export function TokenBalanceDisplay() {
  const { data: balance, error, isLoading } = useSWR(
    '/api/billing/balance',
    fetcher,
    {
      refreshInterval: 5000, // 每 5 秒刷新一次
    }
  );

  if (error) {
    return <div className="text-red-600">無法載入 Token 餘額</div>;
  }

  if (isLoading) {
    return <Skeleton className="h-8 w-32" />;
  }

  const isLowBalance = balance.total < 1000;

  return (
    <div className="flex items-center gap-2">
      <div className="text-sm">
        <span className="font-semibold">Token 餘額：</span>
        <span className={isLowBalance ? 'text-red-600' : 'text-green-600'}>
          {balance.total.toLocaleString()}
        </span>
      </div>
      {isLowBalance && (
        <Link href="/dashboard/billing/upgrade">
          <Button variant="outline" size="sm">
            升級方案
          </Button>
        </Link>
      )}
    </div>
  );
}
```

### 餘額不足錯誤提示

```typescript
// src/app/(dashboard)/dashboard/articles/page.tsx

async function handleGenerateArticles(keywords: string[]) {
  try {
    const response = await fetch("/api/articles/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords }),
    });

    if (response.status === 402) {
      const { message, upgradeUrl } = await response.json();

      // 顯示友善的錯誤提示
      toast.error(message, {
        action: {
          label: "升級方案",
          onClick: () => router.push(upgradeUrl),
        },
        duration: 10000,
      });
      return;
    }

    if (!response.ok) {
      throw new Error("Failed to create article job");
    }

    const { job } = await response.json();
    toast.success("文章生成任務已建立");
  } catch (error) {
    console.error("Failed to generate articles:", error);
    toast.error("建立任務失敗，請稍後再試");
  }
}
```

---

## 測試策略

### 冪等性測試

```typescript
// tests/token-billing.test.ts

describe("Token Billing Idempotency", () => {
  it("should not deduct tokens twice for the same idempotency key", async () => {
    const service = new TokenBillingService();
    const params = {
      idempotencyKey: "test-job-123",
      companyId: "company-abc",
      amount: 500,
    };

    // 第一次扣款
    const result1 = await service.deductTokensIdempotent(params);
    expect(result1.success).toBe(true);
    expect(result1.idempotent).toBe(false);
    const balanceAfter1 = result1.balanceAfter;

    // 第二次扣款（相同 idempotency key）
    const result2 = await service.deductTokensIdempotent(params);
    expect(result2.success).toBe(true);
    expect(result2.idempotent).toBe(true); // 標記為冪等性重複
    expect(result2.balanceAfter).toBe(balanceAfter1); // 餘額未改變
  });

  it("should reject concurrent requests with pending status", async () => {
    // 模擬併發請求
    const promise1 = service.deductTokensIdempotent(params);
    const promise2 = service.deductTokensIdempotent(params);

    // 其中一個應該成功，另一個應拋出 DeductionInProgressError
    await expect(Promise.all([promise1, promise2])).rejects.toThrow(
      DeductionInProgressError,
    );
  });
});
```

### 原子性測試

```typescript
describe("Token Billing Atomicity", () => {
  it("should rollback on insufficient balance", async () => {
    // 設定公司餘額為 100
    await setCompanyBalance("company-abc", 100);

    // 嘗試扣款 500（餘額不足）
    await expect(
      service.deductTokensIdempotent({
        idempotencyKey: "test-insufficient",
        companyId: "company-abc",
        amount: 500,
      }),
    ).rejects.toThrow(InsufficientBalanceError);

    // 驗證餘額未改變
    const balance = await getCompanyBalance("company-abc");
    expect(balance.total).toBe(100);

    // 驗證記錄狀態為 failed
    const record = await getDeductionRecord("test-insufficient");
    expect(record.status).toBe("failed");
    expect(record.error_message).toContain("Insufficient balance");
  });
});
```

---

## 監控和告警

### 建議監控指標

1. **扣款成功率**：`completed / (completed + failed)` 應 > 99%
2. **平均扣款時間**：應 < 500ms
3. **Pending 記錄數量**：持續 > 10 分鐘的 pending 記錄應觸發告警
4. **重試次數分布**：retry_count > 2 的記錄應調查原因
5. **餘額不足錯誤率**：追蹤 402 錯誤比例

### Datadog/CloudWatch 查詢範例

```sql
-- 查找卡住的 pending 記錄
SELECT id, idempotency_key, created_at, retry_count
FROM token_deduction_records
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;

-- 扣款成功率（按小時）
SELECT
  DATE_TRUNC('hour', created_at) AS hour,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 2) AS success_rate
FROM token_deduction_records
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

---

## 部署檢查清單

- [ ] 執行 migration 建立 `token_deduction_records` 表
- [ ] 部署 `deduct_tokens_atomic` PostgreSQL 函數
- [ ] 部署應用層代碼（TokenBillingService）
- [ ] 設定 cron job 執行對帳 script（每小時）
- [ ] 更新前端餘額顯示組件
- [ ] 測試冪等性（重複請求）
- [ ] 測試併發請求
- [ ] 測試餘額不足錯誤處理
- [ ] 測試重試邏輯
- [ ] 配置監控和告警

---

## 回滾計畫

如果出現嚴重問題需要回滾：

1. **保留資料**：`token_deduction_records` 表不刪除，保留審計記錄
2. **切換回舊邏輯**：使用 feature flag 切換回原有的扣款邏輯
3. **對帳修正**：執行對帳 script 修正任何不一致的餘額

```typescript
// 使用 feature flag 控制
const USE_IDEMPOTENT_BILLING = process.env.USE_IDEMPOTENT_BILLING === "true";

if (USE_IDEMPOTENT_BILLING) {
  await service.deductTokensIdempotent(params);
} else {
  await service.deductTokens(params); // 舊邏輯
}
```
