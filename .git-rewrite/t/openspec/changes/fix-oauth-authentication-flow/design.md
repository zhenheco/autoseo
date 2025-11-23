# OAuth 認證流程修復 - 技術設計文檔

## 概述

本文檔詳細說明 OAuth 認證流程修復的技術架構、實作細節和設計決策。

---

## 系統架構

### 整體架構圖

```
┌─────────────────────────────────────────────────────────────────────┐
│                          User Browser                                │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           │ 1. Click "Sign in with Google"
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    Google OAuth Provider                             │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ 1. User授權                                                 │     │
│  │ 2. 返回 authorization code                                  │     │
│  └────────────────────────────────────────────────────────────┘     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           │ 2. Redirect to /auth/callback?code=xxx
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   Next.js App (/auth/callback)                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Step 1: Exchange code for session (Supabase)               │     │
│  └────────────────────────────────────────────────────────────┘     │
│                           │                                          │
│                           ↓                                          │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Step 2: ensureUserHasCompany()                             │     │
│  │  ┌──────────────────────────────────────────────────────┐  │     │
│  │  │ Layer 1: Check existing company                      │  │     │
│  │  │   └─> getUserCompany(userId)                         │  │     │
│  │  │                                                       │  │     │
│  │  │ Layer 2: Wait for Database Trigger (exponential)     │  │     │
│  │  │   └─> waitForCompanySetup(userId, 3100ms)            │  │     │
│  │  │       └─> Poll every: 100,200,400,800,1600ms         │  │     │
│  │  │                                                       │  │     │
│  │  │ Layer 3: Fallback manual creation                    │  │     │
│  │  │   └─> createCompanyForUser(userId, email, name)      │  │     │
│  │  │       └─> Call RPC: create_company_for_oauth_user()  │  │     │
│  │  └──────────────────────────────────────────────────────┘  │     │
│  └────────────────────────────────────────────────────────────┘     │
│                           │                                          │
│                           ↓                                          │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Step 3: Redirect to dashboard                              │     │
│  └────────────────────────────────────────────────────────────┘     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      Supabase (PostgreSQL)                           │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Database Trigger: handle_new_oauth_user                    │     │
│  │  - AFTER INSERT on auth.users                              │     │
│  │  - Creates: company, subscription, member,                 │     │
│  │             tokens, referral_code                          │     │
│  └────────────────────────────────────────────────────────────┘     │
│                           │                                          │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ RPC Function: create_company_for_oauth_user                │     │
│  │  - Advisory lock (防止並發)                                 │     │
│  │  - Transaction (原子性)                                     │     │
│  │  - Creates all related data                                │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Monitoring Table: oauth_login_metrics                      │     │
│  │  - Records: path, delay, timestamp                         │     │
│  └────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 資料流程

### 成功場景 1：現有用戶（最快路徑）

```
User clicks Google OAuth
  ↓
Google authorization
  ↓
Redirect to /auth/callback
  ↓
Exchange code for session ✅
  ↓
ensureUserHasCompany()
  ↓
Layer 1: getUserCompany() ✅ (找到公司)
  ↓
記錄 metrics: path='existing', delay=50ms
  ↓
Redirect to /dashboard ✅

總時間: ~200ms
```

### 成功場景 2：新用戶，Trigger 正常（常見路徑）

```
User clicks Google OAuth
  ↓
Google authorization
  ↓
Redirect to /auth/callback
  ↓
Exchange code for session ✅
  ↓
Supabase creates auth.users record
  ↓
[並行執行]
  ├─> Database Trigger 開始執行...
  └─> ensureUserHasCompany()
        ↓
      Layer 1: getUserCompany() ❌ (尚無公司)
        ↓
      Layer 2: waitForCompanySetup()
        ├─ Poll 1 (100ms): ❌
        ├─ Poll 2 (200ms): ❌
        └─ Poll 3 (400ms): ✅ (Trigger 完成)
        ↓
      記錄 metrics: path='trigger_success', delay=700ms
        ↓
      Redirect to /dashboard ✅

總時間: ~1 秒
```

### 成功場景 3：新用戶，Trigger 失敗（Fallback）

```
User clicks Google OAuth
  ↓
Google authorization
  ↓
Redirect to /auth/callback
  ↓
Exchange code for session ✅
  ↓
Supabase creates auth.users record
  ↓
