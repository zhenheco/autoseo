# Token Quota Management Specification

## ADDED Requirements

### Requirement: 終身方案的月配額重置機制

系統 SHALL 為終身付費方案提供每月重置的 Token 配額，即使用戶已付清終身費用。

#### Scenario: 每月 1 日重置配額

- **WHEN** 系統執行每月排程任務（cron job）
- **THEN** 應在每月 1 日 00:00 UTC 重置所有付費用戶的月配額：
  ```sql
  UPDATE company_subscriptions
  SET
    monthly_quota_balance = monthly_token_quota,
    current_period_end = DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  WHERE
    subscription_tier IN ('starter', 'professional', 'business', 'agency')
    AND is_lifetime = true
    AND monthly_token_quota > 0;
  ```

#### Scenario: 免費方案不重置

- **WHEN** 執行月配額重置任務
- **THEN** FREE 方案（monthly_token_quota = 0）應被排除
- **AND** FREE 用戶的 `purchased_token_balance` 保持不變

#### Scenario: 重置時保留購買包餘額

- **WHEN** 月配額重置
- **THEN** `monthly_quota_balance` 重置為 `monthly_token_quota`
- **AND** `purchased_token_balance` 完全不受影響（永久保留）

#### Scenario: 重置後發送通知郵件

- **WHEN** 月配額重置成功
- **THEN** 系統應向所有付費用戶發送郵件通知：
  - 主旨：「您的月度 Token 配額已重置」
  - 內容：新配額數量、上月使用量、下次重置日期

### Requirement: Token 使用優先順序

系統 SHALL 優先使用月配額 Token，耗盡後才使用購買包 Token。

#### Scenario: 優先扣除月配額

- **WHEN** 用戶消費 Token（如生成文章）
- **THEN** 系統應首先從 `monthly_quota_balance` 扣除
- **AND** 僅當 `monthly_quota_balance = 0` 時，才從 `purchased_token_balance` 扣除

#### Scenario: 混合扣除邏輯

- **GIVEN** 用戶有 `monthly_quota_balance = 500`, `purchased_token_balance = 2000`
- **WHEN** 用戶消費 1000 tokens
- **THEN** 系統應：
  - 從 `monthly_quota_balance` 扣除 500（全部用完）
  - 從 `purchased_token_balance` 扣除 500（剩餘 1500）
- **AND** 最終狀態：`monthly_quota_balance = 0`, `purchased_token_balance = 1500`

#### Scenario: Token 不足時拒絕請求

- **GIVEN** 用戶總餘額 = `monthly_quota_balance + purchased_token_balance`
- **WHEN** 用戶請求消費的 Token 超過總餘額
- **THEN** 系統應：
  - 拋出 `InsufficientTokensError`
  - 不扣除任何 Token
  - 回傳錯誤訊息：「Token 不足，剩餘 X，需要 Y」

#### Scenario: 交易式 Token 扣除

- **WHEN** 扣除 Token 操作
- **THEN** 必須在資料庫事務（transaction）中執行
- **AND** 使用悲觀鎖（pessimistic write lock）防止競態條件
- **AND** 任何錯誤應回滾整個事務

### Requirement: Token 餘額查詢與顯示

系統 SHALL 在所有相關頁面正確顯示 Token 餘額，包含月配額和購買包的區分。

#### Scenario: Dashboard 顯示 Token 餘額

- **WHEN** 用戶查看 Dashboard
- **THEN** 應顯示：
  - 總可用 Token：`monthly_quota_balance + purchased_token_balance`
  - 月配額（剩餘 / 總額）：`monthly_quota_balance / monthly_token_quota`（僅付費用戶）
  - 購買包餘額：`purchased_token_balance`（永不過期）
  - 下次重置日期：`current_period_end`（僅付費用戶）

#### Scenario: 免費用戶的餘額顯示

- **WHEN** 用戶為 FREE 方案
- **THEN** 應顯示：
  - 可用 Token：`purchased_token_balance`（僅購買包）
  - 標註：「一次性配額，永不過期」
  - 不顯示月配額或重置日期

