# Design: 單次購買修復與升級邏輯規範化

## 架構概述

本設計涵蓋兩個主要系統：

1. **單次購買流程（Token 包 & 終身方案）**
2. **訂閱升級規則驗證系統**

## 問題分析

### 問題 1: 單次購買「找不到訂單」
**根本原因**：
- 訂單創建與付款回調之間的時序問題
- Supabase 多區域複製延遲（1-5 秒）
- `handleOnetimeCallback` 查詢訂單時，訂單可能尚未複製到查詢節點

**現有緩解措施**：
- 已實作 20 次重試機制（總計 20-25 秒）
- 使用 `.maybeSingle()` 避免 PGRST116 錯誤

**需要驗證的點**：
1. 訂單創建是否正確 await INSERT 操作
2. 付款表單生成是否在訂單創建後
3. `MerchantOrderNo` 與資料庫 `order_no` 是否完全一致

### 問題 2: 升級邏輯不明確
**根本原因**：
- 前端使用 `company.subscription_tier` 而非實際的 plan slug
- `company.subscription_tier` 與 `subscription_plans.slug` 有映射關係
  - 例如：agency slug → enterprise tier
- 沒有統一的升級規則驗證函式

**需要修正的點**：
1. 從 `recurring_mandates` 取得實際的 plan slug
2. 實作統一的升級規則驗證
3. 前後端使用相同的驗證邏輯

## 系統設計

### 1. 單次購買流程設計

```
用戶操作                      前端                      後端                    NewebPay                 回調處理
  |                          |                        |                        |                        |
  | 點擊購買 Token 包/終身    |                        |                        |                        |
  |------------------------>|                        |                        |                        |
  |                          | POST /api/payment/    |                        |                        |
  |                          | onetime/create        |                        |                        |
  |                          |---------------------->|                        |                        |
  |                          |                        | 1. INSERT payment_orders                       |
  |                          |                        |    (await 完成)       |                        |
  |                          |                        | 2. 生成付款表單       |                        |
  |                          |                        |    (MerchantOrderNo)  |                        |
  |                          |<----------------------|                        |                        |
  |                          | 返回付款表單資料       |                        |                        |
  |<------------------------|                        |                        |                        |
  | 顯示授權頁面              |                        |                        |                        |
  |                          | 自動提交表單到         |                        |                        |
  |                          | NewebPay              |---------------------->|                        |
  |                          |                        |                        | 用戶完成付款           |
  |                          |                        |                        |---------------------->|
  |                          |                        |                        |                        | 1. 解密 TradeInfo
  |                          |                        |                        |                        | 2. 重試查詢訂單
  |                          |                        |                        |                        |    (最多 20 次)
  |                          |                        |                        |                        | 3. 更新訂單狀態
  |                          |                        |                        |                        | 4. 處理業務邏輯
  |                          |                        |                        |                        |    (Token/訂閱)
  |                          |                        |<------------------------------------------------|
  |                          |                        | ReturnURL 重定向     |                        |
  |                          |<----------------------|                        |                        |
  | 顯示成功/失敗訊息         |                        |                        |                        |
```

**關鍵設計決策**：
1. **等待訂單創建完成**：在生成付款表單前，必須 await INSERT 操作
2. **延長重試時間**：20 次重試，總計 20-25 秒，應對最壞情況
3. **使用 MerchantOrderNo 一致性**：確保 NewebPay 和資料庫使用相同的 order_no

### 2. 升級規則驗證系統設計

```
┌─────────────────────────────────────────────────────────────────┐
│                    Upgrade Rules Library                         │
│                 (src/lib/subscription/upgrade-rules.ts)          │
│                                                                  │
│  export const TIER_HIERARCHY = {                                │
│    'free': 0, 'starter': 1, 'business': 2,                     │
│    'professional': 3, 'agency': 4                              │
│  }                                                              │
│                                                                  │
│  export function canUpgrade(                                    │
│    currentTierSlug, currentBillingPeriod,                      │
│    targetPlanSlug, targetBillingPeriod                         │
│  ): boolean {                                                   │
│    // 驗證邏輯                                                  │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
              ↑                              ↑
              │                              │
              │ import                       │ import
              │                              │
    ┌─────────┴────────┐         ┌─────────┴─────────┐
    │  Pricing 頁面     │         │  Backend API      │
    │  (前端驗證)       │         │  (後端驗證)       │
    └──────────────────┘         └───────────────────┘
```

