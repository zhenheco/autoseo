# 設計文件：終身定價重構

## 架構決策（Architecture Decisions）

### AD-1: 純終身定價模型
**決策**：移除月費和年費選項，僅提供終身付費方案。

**理由**：
1. **簡化系統複雜度**
   - 無需處理訂閱續約邏輯
   - 無需處理週期性計費
   - 減少 `recurring_mandates` 表的使用頻率

2. **改善用戶體驗**
   - 消除「訂閱焦慮」（擔心忘記取消訂閱）
   - 價值主張更清晰（一次付費，永久使用）
   - 決策流程更簡單（選方案 → 付款，無需考慮計費週期）

3. **商業考量**
   - 預付現金流改善
   - 減少月費用戶流失率
   - 符合 SaaS 終身優惠趨勢（AppSumo 模式）

**權衡**：
- ❌ 失去月費用戶的穩定現金流
- ❌ 降低嘗試門檻（月費僅 NT$ 699）
- ✅ 簡化程式碼維護
- ✅ 提高客戶終身價值（LTV）

**替代方案**：
- 保留月費作為「試用升級路徑」（被否決：增加複雜度）
- 提供「先月費後轉終身」選項（被否決：系統複雜度過高）

---

### AD-2: Token 配額按月重置
**決策**：即使是終身方案，每月 Token 配額仍按月重置，而非一次性給予。

**理由**：
1. **防止濫用**
   - 避免用戶囤積大量 Token 後長期不使用
   - 確保資源公平分配

2. **成本可控**
   - AI API 成本是按使用量計費（OpenAI、Claude 等）
   - 月重置降低極端用量的財務風險

3. **鼓勵持續使用**
   - 「用或失去」（Use it or lose it）心理促使用戶定期使用產品
   - 提高產品黏性

**實作細節**：
```sql
-- company_subscriptions 表欄位
monthly_token_quota: INTEGER,          -- 每月配額總量（如 250000）
monthly_quota_balance: INTEGER,        -- 本月剩餘配額
current_period_end: TIMESTAMP,         -- 下次重置時間

-- 重置邏輯（每月 1 日執行）
UPDATE company_subscriptions
SET
  monthly_quota_balance = monthly_token_quota,
  current_period_end = current_period_end + INTERVAL '1 month'
WHERE
  subscription_tier IN ('starter', 'professional', 'business', 'agency')
  AND current_period_end < NOW();
```

**權衡**：
- ✅ 成本可控
- ✅ 公平性
- ❌ 用戶可能覺得「不夠自由」
- ❌ 需要每月執行重置任務

---

### AD-3: 購買 Token 永不過期
**決策**：透過「Token 購買包」額外購買的 Token 永久有效，不會過期或重置。

**理由**：
1. **彈性補充機制**
   - 用戶在特定月份可能需要更多 Token（如活動月）
   - 提供「安全墊」，避免用戶擔心超額使用

2. **增加收入來源**
   - Token 購買包是額外營收
   - 加價率 30-50%，利潤可觀

3. **心理安全感**
   - 「永不過期」降低購買焦慮
   - 用戶更願意提前購買

**實作細節**：
```sql
-- company_subscriptions 表欄位
purchased_token_balance: INTEGER,  -- 購買的 Token 餘額（永不過期）

-- Token 使用順序
1. 優先使用 monthly_quota_balance（會過期）
2. 當 monthly_quota_balance = 0 時，才使用 purchased_token_balance

-- 前端顯示
總可用 Token = monthly_quota_balance + purchased_token_balance
  ├─ 月配額（剩餘 150K / 250K）- 30 天後重置
  └─ 購買包（剩餘 50K）- 永不過期
```

**權衡**：
- ✅ 增加營收
- ✅ 用戶體驗佳
- ❌ 可能導致部分用戶囤積大量未使用 Token
- ❌ 需額外儲存和追蹤 `purchased_token_balance`

---

### AD-4: 客服層級分離
**決策**：將客服支援等級（support_level）從訂閱方案中獨立出來，作為方案特性之一。

**理由**：
1. **符合業界標準**
   - Google Cloud、AWS、Azure 均採用分層客服
   - Intercom、Zendesk 等 SaaS 產品的標準做法

2. **可擴展性**
   - 未來可能新增更多客服層級（如 VIP）
   - 可能推出「單獨購買客服升級」選項