#### Scenario: 文章管理頁面的餘額提示

- **WHEN** 用戶在文章管理頁面準備生成文章
- **THEN** 應顯示：
  - 當前可用 Token
  - 預估本次生成將消耗的 Token
  - 餘額不足時顯示「購買 Token」按鈕

#### Scenario: Token 餘額即時更新

- **WHEN** Token 餘額發生變化（使用、購買、重置）
- **THEN** 所有頁面應在下次重新載入或 refetch 時顯示最新餘額
- **AND** 不應因快取導致顯示過時資料

### Requirement: Token 購買包永久有效

系統 SHALL 確保透過購買包獲得的 Token 永久有效，不會過期或被重置。

#### Scenario: 購買 Token 後更新餘額

- **WHEN** 用戶成功購買 Token 購買包
- **THEN** 系統應：
  - 將購買包的 Token 數量加到 `purchased_token_balance`
  - 不修改 `monthly_quota_balance`（月配額獨立計算）
  - 記錄購買交易到 `token_purchases` 表

#### Scenario: 購買記錄追蹤

- **WHEN** 用戶購買 Token
- **THEN** 系統應建立購買記錄：
  ```sql
  INSERT INTO token_purchases (
    company_id,
    package_id,
    tokens_purchased,
    price_paid,
    payment_order_id,
    purchased_at
  ) VALUES (?, ?, ?, ?, ?, NOW());
  ```

#### Scenario: 月重置不影響購買包

- **WHEN** 執行每月配額重置
- **THEN** `purchased_token_balance` 欄位不應被修改
- **AND** 僅更新 `monthly_quota_balance`

#### Scenario: 購買歷史查詢

- **WHEN** 用戶查看 Token 購買歷史（`/dashboard/billing/tokens`）
- **THEN** 應顯示所有購買記錄：
  - 購買日期
  - 購買包名稱（如「標準包 50K」）
  - Token 數量
  - 支付金額
  - 剩餘餘額（當下的 `purchased_token_balance`）

### Requirement: Token 使用記錄追蹤

系統 SHALL 詳細記錄每次 Token 使用，用於帳單、分析和審計。

#### Scenario: 記錄 Token 使用事件

- **WHEN** 用戶消費 Token（如生成文章、圖片）
- **THEN** 系統應插入使用記錄：
  ```sql
  INSERT INTO token_usage_logs (
    company_id,
    user_id,
    action_type,          -- 'article_generation', 'image_generation', etc.
    tokens_used,
    deducted_from_monthly,
    deducted_from_purchased,
    balance_after,
    metadata              -- JSONB：如 article_id, model_used, etc.
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
  ```

#### Scenario: 使用記錄包含來源區分

- **WHEN** 插入 Token 使用記錄
- **THEN** 應明確記錄：
  - `deducted_from_monthly`：從月配額扣除的數量
  - `deducted_from_purchased`：從購買包扣除的數量
  - `balance_after`：扣除後的總餘額

#### Scenario: 使用分析查詢

- **WHEN** 管理員或用戶查看 Token 使用分析
- **THEN** 應能查詢：
  - 每日/每月使用量趨勢
  - 按動作類型分組（文章生成 vs 圖片生成）
  - 月配額使用率（monthly 使用量 / monthly_token_quota）
  - 購買包消耗速度

#### Scenario: 異常使用偵測

- **WHEN** 系統偵測到異常使用模式
- **THEN** 應觸發警報：
  - 單日使用量 > 月配額的 50%
  - 連續大量請求（如 1 分鐘內 > 100 次）
  - 疑似濫用行為（如 Token 使用但無實際輸出）

## MODIFIED Requirements

### Requirement: 訂閱餘額計算（修改自 subscription-display）

系統 SHALL 正確計算並顯示包含月配額和購買包的總餘額。

#### Scenario: 總餘額公式統一

- **WHEN** 任何頁面需要顯示 Token 餘額
- **THEN** 應使用統一公式：
  ```typescript
  total_balance = monthly_quota_balance + purchased_token_balance;
  ```
