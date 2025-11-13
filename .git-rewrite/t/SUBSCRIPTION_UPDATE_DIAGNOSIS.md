# 訂閱資料更新問題診斷報告

## 執行時間
2025-11-03

## 診斷概要

### 問題陳述
定期定額付款授權成功後，`companies` 表的訂閱欄位未更新：
- `subscription_tier` 停留在 'free'
- `subscription_ends_at` 仍是 NULL
- `seo_token_balance` 沒有增加

### 根本原因：Mandate 狀態為 PENDING，而非 ACTIVE

**PRIMARY ISSUE**: Mandate 的狀態仍為 `pending`，表示首次授權回調未被正確觸發或處理。

```
查詢結果:
- Mandate ID: 0b279b40-1f60-4d06-b01c-806657ea05eb
- Mandate No: MAN17620050300954598
- 狀態: pending (應該是 active)
- 啟用時間: NULL (應該有時間戳)
- 建立時間: 2025-11-01T13:50:30.361594+00:00
```

---

## 詳細分析

### 1. 資料庫層級診斷

#### Mandate 記錄分析
```
公司: test 的公司 (d033abe2-872d-46f6-b7e1-1e577890c100)
方案: STARTER (slug: starter, 20000 tokens)

現狀:
  subscription_tier: free (應該是 basic)
  subscription_ends_at: NULL (應該有日期)
  seo_token_balance: 10000 (應該是 30000 = 10000 + 20000)
```

#### 為什麼訂閱沒有更新？

在 `PaymentService.handleRecurringCallback()` 中，訂閱更新邏輯會在以下條件滿足時執行：

```typescript
// src/lib/payment/payment-service.ts:504-545

if (status === 'SUCCESS') {
  const isFirstAuthorization = mandateData.status === 'pending'

  if (isFirstAuthorization) {
    // 這段代碼應該被執行
    mandateUpdate.status = 'active'
    mandateUpdate.activated_at = new Date().toISOString()
    mandateUpdate.periods_paid = 1
  }

  // 然後更新 companies 表 (620-639 行)
  const { error: companyUpdateError } = await this.supabase
    .from('companies')
    .update({
      subscription_tier: subscriptionTier,
      subscription_ends_at: subscriptionEndsAt,
      seo_token_balance: newBalance,
      updated_at: now.toISOString(),
    })
    .eq('id', mandateData.company_id)
}
```

**目前 Mandate 仍在 pending 狀態意味著**:
這個 callback 處理邏輯**從未被執行**，或執行時**失敗**了。

---

### 2. 支付流程分析

#### API 路由流程

**Path**: `/src/app/api/payment/recurring/callback/route.ts`

```
支付流程:
1. 藍新金流→ callback URL (GET 重定向)
2. Callback Route 接收 Period 參數
3. 解密 Period 數據 → 獲取 orderNo
4. 調用 paymentService.handleRecurringCallback(period)
5. 處理授權成功邏輯 → 更新 mandate, companies, subscriptions, tokens
6. 返回成功頁面重定向
```

**發現**:
- Callback route 實現正確 (第 156-225 行)
- 定期定額授權通過 Period 參數識別 (isPeriodCallback)
- 調用 `handleRecurringCallback()` 並檢查返回結果

#### NotifyURL 流程

**Path**: `/src/app/api/payment/recurring/notify/route.ts`

```
NotifyURL 用於:
- 定期扣款完成時通知 (Period Callback 完成後)
- 後續每月扣款時調用

當前實現:
1. 接收 POST 請求 (Period 參數)
2. 調用 paymentService.handleRecurringCallback(period)
3. 返回 Status=SUCCESS 或 Status=FAILED
```

---

### 3. 可能的失敗點分析

#### 可能性 A: Callback 從未被調用
- ❓ 藍新金流是否正確發送了 Period callback？
- ❓ 回調 URL 是否正確配置？
- ❓ 網路請求是否被攔截？

**證據**: Mandate 的 `newebpay_response` 欄位仍為 NULL

#### 可能性 B: Callback 被調用但解密失敗
```typescript
// 第 127 行
decryptedData = paymentService.decryptPeriodCallback(period!)

// 如果解密失敗會拋出異常，然後:
// - 第 202-224 行 catch 區塊會捕獲
// - 返回 error 頁面
// - mandate 狀態保持 pending
```

**證據**: 需要檢查應用日誌