[並行執行]
  ├─> Database Trigger 失敗 ❌
  └─> ensureUserHasCompany()
        ↓
      Layer 1: getUserCompany() ❌
        ↓
      Layer 2: waitForCompanySetup()
        ├─ Poll 1-5: 全部 ❌ (超時 3.1s)
        ↓
      Layer 3: createCompanyForUser()
        ├─> RPC: create_company_for_oauth_user()
        │   ├─ Advisory lock 🔒
        │   ├─ Transaction BEGIN
        │   ├─ INSERT companies ✅
        │   ├─ INSERT subscriptions ✅
        │   ├─ INSERT company_subscriptions ✅
        │   ├─ INSERT company_members ✅
        │   ├─ INSERT one_time_tokens ✅
        │   ├─ INSERT referral_codes ✅
        │   ├─ INSERT activity_logs ✅
        │   └─ COMMIT ✅
        ↓
      記錄 metrics: path='fallback_success', delay=3500ms
        ↓
      Redirect to /dashboard ✅

總時間: ~4 秒（用戶可接受）
```

### 失敗場景：所有層都失敗

```
User clicks Google OAuth
  ↓
Google authorization
  ↓
Redirect to /auth/callback
  ↓
Exchange code for session ✅
  ↓
ensureUserHasCompany()
  ↓
Layer 1: getUserCompany() ❌
  ↓
Layer 2: waitForCompanySetup() ❌ (超時)
  ↓
Layer 3: createCompanyForUser() ❌ (資料庫錯誤)
  ↓
記錄 metrics: path='failed'
  ↓
Log error details
  ↓
Redirect to /login?error=company_creation_failed
  ↓
顯示錯誤訊息 + 重試按鈕

總時間: ~4 秒（然後顯示錯誤）
```

---

## 核心模組設計

### 1. OAuth Setup 模組 (`src/lib/auth/oauth-setup.ts`)

```typescript
// ============================================================================
// Types and Constants
// ============================================================================

interface OAuthProvider {
  name: "google" | "github" | "facebook";
  displayName: string;
  supportsRefreshToken: boolean;
}

interface CompanyData {
  id: string;
  name: string;
  email: string;
  plan: string;
}

interface OAuthSetupResult {
  success: boolean;
  company?: CompanyData;
  path: "existing" | "trigger_success" | "fallback_success" | "failed";
  delay: number; // milliseconds
  error?: string;
}

const OAUTH_PROVIDERS: Record<string, OAuthProvider> = {
  google: {
    name: "google",
    displayName: "Google",
    supportsRefreshToken: true,
  },
  // 未來擴展
  // github: { ... },
  // facebook: { ... },
};

// 指數退避配置
const EXPONENTIAL_BACKOFF_DELAYS = [100, 200, 400, 800, 1600]; // ms
const TOTAL_TIMEOUT = EXPONENTIAL_BACKOFF_DELAYS.reduce((a, b) => a + b, 0); // 3100ms

// ============================================================================
// Layer 1: Check Existing Company
// ============================================================================

/**
 * 檢查用戶是否已有公司
 * 快速路徑：直接查詢資料庫
 */
async function getUserCompany(userId: string): Promise<CompanyData | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("company_members")
    .select(
      `
      company_id,
      companies (
        id,
        name,
        email,
        plan
      )
    `,
    )
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data.companies as CompanyData;
}

// ============================================================================
// Layer 2: Wait for Database Trigger (Exponential Backoff)
// ============================================================================

/**
 * 使用指數退避輪詢等待 Database Trigger 完成
 * 優點：前期快速檢測，後期降低頻率
 */