3. **明確價值主張**
   - 用戶清楚知道不同方案的客服差異
   - TAM（專屬客戶經理）成為企業方案的核心賣點

**客服層級定義**：
```typescript
// src/config/support-tiers.ts
export const SUPPORT_TIERS = {
  community: {
    label: '社群支援',
    response_time: '無保證',
    channels: ['論壇', '文檔'],
    availability: '24/7（自助）'
  },
  standard: {
    label: '標準支援',
    response_time: '48 小時',
    channels: ['Email'],
    availability: '工作日 9:00-18:00'
  },
  priority: {
    label: '優先支援',
    response_time: '24 小時',
    channels: ['Email', '即時聊天'],
    availability: '7×24（聊天工作日）'
  },
  dedicated: {
    label: '專屬客戶經理',
    response_time: '4 小時',
    channels: ['電話', 'Email', '即時聊天'],
    availability: '7×24',
    extras: ['定期業務檢討', '專屬聯繫窗口', '優先功能請求']
  }
} as const;
```

**權衡**：
- ✅ 清晰的價值階梯
- ✅ 易於理解和比較
- ❌ 需建立實際的客服團隊和流程
- ❌ 高階客服成本較高

---

## 資料模型（Data Model）

### 修改後的 `subscription_plans` 表結構

```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,                      -- 方案名稱：FREE, STARTER, PROFESSIONAL, BUSINESS, AGENCY
  slug TEXT UNIQUE NOT NULL,               -- URL slug：free, starter, professional, business, agency
  lifetime_price DECIMAL(10,2),            -- 終身價格（NULL 表示免費方案）
  base_tokens INTEGER NOT NULL,            -- 每月 Token 配額
  features JSONB NOT NULL,                 -- 功能配置
  is_lifetime BOOLEAN DEFAULT true,        -- 是否為終身方案（新用戶皆為 true）
  is_active BOOLEAN DEFAULT true,          -- 是否可購買
  display_order INTEGER,                   -- 定價頁顯示順序
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- features JSONB 結構
{
  "models": ["deepseek-chat", "gemini-2-flash"] | "all",
  "wordpress_sites": 1 | 5 | -1,           -- -1 表示無限
  "images_per_article": -1,                -- -1 表示無限
  "team_members": 1 | 3 | 10 | -1,
  "brand_voices": 0 | 1 | 3 | -1,
  "api_access": true | false,
  "white_label": true | false,
  "support_level": "community" | "standard" | "priority" | "dedicated"
}
```

### `company_subscriptions` 表變更

```sql
-- 新增/保留欄位
ALTER TABLE company_subscriptions
  ADD COLUMN IF NOT EXISTS monthly_token_quota INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_quota_balance INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchased_token_balance INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP,
  ADD COLUMN IF NOT EXISTS is_lifetime BOOLEAN DEFAULT false;

-- 移除欄位（標記為 deprecated，實際可能保留以維持向後兼容）
-- billing_cycle, next_billing_date, subscription_status 等
```

---

## 前端組件架構（Frontend Component Architecture）

### 新增組件庫

```
src/components/pricing/
├── PricingCard.tsx               # 方案卡片組件
├── PricingComparison.tsx         # 功能對照表
├── SupportTierBadge.tsx          # 客服等級徽章
├── TokenCalculator.tsx           # Token 使用量計算器
└── LifetimePricingPage.tsx       # 主定價頁面

src/config/
├── support-tiers.ts              # 客服層級配置
└── lifetime-pricing.ts           # 終身定價配置（備用）
```

### PricingCard 組件設計

