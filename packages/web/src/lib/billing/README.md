# Token Billing System - 最終版

完整的 Token 計費系統，支援多模型 AI 使用量計費、月費訂閱、Token 購買包和經銷商計劃。

## 📋 功能清單

### ✅ 已完成

- **4 個月費方案**：STARTER / PROFESSIONAL / BUSINESS / AGENCY
- **終身方案**：享每月配額 + 購買 Token 永久 8 折優惠
- **6 個 Token 購買包**：從入門包（10K Token）到旗艦包（1M Token）
- **Token 分離管理**：
  - `purchased_token_balance`：購買的 Token（永不過期）
  - `monthly_quota_balance`：月費贈送的 Token（每月重置）
  - **使用順序**：先用 `purchased`，再用 `monthly_quota`
- **推薦計劃**：
  - 註冊獎勵：2,000 Token
  - 首購獎勵：推薦者獲得被推薦者首次付費金額 20% 的 Token
  - 首購折扣：被推薦者首次購買 Token 包享 8 折
- **經銷商系統**：
  - 20% 佣金比例（手動管理）
  - 佣金記錄追蹤
  - 收益統計
- **功能限制管理**：WordPress 網站數、配圖數、團隊成員數等

### 🚧 待開發（後續版本）

- 自動排程系統（基礎/進階/智慧）
- 批量生成獎勵
- 每月使用量獎勵
- 連續使用獎勵
- 季節性促銷活動
- 經銷商等級制度（銅/銀/金）

## 💰 定價方案

### 月費方案（Token 配額 ×200%）

| 方案             | 月費      | Token 配額 | 功能亮點                                |
| ---------------- | --------- | ---------- | --------------------------------------- |
| **STARTER**      | NT$ 399   | 20,000     | 1個WP網站、基礎AI模型、基礎排程         |
| **PROFESSIONAL** | NT$ 1,999 | 80,000     | 5個WP網站、所有AI模型、3人團隊、API存取 |
| **BUSINESS**     | NT$ 4,999 | 240,000    | 無限WP網站、智慧排程、10人團隊          |
| **AGENCY**       | NT$ 9,999 | 600,000    | 所有功能無限制、白標服務                |

### Token 購買包

| Token 包 | Token     | 價格      | 每千 Token | 省多少 |
| -------- | --------- | --------- | ---------- | ------ |
| 入門包   | 10,000    | NT$ 99    | NT$ 9.9    | 基準價 |
| 標準包   | 50,000    | NT$ 399   | NT$ 8.0    | 省 19% |
| 進階包   | 100,000   | NT$ 699   | NT$ 7.0    | 省 29% |
| 專業包   | 300,000   | NT$ 1,799 | NT$ 6.0    | 省 39% |
| 企業包   | 500,000   | NT$ 2,499 | NT$ 5.0    | 省 49% |
| 旗艦包   | 1,000,000 | NT$ 3,999 | NT$ 4.0    | 省 60% |

### 終身方案

| 方案                  | 一次性費用 | 每月 Token | 回本期  | 終身優惠           |
| --------------------- | ---------- | ---------- | ------- | ------------------ |
| **終身 STARTER**      | NT$ 2,999  | 20,000     | 7.5個月 | 購買 Token 享 8 折 |
| **終身 PROFESSIONAL** | NT$ 9,999  | 80,000     | 5個月   | 購買 Token 享 8 折 |
| **終身 BUSINESS**     | NT$ 29,999 | 240,000    | 6個月   | 購買 Token 享 8 折 |

## 🏗️ 架構設計

### 資料庫表

```
subscription_plans              -- 月費方案（含功能限制）
token_packages                  -- Token 購買包
company_subscriptions           -- 用戶訂閱狀態
token_usage_logs                -- Token 使用記錄
token_purchases                 -- Token 購買記錄
token_balance_changes           -- Token 餘額變動記錄
monthly_token_usage_stats       -- 月度統計
ai_model_pricing                -- AI 模型定價
resellers                       -- 經銷商資料
commissions                     -- 佣金記錄
```

### 服務類別

```typescript
TokenCalculator; // Token 計算引擎
TokenBillingService; // Token 計費服務（整合 AI 呼叫）
SubscriptionService; // 訂閱管理服務
ResellerService; // 經銷商管理服務
```

## 💻 使用範例

### 1. 初始化服務

```typescript
import { createClient } from "@/lib/supabase/server";
import {
  TokenBillingService,
  SubscriptionService,
  ResellerService,
} from "@/lib/billing";

const supabase = await createClient();
const billingService = new TokenBillingService(supabase);
const subscriptionService = new SubscriptionService(supabase);
const resellerService = new ResellerService(supabase);
```

### 2. 查詢可用方案

```typescript
const plans = await subscriptionService.getAvailablePlans();

const { data: packages } = await supabase
  .from("token_packages")
  .select("*")
  .order("tokens", { ascending: true });
```

### 3. 建立訂閱

```typescript
// 月費訂閱
const result = await subscriptionService.createSubscription(
  companyId,
  planId,
  false, // isLifetime
);

// 終身訂閱（8 折優惠）
const lifetimeResult = await subscriptionService.createSubscription(
  companyId,
  lifetimePlanId,
  true, // isLifetime
);
```

### 4. 使用 Token 生成文章