async function waitForCompanySetup(
  userId: string,
): Promise<CompanyData | null> {
  for (const delay of EXPONENTIAL_BACKOFF_DELAYS) {
    await sleep(delay);

    const company = await getUserCompany(userId);
    if (company) {
      console.log(`[OAuth] Trigger succeeded after ${delay}ms poll`);
      return company;
    }
  }

  console.warn(`[OAuth] Trigger timeout after ${TOTAL_TIMEOUT}ms`);
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Layer 3: Fallback Manual Creation (RPC Function)
// ============================================================================

/**
 * 調用 RPC function 手動建立公司和所有相關資料
 * 包含 advisory lock 防止並發
 */
async function createCompanyForUser(
  userId: string,
  email: string,
  name: string,
): Promise<CompanyData | null> {
  const supabase = createClient();

  console.log(`[OAuth] Fallback: Creating company for user ${userId}`);

  const { data, error } = await supabase.rpc("create_company_for_oauth_user", {
    p_user_id: userId,
    p_email: email,
    p_company_name: name || "My Company",
  });

  if (error) {
    console.error("[OAuth] Fallback creation failed:", error);
    return null;
  }

  console.log("[OAuth] Fallback creation succeeded:", data);

  // 重新查詢公司資料
  return await getUserCompany(userId);
}

// ============================================================================
// Main Coordinator: ensureUserHasCompany (三層防護)
// ============================================================================

/**
 * 主要協調函數：確保用戶擁有公司資料
 * 實作三層防護機制
 */
export async function ensureUserHasCompany(
  userId: string,
  email: string,
  userName?: string,
): Promise<OAuthSetupResult> {
  const startTime = Date.now();

  console.log(`[OAuth] Starting company setup for user ${userId}`);

  // ─────────────────────────────────────────────────────────────────────
  // Layer 1: 檢查現有公司（最快路徑）
  // ─────────────────────────────────────────────────────────────────────
  let company = await getUserCompany(userId);
  if (company) {
    const delay = Date.now() - startTime;
    console.log(`[OAuth] Layer 1 success: existing company found (${delay}ms)`);

    await recordMetrics({
      userId,
      path: "existing",
      delay,
      provider: "google",
    });

    return {
      success: true,
      company,
      path: "existing",
      delay,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Layer 2: 輪詢等待 Database Trigger（正常路徑）
  // ─────────────────────────────────────────────────────────────────────
  company = await waitForCompanySetup(userId);
  if (company) {
    const delay = Date.now() - startTime;
    console.log(`[OAuth] Layer 2 success: trigger completed (${delay}ms)`);

    await recordMetrics({
      userId,
      path: "trigger_success",
      delay,
      provider: "google",
    });

    return {
      success: true,
      company,
      path: "trigger_success",
      delay,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Layer 3: Fallback 手動建立（保底機制）
  // ─────────────────────────────────────────────────────────────────────
  console.warn("[OAuth] Layer 3: Trigger timeout, starting fallback creation");

  const defaultCompanyName = userName || email.split("@")[0] || "My Company";
  company = await createCompanyForUser(userId, email, defaultCompanyName);

  if (company) {
    const delay = Date.now() - startTime;
    console.log(`[OAuth] Layer 3 success: fallback created (${delay}ms)`);

    await recordMetrics({
      userId,
      path: "fallback_success",
      delay,
      provider: "google",
    });

    return {
      success: true,
      company,
      path: "fallback_success",
      delay,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // 所有層都失敗
  // ─────────────────────────────────────────────────────────────────────
  const delay = Date.now() - startTime;
  console.error(`[OAuth] All layers failed (${delay}ms)`);

  await recordMetrics({
    userId,
    path: "failed",
    delay,
    provider: "google",
  });

  return {
    success: false,
    path: "failed",
    delay,
    error: "Failed to create company after all attempts",
  };
}

// ============================================================================
// Monitoring and Metrics
// ============================================================================

interface MetricsData {
  userId: string;
  provider: string;
  path: "existing" | "trigger_success" | "fallback_success" | "failed";
  delay: number;
}

/**
 * 記錄 OAuth 登入指標到監控表
 */
async function recordMetrics(data: MetricsData): Promise<void> {
  const supabase = createClient();

  await supabase.from("oauth_login_metrics").insert({
    user_id: data.userId,
    provider: data.provider,
    path: data.path,
    trigger_delay_ms: data.delay,
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 從 Supabase User 取得 provider
 */
export function getProviderFromUser(user: any): string | null {
  return user?.app_metadata?.provider || null;
}

/**
 * 判斷是否為 OAuth provider
 */
export function isOAuthProvider(provider: string | null): boolean {
  return provider !== null && provider !== "email";
}

/**
 * 根據 provider 取得預設公司名稱
 * 未來擴展：不同 provider 可能有不同策略
 */
export function getDefaultCompanyName(user: any, provider: string): string {
  switch (provider) {
    case "google":
      return (
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "My Company"
      );
    case "github":
      // 未來實作
      return user.user_metadata?.user_name || "My Company";
    default:
      return "My Company";
  }
}
```

---

## 資料庫設計

### Migration 1: RPC Function (`create_company_for_oauth_user`)

```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_create_oauth_setup_rpc.sql

CREATE OR REPLACE FUNCTION create_company_for_oauth_user(
  p_user_id UUID,
  p_email TEXT,
  p_company_name TEXT
)
RETURNS TABLE(
  company_id UUID,
  subscription_id UUID,
  tokens_balance INTEGER,
  referral_code TEXT,
  created_new BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_subscription_id UUID;
  v_referral_code TEXT;
  v_created_new BOOLEAN := FALSE;
BEGIN
  -- ─────────────────────────────────────────────────────────────────────
  -- 權限檢查：確保調用者是用戶本人
  -- ─────────────────────────────────────────────────────────────────────
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: User can only create company for themselves';
  END IF;

  -- ─────────────────────────────────────────────────────────────────────
  -- Advisory Lock：防止並發建立
  -- 使用 user_id 的 hash 作為 lock key
  -- ─────────────────────────────────────────────────────────────────────
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- ─────────────────────────────────────────────────────────────────────
  -- 雙重檢查：確認用戶是否已有公司
  -- ─────────────────────────────────────────────────────────────────────
  SELECT c.id, cs.subscription_id
  INTO v_company_id, v_subscription_id
  FROM companies c
  JOIN company_members cm ON c.id = cm.company_id
  LEFT JOIN company_subscriptions cs ON c.id = cs.company_id
  WHERE cm.user_id = p_user_id
  LIMIT 1;

  -- 如果已有公司，返回現有資料
  IF v_company_id IS NOT NULL THEN
    SELECT code INTO v_referral_code
    FROM referral_codes
    WHERE user_id = p_user_id
    LIMIT 1;

    RETURN QUERY
    SELECT
      v_company_id,
      v_subscription_id,
      COALESCE((SELECT balance FROM one_time_tokens WHERE company_id = v_company_id LIMIT 1), 0)::INTEGER,
      v_referral_code,
      FALSE; -- created_new = false
    RETURN;
  END IF;

  -- ─────────────────────────────────────────────────────────────────────
  -- 建立新公司和所有相關資料（事務中）
  -- ─────────────────────────────────────────────────────────────────────
  v_created_new := TRUE;

  -- 1. 建立公司
  INSERT INTO companies (name, email, plan, billing_cycle)
  VALUES (p_company_name, p_email, 'free', 'monthly')
  RETURNING id INTO v_company_id;

  -- 2. 建立訂閱
  INSERT INTO subscriptions (
    plan_name,
    status,
    billing_cycle,
    current_period_start,
    current_period_end
  )
  VALUES (
    'free',
    'active',
    'monthly',
    NOW(),
    NOW() + INTERVAL '1 month'
  )
  RETURNING id INTO v_subscription_id;

  -- 3. 建立公司訂閱關聯
  INSERT INTO company_subscriptions (company_id, subscription_id)
  VALUES (v_company_id, v_subscription_id);

  -- 4. 建立公司成員（owner）
  INSERT INTO company_members (company_id, user_id, role)
  VALUES (v_company_id, p_user_id, 'owner');

  -- 5. 建立 one_time_tokens（50 個免費 tokens）
  INSERT INTO one_time_tokens (company_id, balance)
  VALUES (v_company_id, 50);

  -- 6. 建立推薦碼
  INSERT INTO referral_codes (user_id, code)
  VALUES (p_user_id, generate_referral_code())
  RETURNING code INTO v_referral_code;

  -- 7. 記錄活動日誌
  INSERT INTO activity_logs (
    company_id,
    user_id,
    action,
    details,
    timestamp
  )
  VALUES (
    v_company_id,
    p_user_id,
    'company_created',
    jsonb_build_object(
      'method', 'oauth_rpc',
      'provider', 'google',
      'plan', 'free'
    ),
    NOW()
  );

  -- ─────────────────────────────────────────────────────────────────────
  -- 返回建立的資料
  -- ─────────────────────────────────────────────────────────────────────
  RETURN QUERY
  SELECT
    v_company_id,
    v_subscription_id,
    50::INTEGER, -- tokens_balance
    v_referral_code,
    v_created_new;

EXCEPTION
  WHEN OTHERS THEN
    -- 記錄錯誤
    RAISE LOG 'Error in create_company_for_oauth_user: % %', SQLERRM, SQLSTATE;
    RAISE;
END;
$$;

-- 授權給 authenticated 用戶
GRANT EXECUTE ON FUNCTION create_company_for_oauth_user TO authenticated;

-- 註解
COMMENT ON FUNCTION create_company_for_oauth_user IS
  'Creates a complete company setup for OAuth users with advisory lock to prevent concurrent creation';
```

### Migration 2: 更新 Database Trigger

```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_update_oauth_trigger.sql

CREATE OR REPLACE FUNCTION handle_new_oauth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_subscription_id UUID;
  v_provider TEXT;
  v_email TEXT;
  v_user_name TEXT;
  v_company_name TEXT;
BEGIN
  -- 只處理 OAuth 登入（provider !== 'email'）
  v_provider := NEW.raw_app_meta_data->>'provider';

  IF v_provider IS NULL OR v_provider = 'email' THEN
    RETURN NEW;
  END IF;

  -- 檢查用戶是否已有公司（防止重複建立）
  SELECT c.id INTO v_company_id
  FROM companies c
  JOIN company_members cm ON c.id = cm.company_id
  WHERE cm.user_id = NEW.id
  LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    -- 用戶已有公司，跳過
    RETURN NEW;
  END IF;

  -- 取得用戶資訊
  v_email := NEW.email;
  v_user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.email
  );
  v_company_name := SPLIT_PART(v_user_name, '@', 1);

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- 建立完整的公司設定（與 RPC function 一致）
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  -- 1. 建立公司
  INSERT INTO companies (name, email, plan, billing_cycle)
  VALUES (v_company_name, v_email, 'free', 'monthly')
  RETURNING id INTO v_company_id;

  -- 2. 建立訂閱
  INSERT INTO subscriptions (
    plan_name,
    status,
    billing_cycle,
    current_period_start,
    current_period_end
  )
  VALUES (
    'free',
    'active',
    'monthly',
    NOW(),
    NOW() + INTERVAL '1 month'
  )
  RETURNING id INTO v_subscription_id;

  -- 3. 建立公司訂閱關聯
  INSERT INTO company_subscriptions (company_id, subscription_id)
  VALUES (v_company_id, v_subscription_id);

  -- 4. 建立公司成員
  INSERT INTO company_members (company_id, user_id, role)
  VALUES (v_company_id, NEW.id, 'owner');

  -- 5. 建立 one_time_tokens（與 RPC 一致）
  INSERT INTO one_time_tokens (company_id, balance)
  VALUES (v_company_id, 50);

  -- 6. 建立推薦碼（與 RPC 一致）
  INSERT INTO referral_codes (user_id, code)
  VALUES (NEW.id, generate_referral_code());

  -- 7. 記錄活動日誌
  INSERT INTO activity_logs (
    company_id,
    user_id,
    action,
    details,
    timestamp
  )
  VALUES (
    v_company_id,
    NEW.id,
    'company_created',
    jsonb_build_object(
      'method', 'database_trigger',
      'provider', v_provider,
      'plan', 'free'
    ),
    NOW()
  );

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- 記錄錯誤但不阻止用戶建立
    RAISE LOG 'Error in handle_new_oauth_user trigger: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- Trigger 定義保持不變
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION handle_new_oauth_user();
```

### Migration 3: 監控表

```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_create_oauth_metrics_table.sql

CREATE TABLE IF NOT EXISTS oauth_login_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  path TEXT NOT NULL CHECK (path IN ('existing', 'trigger_success', 'fallback_success', 'failed')),
  trigger_delay_ms INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 索引
  INDEX idx_oauth_metrics_created_at ON oauth_login_metrics(created_at),
  INDEX idx_oauth_metrics_path ON oauth_login_metrics(path),
  INDEX idx_oauth_metrics_provider ON oauth_login_metrics(provider)
);

-- 註解
COMMENT ON TABLE oauth_login_metrics IS
  'Tracks OAuth login performance metrics for monitoring and alerting';

COMMENT ON COLUMN oauth_login_metrics.path IS
  'Which layer succeeded: existing (Layer 1), trigger_success (Layer 2), fallback_success (Layer 3), or failed';

COMMENT ON COLUMN oauth_login_metrics.trigger_delay_ms IS
  'Total time from callback start to company verification, in milliseconds';

-- 資料保留政策（30 天）
CREATE OR REPLACE FUNCTION cleanup_old_oauth_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM oauth_login_metrics
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- 定期清理（可以用 pg_cron 或外部排程）
-- SELECT cron.schedule('cleanup-oauth-metrics', '0 2 * * *', 'SELECT cleanup_old_oauth_metrics()');
```

---

## OAuth Callback 整合

### 修改 `src/app/auth/callback/route.ts`

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ensureUserHasCompany,
  getProviderFromUser,
  isOAuthProvider,
  getDefaultCompanyName,
} from "@/lib/auth/oauth-setup";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";
  const error = requestUrl.searchParams.get("error");

  // ─────────────────────────────────────────────────────────────────────
  // 處理 OAuth 錯誤（例如用戶取消授權）
  // ─────────────────────────────────────────────────────────────────────
  if (error) {
    console.warn(`[OAuth Callback] OAuth error: ${error}`);
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=oauth_cancelled`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // 驗證 authorization code
  // ─────────────────────────────────────────────────────────────────────
  if (!code) {
    console.error("[OAuth Callback] Missing authorization code");
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=missing_code`,
    );
  }

  const supabase = createClient();

  // ─────────────────────────────────────────────────────────────────────
  // Exchange code for session
  // ─────────────────────────────────────────────────────────────────────
  const { data, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[OAuth Callback] Failed to exchange code:", exchangeError);
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=exchange_failed`,
    );
  }

  if (!data.session || !data.user) {
    console.error("[OAuth Callback] No session or user after exchange");
    return NextResponse.redirect(`${requestUrl.origin}/login?error=no_session`);
  }

  const { user } = data;
  const provider = getProviderFromUser(user);

  console.log(
    `[OAuth Callback] User authenticated: ${user.id}, provider: ${provider}`,
  );

  // ─────────────────────────────────────────────────────────────────────
  // 如果是 OAuth provider，執行三層防護機制
  // ─────────────────────────────────────────────────────────────────────
  if (provider && isOAuthProvider(provider)) {
    console.log(`[OAuth Callback] OAuth login detected: ${provider}`);

    const companyName = getDefaultCompanyName(user, provider);
    const result = await ensureUserHasCompany(
      user.id,
      user.email!,
      companyName,
    );

    if (!result.success) {
      console.error("[OAuth Callback] Failed to ensure company:", result.error);
      return NextResponse.redirect(
        `${requestUrl.origin}/login?error=company_creation_failed`,
      );
    }

    console.log(
      `[OAuth Callback] Company setup succeeded via ${result.path} (${result.delay}ms)`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // 成功：重定向到目標頁面
  // ─────────────────────────────────────────────────────────────────────
  console.log(`[OAuth Callback] Redirecting to: ${next}`);
  return NextResponse.redirect(requestUrl.origin + next);
}
```

---

## 並發控制機制

### Advisory Lock 原理

PostgreSQL advisory locks 是應用層級的鎖，用於防止並發操作造成資料衝突。

**特性**：

- 基於整數 key（我們使用 `hashtext(user_id::text)`）
- 事務級別（`pg_advisory_xact_lock`）：事務結束自動釋放
- 不會造成 deadlock（如果 key 相同）
- 效能優於 row-level locks

**運作方式**：

```
Tab 1                           Tab 2
────────────────────────────────────────────────────────
BEGIN;
LOCK(user_123) ✅ (獲得鎖)
                                BEGIN;
                                LOCK(user_123) ⏳ (等待)
檢查是否有公司 ❌
建立公司 ✅
COMMIT; (釋放鎖)
                                ✅ (獲得鎖)
                                檢查是否有公司 ✅ (找到)
                                返回現有公司
                                COMMIT;
```

結果：只建立一個公司 ✅

---

## 錯誤處理策略

### 錯誤分類和處理

```typescript
// src/lib/auth/oauth-setup.ts

interface ErrorClassification {
  type: "recoverable" | "unrecoverable" | "partial";
  retryable: boolean;
  userMessage: string;
  logLevel: "info" | "warn" | "error";
}

const ERROR_CLASSIFICATIONS: Record<string, ErrorClassification> = {
  // 可恢復錯誤
  NETWORK_TIMEOUT: {
    type: "recoverable",
    retryable: true,
    userMessage: "網路連線不穩定，請重試",
    logLevel: "warn",
  },
  DATABASE_UNAVAILABLE: {
    type: "recoverable",
    retryable: true,
    userMessage: "伺服器暫時無法連線，請稍後再試",
    logLevel: "error",
  },

  // 不可恢復錯誤
  INVALID_EMAIL: {
    type: "unrecoverable",
    retryable: false,
    userMessage: "Email 格式不正確，請聯繫客服",
    logLevel: "error",
  },
  UNAUTHORIZED: {
    type: "unrecoverable",
    retryable: false,
    userMessage: "權限驗證失敗，請重新登入",
    logLevel: "error",
  },

  // 部分失敗
  TOKENS_CREATION_FAILED: {
    type: "partial",
    retryable: false,
    userMessage: "登入成功，部分功能可能需要稍後才能使用",
    logLevel: "warn",
  },
};
```

---

## 效能優化

### 指數退避詳細分析

```
Poll 1:  100ms  (快速檢測，80% 情況下 Trigger 已完成)
Poll 2:  200ms  (累計  300ms)
Poll 3:  400ms  (累計  700ms)
Poll 4:  800ms  (累計 1500ms)
Poll 5: 1600ms  (累計 3100ms，超時進入 Fallback)

相比固定間隔 500ms * 6 = 3000ms：
- 如果 Trigger 在 300ms 完成：快 200ms
- 如果 Trigger 在 700ms 完成：快 300ms
- 減少總查詢次數：5 次 vs 6 次
```

### 資料庫查詢優化

```sql
-- 索引優化
CREATE INDEX idx_company_members_user_id ON company_members(user_id);
CREATE INDEX idx_companies_email ON companies(email);

-- 查詢優化：使用 LIMIT 1 + single()
-- 避免掃描所有匹配行
```

---

## 監控和警報

### 監控查詢

```sql
-- 1. 路徑分佈（過去 24 小時）
SELECT
  path,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM oauth_login_metrics
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY path
ORDER BY count DESC;

-- 預期結果：
-- existing: 90%+ (成熟產品)
-- trigger_success: 5-10%
-- fallback_success: < 5% (警報閾值)
-- failed: 0% (絕對不可接受)

-- 2. Trigger 延遲分析
SELECT
  percentile_cont(0.50) WITHIN GROUP (ORDER BY trigger_delay_ms) as p50,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY trigger_delay_ms) as p95,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY trigger_delay_ms) as p99,
  AVG(trigger_delay_ms) as avg_delay
FROM oauth_login_metrics
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND path IN ('trigger_success', 'fallback_success');

-- 目標：
-- P50: < 500ms
-- P95: < 1000ms
-- P99: < 3000ms

-- 3. Fallback 觸發趨勢（警報）
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) FILTER (WHERE path = 'fallback_success') as fallback_count,
  COUNT(*) as total_count,
  ROUND(
    COUNT(*) FILTER (WHERE path = 'fallback_success') * 100.0 / COUNT(*),
    2
  ) as fallback_rate
FROM oauth_login_metrics
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
HAVING COUNT(*) FILTER (WHERE path = 'fallback_success') > 0
ORDER BY hour DESC;

-- 警報：任何小時 fallback_rate > 5%
```

### 警報規則

```yaml
# 使用 Supabase Realtime 或外部監控系統

alerts:
  - name: "OAuth Fallback Rate High"
    condition: "fallback_rate > 5%"
    window: "1 hour"
    severity: "warning"
    action: "通知開發團隊檢查 Database Trigger"

  - name: "OAuth Login Failed"
    condition: "path = 'failed'"
    window: "immediate"
    severity: "critical"
    action: "立即警報，可能影響所有新用戶註冊"

  - name: "Trigger Delay High"
    condition: "p95_delay > 3000ms"
    window: "1 hour"
    severity: "warning"
    action: "檢查資料庫效能"
```

---

## 安全性設計

### 1. RLS (Row Level Security) 配置

```sql
-- oauth_login_metrics 表只允許系統寫入，用戶可讀取自己的記錄
ALTER TABLE oauth_login_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own metrics"
  ON oauth_login_metrics
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert metrics"
  ON oauth_login_metrics
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
```

### 2. Rate Limiting 實作

```typescript
// src/lib/auth/rate-limit.ts

const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 分鐘
const MAX_ATTEMPTS = 1;

async function checkRateLimit(userId: string): Promise<boolean> {
  const supabase = createClient();

  const { count } = await supabase
    .from("oauth_login_metrics")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - RATE_LIMIT_WINDOW).toISOString());

  if (count && count >= MAX_ATTEMPTS) {
    console.warn(`[Rate Limit] User ${userId} exceeded limit`);
    return false;
  }

  return true;
}
```

---

## 測試計畫

### 單元測試範例

```typescript
// __tests__/oauth-setup.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ensureUserHasCompany, getUserCompany } from "@/lib/auth/oauth-setup";

describe("OAuth Setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserCompany", () => {
    it("should return company if user has one", async () => {
      // Mock Supabase client
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { companies: { id: "123", name: "Test Company" } },
          error: null,
        }),
      };

      const company = await getUserCompany("user-123");
      expect(company).toEqual({ id: "123", name: "Test Company" });
    });

    it("should return null if user has no company", async () => {
      // Mock empty result
      const company = await getUserCompany("user-456");
      expect(company).toBeNull();
    });
  });

  describe("ensureUserHasCompany", () => {
    it("should succeed via Layer 1 if company exists", async () => {
      // Mock existing company
      const result = await ensureUserHasCompany("user-123", "user@example.com");

      expect(result.success).toBe(true);
      expect(result.path).toBe("existing");
      expect(result.delay).toBeLessThan(200);
    });

    it("should succeed via Layer 2 if Trigger completes", async () => {
      // Mock: no company initially, then appears after 400ms
      const result = await ensureUserHasCompany("user-new", "new@example.com");

      expect(result.success).toBe(true);
      expect(result.path).toBe("trigger_success");
      expect(result.delay).toBeLessThan(1000);
    });

    it("should succeed via Layer 3 if Fallback works", async () => {
      // Mock: Trigger timeout, RPC success
      const result = await ensureUserHasCompany(
        "user-fallback",
        "fallback@example.com",
      );

      expect(result.success).toBe(true);
      expect(result.path).toBe("fallback_success");
      expect(result.delay).toBeGreaterThan(3000);
    });

    it("should fail if all layers fail", async () => {
      // Mock: all failures
      const result = await ensureUserHasCompany(
        "user-fail",
        "fail@example.com",
      );

      expect(result.success).toBe(false);
      expect(result.path).toBe("failed");
      expect(result.error).toBeDefined();
    });
  });
});
```

---

## 部署檢查清單

### Phase 1: 基礎設施

- [ ] Migration 1: RPC function 已建立
- [ ] Migration 2: Database Trigger 已更新
- [ ] Migration 3: 監控表已建立
- [ ] 測試環境驗證：RPC function 可正常調用
- [ ] 測試環境驗證：Trigger 正常執行
- [ ] 測試環境驗證：監控表可寫入

### Phase 2: 應用部署

- [ ] `src/lib/auth/oauth-setup.ts` 已實作
- [ ] `src/app/auth/callback/route.ts` 已修改
- [ ] `src/lib/auth.ts` 已重構（可選）
- [ ] TypeScript 編譯無錯誤
- [ ] Lint 檢查通過
- [ ] 單元測試通過

### Phase 3: 測試

- [ ] 8 個手動測試場景全部通過
- [ ] 整合測試通過
- [ ] 效能測試：P95 < 1 秒
- [ ] 並發測試：無重複建立公司

### Phase 4: 生產部署

- [ ] 部署到 Staging
- [ ] Staging 驗證通過
- [ ] 部署到 Production
- [ ] 監控儀表板就緒
- [ ] 警報規則已配置
- [ ] 24 小時密集監控
- [ ] 文檔已更新

---

## 回滾計畫

### 情境 1：代碼問題

```bash
# 回滾到前一版本
git revert <commit-hash>
git push origin main