```tsx
interface PricingCardProps {
  plan: SubscriptionPlan;
  isRecommended?: boolean;
  currentTier?: string | null;
  onSelectPlan: (planId: string) => void;
}

export function PricingCard({ plan, isRecommended, currentTier, onSelectPlan }: PricingCardProps) {
  const isCurrentPlan = currentTier === plan.slug;
  const supportTier = SUPPORT_TIERS[plan.features.support_level];

  return (
    <Card className={cn(
      "relative",
      isRecommended && "border-primary shadow-lg"
    )}>
      {isRecommended && (
        <Badge className="absolute -top-3 right-4">推薦</Badge>
      )}

      <CardHeader>
        <CardTitle>{plan.name}</CardTitle>
        <div className="text-3xl font-bold">
          NT$ {plan.lifetime_price?.toLocaleString()}
          <span className="text-sm text-muted-foreground ml-2">一次付清</span>
        </div>
      </CardHeader>

      <CardContent>
        {/* Token 配額 */}
        <div className="mb-4">
          <div className="text-2xl font-semibold">
            {(plan.base_tokens / 1000).toLocaleString()}K Credits
          </div>
          <div className="text-sm text-muted-foreground">每月重置</div>
        </div>

        {/* 功能列表 */}
        <FeatureList features={plan.features} />

        {/* 客服等級 */}
        <SupportTierBadge tier={supportTier} />
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          onClick={() => onSelectPlan(plan.id)}
          disabled={isCurrentPlan}
        >
          {isCurrentPlan ? '目前方案' : '開始使用'}
        </Button>
      </CardFooter>
    </Card>
  );
}
```

### Token 使用順序邏輯

```typescript
// src/lib/token/usage-service.ts
export async function deductTokens(
  companyId: string,
  amount: number
): Promise<TokenDeductionResult> {
  const subscription = await getCompanySubscription(companyId);

  let remainingAmount = amount;
  let deductedFromMonthly = 0;
  let deductedFromPurchased = 0;

  // Step 1: 優先從月配額扣除
  if (subscription.monthly_quota_balance > 0) {
    deductedFromMonthly = Math.min(
      subscription.monthly_quota_balance,
      remainingAmount
    );
    remainingAmount -= deductedFromMonthly;
  }

  // Step 2: 月配額不足時，從購買包扣除
  if (remainingAmount > 0 && subscription.purchased_token_balance > 0) {
    deductedFromPurchased = Math.min(
      subscription.purchased_token_balance,
      remainingAmount
    );
    remainingAmount -= deductedFromPurchased;
  }

  // Step 3: 仍不足則拋出錯誤
  if (remainingAmount > 0) {
    throw new InsufficientTokensError(
      `需要 ${amount} tokens，但僅剩 ${deductedFromMonthly + deductedFromPurchased}`
    );
  }

  // Step 4: 更新資料庫
  await updateTokenBalances(companyId, {
    monthly_quota_balance: subscription.monthly_quota_balance - deductedFromMonthly,
    purchased_token_balance: subscription.purchased_token_balance - deductedFromPurchased
  });

  return {
    success: true,
    deductedFromMonthly,
    deductedFromPurchased,
    newMonthlyBalance: subscription.monthly_quota_balance - deductedFromMonthly,
    newPurchasedBalance: subscription.purchased_token_balance - deductedFromPurchased
  };
}
```

---

## 遷移策略（Migration Strategy）

### Phase 1: 資料庫遷移（Database Migration）

```sql
-- 1. 備份現有資料
CREATE TABLE subscription_plans_backup_20251111 AS
SELECT * FROM subscription_plans;

-- 2. 清空並重新插入終身方案
TRUNCATE subscription_plans CASCADE;

INSERT INTO subscription_plans (
  name, slug, lifetime_price, base_tokens, features, is_lifetime
) VALUES
  ('FREE', 'free', NULL, 10000, '{"models": ["deepseek-chat"], "wordpress_sites": 0, ...}', true),
  ('STARTER', 'starter', 14900, 50000, '{"models": [...], "support_level": "standard", ...}', true),
  ('PROFESSIONAL', 'professional', 59900, 250000, '{"support_level": "priority", ...}', true),
  ('BUSINESS', 'business', 149900, 750000, '{"support_level": "dedicated", ...}', true),
  ('AGENCY', 'agency', 299900, 2000000, '{"support_level": "dedicated", "white_label": true, ...}', true);

-- 3. 更新現有訂閱
UPDATE company_subscriptions
SET
  is_lifetime = true,
  monthly_token_quota = (
    SELECT base_tokens FROM subscription_plans
    WHERE slug = company_subscriptions.subscription_tier
  );
```

### Phase 2: 前端部署（Frontend Deployment）

1. **部署順序**
   - 先部署後端 API 變更（移除 `billingPeriod` 參數）
   - 再部署前端定價頁面
   - 最後部署 Dashboard 訂閱頁面