- **AND** 不應硬編碼或使用其他計算方式

#### Scenario: API 回應包含餘額詳情

- **WHEN** 前端呼叫 `/api/token-balance` API
- **THEN** 回應應包含：
  ```json
  {
    "total_balance": 52000,
    "monthly_quota": {
      "remaining": 2000,
      "total": 50000,
      "next_reset": "2025-12-01T00:00:00Z"
    },
    "purchased": {
      "balance": 50000,
      "never_expires": true
    }
  }
  ```

## ADDED Data Models

### Token Usage Log 表

```sql
CREATE TABLE token_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL CHECK (action_type IN (
    'article_generation',
    'image_generation',
    'api_call',
    'manual_adjustment'
  )),
  tokens_used INTEGER NOT NULL,
  deducted_from_monthly INTEGER NOT NULL DEFAULT 0,
  deducted_from_purchased INTEGER NOT NULL DEFAULT 0,
  balance_after INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_token_usage_company ON token_usage_logs(company_id, created_at DESC);
CREATE INDEX idx_token_usage_action ON token_usage_logs(action_type, created_at DESC);
```

### Token Purchases 表

```sql
CREATE TABLE token_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID REFERENCES users(id),
  package_id UUID REFERENCES token_packages(id),
  tokens_purchased INTEGER NOT NULL,
  price_paid DECIMAL(10,2) NOT NULL,
  payment_order_id UUID REFERENCES payment_orders(id),
  purchased_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_token_purchases_company ON token_purchases(company_id, purchased_at DESC);
```

### TypeScript 型別定義

```typescript
// src/types/token.ts
export interface TokenBalance {
  total_balance: number;
  monthly_quota: {
    remaining: number;
    total: number;
    next_reset: Date | null;
  };
  purchased: {
    balance: number;
    never_expires: true;
  };
}

export interface TokenUsageLog {
  id: string;
  company_id: string;
  user_id?: string;
  action_type:
    | "article_generation"
    | "image_generation"
    | "api_call"
    | "manual_adjustment";
  tokens_used: number;
  deducted_from_monthly: number;
  deducted_from_purchased: number;
  balance_after: number;
  metadata?: Record<string, unknown>;
  created_at: Date;
}

export interface TokenPurchase {
  id: string;
  company_id: string;
  package_id: string;
  tokens_purchased: number;
  price_paid: number;
  payment_order_id?: string;
  purchased_at: Date;
}

export interface TokenDeductionResult {
  success: boolean;
  deducted_from_monthly: number;
  deducted_from_purchased: number;
  new_monthly_balance: number;
  new_purchased_balance: number;
  total_balance: number;
}
```

## ADDED Cron Jobs

### 月配額重置 Cron Job

```typescript
// src/lib/cron/reset-monthly-quota.ts
import { createClient } from "@/lib/supabase/server";

export async function resetMonthlyQuota() {
  const supabase = createClient();

  const { data: updated, error } = await supabase.rpc("reset_monthly_quotas");

  if (error) {
    console.error("Failed to reset monthly quotas:", error);
    throw error;
  }

  console.log(`Reset monthly quotas for ${updated.length} companies`);

  // 發送通知郵件
  for (const company of updated) {
    await sendQuotaResetEmail(company);
  }

  return updated;
}

// Supabase Edge Function 或 Vercel Cron
// cron: '0 0 1 * *' (每月 1 日 00:00 UTC)
```

### 資料庫函數

```sql
-- Supabase Function for monthly quota reset
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS TABLE(company_id UUID, new_balance INTEGER) AS $$
BEGIN
  RETURN QUERY
  UPDATE company_subscriptions
  SET
    monthly_quota_balance = monthly_token_quota,
    current_period_end = DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
    updated_at = NOW()
  WHERE
    subscription_tier IN ('starter', 'professional', 'business', 'agency')
    AND is_lifetime = true
    AND monthly_token_quota > 0
  RETURNING company_id, monthly_quota_balance;
END;
$$ LANGUAGE plpgsql;
```