# 或完整回滾
git reset --hard <previous-commit>
git push origin main --force

# Vercel 自動重新部署
```

### 情境 2：RPC Function 問題

```sql
-- 禁用 RPC function（不刪除，避免資料丟失）
REVOKE EXECUTE ON FUNCTION create_company_for_oauth_user FROM authenticated;

-- 或降級到舊版本
DROP FUNCTION create_company_for_oauth_user;
-- 恢復舊版本 SQL
```

### 情境 3：Database Trigger 問題

```sql
-- 暫時禁用 Trigger
DROP TRIGGER on_auth_user_created ON auth.users;

-- 修復後重新啟用
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_oauth_user();
```

---

## 未來擴展

### 加入新 OAuth Provider (GitHub)

1. **更新 Provider 配置**

   ```typescript
   const OAUTH_PROVIDERS = {
     google: { ... },
     github: {
       name: 'github',
       displayName: 'GitHub',
       supportsRefreshToken: true,
     },
   };
   ```

2. **Provider 特定邏輯**

   ```typescript
   function getDefaultCompanyName(user, provider) {
     switch (provider) {
       case 'google':
         return user.user_metadata?.full_name || ...;
       case 'github':
         return user.user_metadata?.user_name || ...;
     }
   }
   ```

3. **測試**
   - 重複 8 個測試場景
   - 驗證 GitHub 特定資料正確儲存

4. **部署**
   - 無需修改資料庫
   - 只需部署應用代碼

---

## 附錄

### 相關檔案清單

```
專案結構：

src/
├── lib/
│   ├── auth/
│   │   ├── oauth-setup.ts         # 新建：三層防護邏輯
│   │   └── rate-limit.ts          # 新建：Rate limiting
│   └── auth.ts                     # 修改：重構共用邏輯
│
├── app/
│   └── auth/
│       └── callback/
│           └── route.ts            # 修改：整合 ensureUserHasCompany
│
supabase/
└── migrations/
    ├── YYYYMMDDHHMMSS_create_oauth_setup_rpc.sql
    ├── YYYYMMDDHHMMSS_update_oauth_trigger.sql
    └── YYYYMMDDHHMMSS_create_oauth_metrics_table.sql

__tests__/
└── oauth-setup.test.ts             # 新建：單元測試
```

### 參考文檔

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [PostgreSQL Advisory Locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS)
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- 原始問題分析：`docs/OAUTH_FIX_PLAN.md`

---

**建立日期**: 2025-11-10
**最後更新**: 2025-11-10
**版本**: 1.0