2. **功能開關（Feature Flag）**
   ```typescript
   // src/config/feature-flags.ts
   export const FEATURE_FLAGS = {
     LIFETIME_ONLY_PRICING: process.env.NEXT_PUBLIC_LIFETIME_ONLY === 'true'
   };

   // 在定價頁面中使用
   if (FEATURE_FLAGS.LIFETIME_ONLY_PRICING) {
     return <LifetimePricingPage />;
   } else {
     return <LegacyPricingPage />;
   }
   ```

3. **灰度發布（Gradual Rollout）**
   - Week 1: 10% 新用戶看到新定價頁
   - Week 2: 50% 新用戶
   - Week 3: 100% 新用戶，現有用戶繼續使用舊頁面
   - Week 4: 所有用戶遷移至新頁面

---

## 監控與回滾（Monitoring & Rollback）

### 關鍵監控指標

1. **轉換率監控**
   ```typescript
   // 追蹤事件
   - 'pricing_page_view'
   - 'plan_card_click'
   - 'checkout_initiated'
   - 'payment_completed'
   ```

2. **錯誤監控**
   ```typescript
   // Sentry 錯誤追蹤
   - InsufficientTokensError
   - InvalidPlanError
   - PaymentGatewayError
   ```

3. **效能監控**
   ```typescript
   // 頁面載入時間
   - Pricing Page: < 2s (p95)
   - Subscription API: < 500ms (p95)
   ```

### 回滾計畫

**觸發條件**：
- 轉換率下降 > 30%
- 錯誤率上升 > 5%
- 大量用戶投訴（> 10 件/日）

**回滾步驟**：
```bash
# 1. 切換回舊版前端
git revert <commit-hash>
vercel --prod

# 2. 還原資料庫（如必要）
BEGIN;
TRUNCATE subscription_plans CASCADE;
INSERT INTO subscription_plans SELECT * FROM subscription_plans_backup_20251111;
COMMIT;

# 3. 通知用戶
send_email_notification('pricing_rollback', affected_users);
```

---

## 安全性考量（Security Considerations）

### 1. 價格竄改防護
```typescript
// ❌ 錯誤：從客戶端傳遞價格
const createOrder = async (planId: string, price: number) => {
  // 攻擊者可修改 price
};

// ✅ 正確：僅傳遞 planId，伺服器端查詢價格
const createOrder = async (planId: string) => {
  const plan = await db.subscriptionPlans.findUnique({ where: { id: planId } });
  const price = plan.lifetime_price; // 伺服器端決定價格
};
```

### 2. Token 餘額檢查
```typescript
// 在扣除 Token 前，必須加鎖防止競態條件
await db.$transaction(async (tx) => {
  const subscription = await tx.companySubscriptions.findUnique({
    where: { company_id: companyId },
    lock: { mode: 'pessimistic_write' } // 鎖定行
  });

  if (subscription.monthly_quota_balance + subscription.purchased_token_balance < amount) {
    throw new InsufficientTokensError();
  }

  await deductTokens(tx, companyId, amount);
});
```

### 3. 客服層級驗證
```typescript
// 檢查用戶是否有權使用特定客服渠道
export function canAccessSupportChannel(
  userTier: string,
  channel: 'email' | 'chat' | 'phone'
): boolean {
  const tierLevel = TIER_HIERARCHY[userTier];
  const requiredLevels = {
    email: 1,    // standard+
    chat: 2,     // priority+
    phone: 3     // dedicated+
  };

  return tierLevel >= requiredLevels[channel];
}
```

---

## 測試策略（Testing Strategy）

### 單元測試

```typescript
// tests/lib/token/usage-service.test.ts
describe('Token Deduction Logic', () => {
  it('should deduct from monthly quota first', async () => {
    const result = await deductTokens(companyId, 1000);
    expect(result.deductedFromMonthly).toBe(1000);
    expect(result.deductedFromPurchased).toBe(0);
  });

  it('should deduct from purchased balance when monthly quota is exhausted', async () => {
    await exhaustMonthlyQuota(companyId);
    const result = await deductTokens(companyId, 500);
    expect(result.deductedFromMonthly).toBe(0);
    expect(result.deductedFromPurchased).toBe(500);
  });

  it('should throw error when insufficient tokens', async () => {
    await expect(
      deductTokens(companyId, 999999)
    ).rejects.toThrow(InsufficientTokensError);
  });
});
```