**資料流設計**：

```
Pricing 頁面載入
  ↓
查詢用戶的 active recurring_mandate
  ↓
JOIN subscription_plans 取得 plan slug
  ↓
設定 currentTierSlug = plan.slug
設定 currentBillingPeriod = (is_lifetime ? 'lifetime' : period_type)
  ↓
遍歷所有方案
  ↓
對每個方案呼叫 canUpgrade(currentTierSlug, currentBillingPeriod, plan.slug, billingPeriod)
  ↓
根據返回值設定按鈕狀態：
  - false → disabled, 顯示「目前方案」或「無法升級」
  - true → enabled, 顯示「開始使用」
```

**關鍵設計決策**：
1. **使用 plan slug 而非 company tier**：避免映射混淆
2. **統一驗證邏輯**：前後端使用相同的 `canUpgrade()` 函式
3. **從 mandate 取得當前方案**：確保使用用戶實際訂閱的方案

### 3. 升級規則邏輯

```typescript
function canUpgrade(
  currentTierSlug: string | null,
  currentBillingPeriod: 'monthly' | 'yearly' | 'lifetime',
  targetPlanSlug: string,
  targetBillingPeriod: 'monthly' | 'yearly' | 'lifetime'
): boolean {
  // 新用戶（沒有當前方案）→ 允許任何升級
  if (!currentTierSlug) return true

  const currentTierLevel = TIER_HIERARCHY[currentTierSlug] ?? 0
  const targetTierLevel = TIER_HIERARCHY[targetPlanSlug] ?? 0

  // 終身方案 → 不允許任何變更
  if (currentBillingPeriod === 'lifetime') {
    return false
  }

  // 升級到更高階層 → 允許（任何計費週期）
  if (targetTierLevel > currentTierLevel) {
    return true
  }

  // 同階層 → 只允許延長計費週期
  if (targetTierLevel === currentTierLevel) {
    // 月繳 → 年繳或終身 ✅
    if (currentBillingPeriod === 'monthly' &&
        (targetBillingPeriod === 'yearly' || targetBillingPeriod === 'lifetime')) {
      return true
    }
    // 年繳 → 終身 ✅
    if (currentBillingPeriod === 'yearly' && targetBillingPeriod === 'lifetime') {
      return true
    }
    return false
  }

  // 降級到低階層 → 不允許
  if (targetTierLevel < currentTierLevel) {
    return false
  }

  return false
}
```

## 資料庫互動

### 單次購買流程

```sql
-- 1. 創建訂單
INSERT INTO payment_orders (
  order_no, company_id, amount, status,
  payment_type, related_id, description
) VALUES (
  'ORD{timestamp}{random}', :company_id, :amount, 'pending',
  :payment_type, :related_id, :description
) RETURNING *;

-- 2. 回調查詢訂單（重試機制）
SELECT * FROM payment_orders
WHERE order_no = :order_no
LIMIT 1;

-- 3. 更新訂單狀態
UPDATE payment_orders
SET status = 'success',
    newebpay_status = :status,
    newebpay_trade_no = :trade_no,
    paid_at = NOW()
WHERE id = :order_id;

-- 4. Token 包：更新餘額
UPDATE companies
SET seo_token_balance = seo_token_balance + :token_amount
WHERE id = :company_id;

-- 5. 終身方案：更新訂閱
UPDATE companies
SET subscription_tier = :tier,
    subscription_ends_at = NULL
WHERE id = :company_id;
```

### 升級規則驗證查詢

```sql
-- 1. 取得用戶當前方案
SELECT
  rm.period_type,
  rm.subscription_plan_id,
  sp.slug,
  sp.is_lifetime
FROM recurring_mandates rm
JOIN subscription_plans sp ON sp.id = rm.subscription_plan_id
WHERE rm.company_id = :company_id
  AND rm.status = 'active'
ORDER BY rm.created_at DESC
LIMIT 1;

-- 2. 如果沒有 mandate，取得 company tier
SELECT subscription_tier
FROM companies
WHERE id = :company_id;
```

## 錯誤處理策略

### 單次購買錯誤處理