```typescript
import { AIClient } from "@/lib/ai/ai-client";

const aiClient = new AIClient({ apiKey: process.env.OPENROUTER_API_KEY });

// 檢查餘額（總餘額、購買的、月配額）
const balance = await billingService.getCurrentBalance(companyId);
console.log(`總餘額: ${balance.total}`);
console.log(`購買的: ${balance.purchased}（優先使用）`);
console.log(`月配額: ${balance.monthlyQuota}（用完購買的再用這個）`);

// 執行並自動扣除（先扣 purchased，再扣 monthly_quota）
const result = await billingService.completeWithBilling(
  aiClient,
  companyId,
  userId,
  articleId,
  prompt,
  { model: "claude-3-5-sonnet", temperature: 0.7 },
  "article_generation",
);

console.log(`實際扣除: ${result.billing.chargedTokens} tokens`);
console.log(`新餘額: ${result.billing.balanceAfter}`);
```

### 5. 購買 Token 包

```typescript
// 一般購買
const purchaseResult = await subscriptionService.purchaseTokenPackage(
  companyId,
  packageId,
  paymentId,
);

// 終身會員自動享 8 折
```

### 6. 經銷商管理（手動）

```typescript
// 查詢經銷商資料
const reseller = await resellerService.getReseller(companyId);
console.log(`佣金比例: ${reseller.commissionRate * 100}%`);

// 建立佣金記錄
const result = await resellerService.createCommission({
  resellerId: reseller.id,
  orderType: "subscription",
  orderId: subscriptionId,
  customerCompanyId: customerId,
  orderAmount: 1999,
});

// 查詢佣金記錄
const commissions = await resellerService.getCommissions(reseller.id, {
  status: "pending",
  limit: 10,
});

// 核准佣金
await resellerService.approveCommission(commissionId, "已審核通過");

// 支付佣金
await resellerService.payCommission(commissionId, "已匯款");

// 查詢收益
const earnings = await resellerService.getTotalEarnings(reseller.id);
console.log(`待審核: ${earnings.pending}`);
console.log(`已核准: ${earnings.approved}`);
console.log(`已支付: ${earnings.paid}`);
```

## 📊 計費公式

### Token 計算

```
charged_tokens = official_tokens × model_multiplier × 2.0

範例：
- DeepSeek-Chat (1x): 1000 官方 → 2000 charged
- Claude 3.5 (2x): 1000 官方 → 4000 charged
```

### 模型分類

**基礎模型（1x）**：

- `gemini-2-flash`
- `deepseek-chat`
- `gpt-5-mini`

**進階模型（2x）**：

- `gemini-2.5-pro`
- `deepseek-reasoner`
- `gpt-5`
- `claude-3-5-sonnet`
- `claude-4-5-sonnet`

## 🎯 功能限制

| 功能           | STARTER | PRO  | BUSINESS | AGENCY |
| -------------- | ------- | ---- | -------- | ------ |
| WordPress 網站 | 1個     | 5個  | 無限     | 無限   |
| 配圖/篇        | 1-3     | 1-5  | 無限     | 無限   |
| AI 模型        | 基礎    | 全部 | 全部     | 全部   |
| 排程系統       | 基礎    | 進階 | 智慧     | 智慧   |
| 品牌聲音       | 0個     | 1個  | 3個      | 無限   |
| 團隊協作       | 1人     | 3人  | 10人     | 無限   |
| API 存取       | ❌      | ✅   | ✅       | ✅     |
| 白標服務       | ❌      | ❌   | ❌       | ✅     |

## 🚀 部署步驟

### 1. 執行 Migration

```bash
# 執行最終定價更新
supabase migration up 20251030120000_final_pricing_update.sql
```

### 2. 驗證資料

```sql
-- 檢查方案（應該有 7 個）
SELECT name, monthly_price, base_tokens, is_lifetime, lifetime_price
FROM subscription_plans
ORDER BY is_lifetime, monthly_price;

-- 檢查 Token 包（應該有 6 個）
SELECT name, tokens, price
FROM token_packages
ORDER BY tokens;
```

### 3. 新增經銷商（手動）

```sql
-- 新增經銷商
INSERT INTO resellers (company_id, commission_rate, status, notes)
VALUES ('company-uuid-here', 0.200, 'active', '初期經銷商');
```

## 🔐 安全性

- ✅ Row Level Security (RLS) 已啟用
- ✅ Token 扣除使用 transaction 保證原子性
- ✅ 經銷商資料僅自己可見
- ✅ 佣金記錄有完整的審核流程

## 📝 重要注意事項

1. **Token 使用順序**：**先扣 `purchased_token_balance`，再扣 `monthly_quota_balance`**
2. **月配額重置**：每月重置歸零，不累積
3. **終身方案優惠**：購買 Token 包自動享 8 折（`lifetime_discount = 0.8`）
4. **推薦獎勵**：註冊立即給 2,000 Token，首次付費後推薦者獲得 20% 佣金
5. **經銷商佣金**：初期統一 20%，手動管理
6. **Token 永不過期**：購買的 Token 永久有效

## 🔄 後續開發

1. **自動排程系統**
   - 基礎排程（7天）
   - 進階排程（30天）
   - 智慧排程（無限，GA優化）

2. **獎勵機制**
   - 批量生成獎勵（5%-20%）
   - 每月使用量獎勵
   - 連續使用獎勵（3/6/12/24個月）

3. **經銷商升級**
   - 等級制度（銅/銀/金）
   - 累進式佣金
   - 自動化審核

4. **前端 UI**
   - 訂閱方案選擇頁
   - Token 購買頁
   - 推薦碼分享頁
   - 經銷商後台