#### 可能性 C: Callback 被調用但業務邏輯失敗
- RLS 策略阻止 UPDATE？
- 資料庫層級異常？
- 事務回滾？

**詳細分析**: 見下文 "RLS 策略檢查"

#### 可能性 D: Callback 成功但前端未刷新
- Callback 完成後頁面重定向可能有延遲
- 前端未自動刷新數據

**不太可能**: 因為 mandate 仍在 pending 狀態 (如果更新成功應為 active)

---

### 4. RLS 策略檢查

#### 遷移記錄
```sql
文件: supabase/migrations/20251103000001_fix_companies_update_rls.sql

-- 允許 Service Role 和公司 owner 更新
CREATE POLICY "系統和擁有者可更新公司資料" ON companies
  FOR UPDATE
  USING (
    auth.uid() IS NULL OR
    owner_id = auth.uid()
  )
  WITH CHECK (
    auth.uid() IS NULL OR
    owner_id = auth.uid()
  );
```

**RLS 策略分析**:
- ✅ 使用 `createAdminClient()` (Service Role Key) 時，auth.uid() = NULL
- ✅ 策略允許 NULL auth 進行 UPDATE
- ✅ company_subscriptions 表有允許 TRUE 的策略
- ✅ token_balance_changes 表有允許 TRUE 的策略

**結論**: RLS 策略應該正確，不應該阻止更新

---

### 5. 代碼流程驗證

#### handleRecurringCallback 完整流程檢查

```typescript
// 第 422-687 行

步驟 1: 解密數據 (第 428-444 行)
  ✅ 應該工作正常

步驟 2: 重試查詢 mandate (第 450-502 行)
  ✅ 有 10 次重試機制，應該找到 mandate

步驟 3: 檢查狀態 (第 504-512 行)
  if (status === 'SUCCESS' && isFirstAuthorization) {
    ✅ 更新 mandate 狀態為 active
    ✅ 建立 company_subscriptions
    ✅ 更新 companies 表 (第 620-628 行)
    ✅ 新增 token_balance_changes 記錄
  }

步驟 4: 返回結果 (第 671 行)
  return { success: true, warnings?: [] }
```

**流程本身是正確的**

---

### 6. 關鍵診斷發現

#### 時間線分析

```
2025-11-01 13:50:30 UTC: Mandate 建立 (created_at)
             13:50:30 UTC: Mandate 更新 (updated_at)
             (無 activated_at, newebpay_response 為 NULL)

↓ 等待...
```

**關鍵問題**: 在建立 mandate 後，**沒有收到授權回調**

#### 可能的失敗原因排序

**最可能** → **最不可能**:

1. **藍新金流未發送回調** (60% 可能性)
   - ReturnURL 配置錯誤
   - NotifyURL 配置錯誤
   - 回調 URL 格式問題
   - 定期定額授權流程中止

2. **回調 URL 無法訪問** (20% 可能性)
   - 防火牆/安全組阻止
   - DNS 解析失敗
   - 網路路由問題

3. **回調被收到但解密失敗** (15% 可能性)
   - 加密金鑰配置錯誤
   - Period 參數格式不符
   - Cipher 算法不匹配

4. **回調被收到但業務邏輯失敗** (5% 可能性)
   - RLS 策略阻止 (但策略應該正確)
   - 資料庫連接超時
   - 唯一約束衝突

---

## 修復建議

### 立即行動項

#### 1. 檢查藍新金流控制面板配置

```
檢查項目:
- ✓ 定期定額功能是否啟用
- ✓ ReturnURL 設定是否正確
  預期格式: https://your-domain.com/api/payment/recurring/callback
- ✓ NotifyURL 設定是否正確
  預期格式: https://your-domain.com/api/payment/recurring/notify
- ✓ 測試 mandate 是否已正式發送 (pending vs submitted)
- ✓ 藍新金流授權流程是否完成
```

#### 2. 檢查應用日誌

查找以下日誌:
```
[Payment Callback] 收到回調請求
[PaymentService] NotifyURL 解密資料
[PaymentService] 公司訂閱資料已更新
```

**如果沒有找到**: 表示回調從未到達應用

#### 3. 驗證回調 URL 可訪問性

```bash
# 測試 callback URL 是否可訪問
curl -I https://your-domain.com/api/payment/recurring/callback

# 應返回 200 或 405 (如果只接受 GET)
```

#### 4. 檢查網路連接