| 錯誤情境 | 處理方式 | 用戶體驗 |
|---------|---------|---------|
| 訂單創建失敗 | 返回錯誤，不生成付款表單 | 顯示錯誤訊息，停留在選購頁面 |
| 付款表單生成失敗 | 記錄錯誤，刪除訂單 | 顯示錯誤訊息，引導重試 |
| 找不到訂單（重試後） | 記錄詳細日誌，返回錯誤 | 顯示「找不到訂單」，引導聯繫客服 |
| 訂單狀態更新失敗 | 記錄錯誤，保留訂單為 pending | 顯示錯誤，可透過重新查詢恢復 |
| Token 更新失敗 | 回滾訂單狀態，記錄錯誤 | 顯示錯誤，引導聯繫客服 |

### 升級規則錯誤處理

| 錯誤情境 | 處理方式 | 用戶體驗 |
|---------|---------|---------|
| 查詢 mandate 失敗 | 使用 company tier 作為 fallback | 仍可顯示方案，但可能不準確 |
| 無效升級嘗試（前端） | 禁用按鈕，顯示「無法升級」 | 清楚說明為何不能升級 |
| 無效升級嘗試（後端） | 拒絕請求，返回錯誤訊息 | 顯示錯誤，防止繞過前端驗證 |

## 日誌與監控

### 單次購買日誌

```
[Payment] 創建訂單: {order_no}, 類型: {payment_type}, 金額: {amount}
[Payment] 生成付款表單: {order_no}
[PaymentCallback] 收到回調: {order_no}
[PaymentService] 查詢訂單 (嘗試 N/20): {order_no}
[PaymentService] 成功找到訂單 (第 N 次嘗試)
[PaymentService] 更新訂單狀態: {order_no} → {status}
[PaymentService] 處理 Token 包: +{amount} tokens
[PaymentService] 處理終身訂閱: {tier}
```

### 升級規則日誌

```
[UpgradeValidation] 用戶嘗試升級: {company_id}
[UpgradeValidation] 當前: {current_tier} {current_period}
[UpgradeValidation] 目標: {target_tier} {target_period}
[UpgradeValidation] 結果: {allowed/denied}, 原因: {reason}
```

## 測試策略

### 單次購買測試

1. **單元測試**
   - `handleOnetimeCallback` 解密邏輯
   - 訂單狀態更新邏輯
   - Token 餘額計算邏輯

2. **整合測試**
   - 訂單創建 → 資料庫查詢
   - 重試機制（模擬延遲）
   - 完整回調處理流程

3. **端到端測試**
   - 真實付款流程（測試環境）
   - Token 包購買並驗證餘額
   - 終身方案購買並驗證訂閱狀態

### 升級規則測試

1. **單元測試 `canUpgrade()`**
   - 所有合法升級情境 ✅
   - 所有非法升級情境 ❌
   - 邊界條件（null, free tier）

2. **前端整合測試**
   - Pricing 頁面按鈕狀態
   - 不同用戶看到的可升級方案
   - 按鈕點擊行為

3. **後端整合測試**
   - API 驗證非法升級請求
   - 查詢 mandate 邏輯
   - 錯誤處理

## 部署計劃

### Phase 1: 修復單次購買（高優先級）
1. 驗證現有程式碼
2. 修正任何發現的問題
3. 加強日誌和錯誤處理
4. 在測試環境驗證
5. 部署到生產環境
6. 監控錯誤率

### Phase 2: 升級規則（中優先級）
1. 實作升級規則函式庫
2. 更新 Pricing 頁面
3. 加入後端驗證
4. 在測試環境驗證所有情境
5. 部署到生產環境
6. 監控無效升級嘗試

## 風險與緩解

### 風險 1: 資料庫延遲超過 25 秒
**緩解**：
- 加入 NotifyURL 作為備援機制
- NotifyURL 可以在 ReturnURL 失敗後異步處理
- 提供用戶手動重新查詢按鈕

### 風險 2: 升級規則變更
**緩解**：
- 升級規則集中在一個函式
- 修改規則只需更新一處
- 完整的測試覆蓋確保變更安全

### 風險 3: Plan slug 與 company tier 映射不一致
**緩解**：
- 使用 `mapPlanSlugToTier()` 統一映射
- 在升級規則中只使用 plan slug
- 避免直接比較 tier 與 slug