### 整合測試

```typescript
// tests/api/payment/create.test.ts
describe('POST /api/payment/create', () => {
  it('should create order for lifetime plan', async () => {
    const response = await POST('/api/payment/create', {
      plan_id: professionalPlanId,
      company_id: testCompanyId
    });

    expect(response.success).toBe(true);
    expect(response.paymentForm).toHaveProperty('tradeInfo');
    expect(response.paymentForm).toHaveProperty('tradeSha');
  });

  it('should reject invalid plan_id', async () => {
    const response = await POST('/api/payment/create', {
      plan_id: 'invalid-id',
      company_id: testCompanyId
    });

    expect(response.success).toBe(false);
    expect(response.error).toBe('方案不存在');
  });
});
```

### E2E 測試（Playwright）

```typescript
// tests/e2e/pricing-flow.spec.ts
test('complete purchase flow', async ({ page }) => {
  await page.goto('/pricing');

  // 選擇 PROFESSIONAL 方案
  await page.click('[data-testid="plan-card-professional"]');
  await page.click('[data-testid="checkout-button"]');

  // 等待跳轉到授權頁面
  await page.waitForURL('/dashboard/billing/authorizing');

  // 驗證支付表單存在
  const form = await page.locator('form[action*="newebpay.com"]');
  expect(await form.count()).toBe(1);
});
```

---

## 效能最佳化（Performance Optimization）

### 1. 定價頁面快取
```typescript
// src/app/pricing/page.tsx
export const revalidate = 3600; // 1 小時快取

export async function generateStaticParams() {
  // 靜態生成定價頁面（無動態內容）
  return [{ locale: 'zh' }, { locale: 'en' }];
}
```

### 2. API 查詢最佳化
```sql
-- 建立索引加速查詢
CREATE INDEX idx_subscription_plans_active
ON subscription_plans(is_active, is_lifetime)
WHERE is_active = true AND is_lifetime = true;

CREATE INDEX idx_company_subscriptions_company_tier
ON company_subscriptions(company_id, subscription_tier);
```

### 3. Token 餘額快取
```typescript
// Redis 快取 Token 餘額（TTL 30 秒）
export async function getTokenBalance(companyId: string): Promise<TokenBalance> {
  const cacheKey = `token_balance:${companyId}`;

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const balance = await db.companySubscriptions.findUnique({
    where: { company_id: companyId },
    select: {
      monthly_quota_balance: true,
      purchased_token_balance: true
    }
  });

  await redis.set(cacheKey, JSON.stringify(balance), 'EX', 30);
  return balance;
}
```

---

## 未來擴展性（Future Extensibility）

### 1. 企業定制方案（Enterprise Custom）
保留 `subscription_plans` 表的彈性，允許未來新增：
```sql
INSERT INTO subscription_plans (
  name, slug, lifetime_price, base_tokens, features
) VALUES (
  'ENTERPRISE', 'enterprise', NULL, 10000000,
  '{"custom_pricing": true, "dedicated_infrastructure": true, ...}'
);
```

### 2. 動態定價（Dynamic Pricing）
```typescript
// 未來可根據用戶屬性調整價格
export async function calculatePrice(
  planId: string,
  userId: string
): Promise<number> {
  const basePlan = await getPlan(planId);
  const user = await getUser(userId);

  let price = basePlan.lifetime_price;

  // 學生折扣
  if (user.isStudent) price *= 0.5;

  // 早鳥優惠
  if (isEarlyBirdPeriod()) price *= 0.8;

  return price;
}
```

### 3. 推薦計畫整合
```sql
-- 新增推薦欄位到 company_subscriptions
ALTER TABLE company_subscriptions
  ADD COLUMN referred_by UUID REFERENCES companies(id),
  ADD COLUMN referral_discount_applied BOOLEAN DEFAULT false;
```

---

## 參考資料（References）

- [AppSumo LTD Pricing Best Practices](https://appsumo.com/blog/lifetime-deals/)
- [OpenAI API Pricing](https://openai.com/api/pricing/)
- [Intercom Credit Buckets Strategy](https://www.intercom.com/blog/pricing/)
- [Google Cloud Support Tiers](https://cloud.google.com/support/docs/overview)
- [Metronome AI Pricing Report 2025](https://www.metronome.com/blog/ai-pricing-report)