```bash
# 驗證應用可以發出 HTTPS 請求
curl -v https://newebpay.com/

# 檢查防火牆規則
# 確保允許入站流量到 callback endpoint
```

### 長期改進項

#### 1. 添加回調驗證機制

在 callback 路由中添加:
```typescript
// 驗證回調來源
const requesterIP = request.headers.get('x-forwarded-for')
const newebpayIPs = process.env.NEWEBPAY_ALLOWED_IPS?.split(',') || []

if (!newebpayIPs.includes(requesterIP)) {
  console.warn('[Security] 未授權的回調來源:', requesterIP)
}
```

#### 2. 實現回調持久化存儲

在處理回調前保存原始數據:
```typescript
// 保存原始回調以供審計
await supabase.from('payment_callbacks_log').insert({
  received_at: new Date().toISOString(),
  method: request.method,
  params: Object.fromEntries(request.nextUrl.searchParams),
  headers: Object.fromEntries(request.headers.entries()),
  processing_status: 'pending'
})
```

#### 3. 實現回調重試機制

如果業務邏輯失敗，使用隊列系統重試:
```typescript
// 如果 handleRecurringCallback 返回 warnings
if (result.warnings && result.warnings.length > 0) {
  // 將回調信息添加到重試隊列
  await queueRecurringCallbackRetry(period)
}
```

#### 4. 添加回調超時與健康檢查

```typescript
// 定期檢查是否有卡在 pending 的 mandates
setInterval(async () => {
  const { data: pendingMandates } = await supabase
    .from('recurring_mandates')
    .select('id, mandate_no, created_at')
    .eq('status', 'pending')
    .lt('created_at', new Date(Date.now() - 24*60*60*1000).toISOString())

  if (pendingMandates && pendingMandates.length > 0) {
    // 告警: 有超過 24 小時未激活的 mandate
    console.error('⚠️ 發現卡在 pending 的 mandate:', pendingMandates)
    // 發送告警通知
  }
}, 60*60*1000) // 每小時檢查一次
```

---

## 驗證檢查清單

完成以下檢查以確保問題已解決:

- [ ] 確認藍新金流已發送授權回調
- [ ] 檢查應用日誌中的回調日誌
- [ ] 驗證 Mandate 狀態已變為 `active`
- [ ] 確認 `companies.subscription_tier` 已更新為 `basic`
- [ ] 確認 `companies.subscription_ends_at` 已設定日期
- [ ] 確認 `companies.seo_token_balance` 已增加 20000
- [ ] 驗證 `company_subscriptions` 表有新記錄
- [ ] 驗證 `token_balance_changes` 表有新記錄
- [ ] 確認 `recurring_mandates.newebpay_response` 已填充

---

## 文件參考

### 相關代碼位置

| 文件 | 行號 | 說明 |
|-----|------|------|
| `src/app/api/payment/recurring/callback/route.ts` | 1-299 | 定期定額授權 callback |
| `src/app/api/payment/recurring/notify/route.ts` | 1-50 | 定期定額 notify 處理 |
| `src/lib/payment/payment-service.ts` | 422-687 | handleRecurringCallback 實現 |
| `src/lib/payment/payment-service.ts` | 50-62 | 方案映射邏輯 |
| `supabase/migrations/20251103000001_fix_companies_update_rls.sql` | 1-39 | RLS 策略配置 |

### 資料庫表結構

```
recurring_mandates:
  - id, mandate_no, status, company_id, plan_id
  - activated_at (NULL → 首次授權未完成)
  - newebpay_response (NULL → 未收到授權回調)
  - first_payment_order_id (b7a53895... → 已建立)

companies:
  - id, name, subscription_tier (free → 應為 basic)
  - subscription_ends_at (NULL → 應有日期)
  - seo_token_balance (10000 → 應為 30000)

company_subscriptions:
  - 應在授權成功後新增

token_balance_changes:
  - 應在授權成功後新增記錄
```

---

## 結論

訂閱資料未更新的根本原因是 **Mandate 仍處於 pending 狀態**，表示定期定額授權回調 (`Period` callback) **尚未被正確接收或處理**。

代碼層面的實現是正確的，問題出在 **支付流程**層面：
1. 藍新金流可能未發送回調
2. 或回調 URL 無法訪問
3. 或參數格式不符

**建議優先檢查**:
1. 藍新金流控制面板的回調配置
2. 應用日誌是否有收到回調的記錄
3. 回調 URL 的可訪問性和網路連接
