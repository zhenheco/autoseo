# 修復單次購買訂單查詢與升級邏輯規範化

## Why
用戶在購買 Token 包和終身方案時遇到「找不到訂單」錯誤，雖然付款成功但無法使用購買的服務。同時，訂閱升級規則不明確導致用戶可以看到不符合業務邏輯的升級選項（例如降級或終身方案再變更）。這影響了用戶體驗和業務收入，需要立即修復單次購買流程並規範化升級規則驗證。

## What Changes

### Phase 1: 修復單次購買核心問題
1. **RLS 權限修正**
   - 將單次購買回調路由 (`/api/payment/callback`, `/api/payment/notify`) 改用 `createAdminClient()`
   - 修正檔案: `src/app/api/payment/callback/route.ts`, `src/app/api/payment/notify/route.ts`

2. **JSON 解析統一**
   - 修正 `decryptCallback()` 支援 JSON 格式（與定期定額相同）
   - 修正 `handleOnetimeCallback()` 處理兩種格式（JSON 和 URLSearchParams）
   - 修正檔案: `src/lib/payment/newebpay.ts`, `src/lib/payment/payment-service.ts`

### Phase 2: 實作升級規則驗證系統
1. **創建升級規則函式庫**
   - 新增檔案: `src/lib/subscription/upgrade-rules.ts`
   - 實作 `TIER_HIERARCHY`, `canUpgrade()`, `getUpgradeBlockReason()`
   - 包含完整 JSDoc 註解和使用範例

2. **前端整合**
   - 修正 `src/app/pricing/page.tsx` 的 `loadUser()` 查詢當前訂閱狀態
   - 使用 `canUpgrade()` 驗證按鈕是否可點擊

3. **後端驗證**
   - 修正 `src/app/api/payment/recurring/create/route.ts` 加入升級驗證
   - 不符合規則時返回 400 錯誤並記錄日誌

4. **測試**
   - 新增檔案: `src/lib/subscription/upgrade-rules.test.ts`（19 個單元測試）
   - 新增檔案: `src/scripts/test-upgrade-rules.ts`（6 個端到端測試）
   - 新增檔案: `src/scripts/create-test-user.ts`（測試環境準備）

### Phase 3: 文件和驗證
1. **測試計劃**
   - 新增檔案: `TEST_PLAN.md`（完整測試案例）
   - 新增檔案: `MANUAL_TEST_GUIDE.md`（手動測試指南）

2. **問題記錄**
   - 更新 `ISSUELOG.md` 記錄所有問題和解決方案

## 問題描述

目前系統存在兩個關鍵問題：

1. **單次購買「找不到訂單」錯誤**：
   - Token 包購買和終身方案購買（單次購買類型）會跳轉到「找不到訂單」錯誤頁面
   - 雖然用戶收到刷卡成功郵件，但系統無法正確處理訂單狀態
   - `handleOnetimeCallback` 在付款回調時找不到對應的 `payment_orders` 記錄

2. **升級邏輯不明確**：
   - Pricing 頁面的升級判斷邏輯不完整
   - 用戶（例如月繳 agency）看到所有方案都可點擊，包括不應該允許的降級或橫向切換
   - 沒有明確的升級規則驗證機制

## 目標

1. 修復單次購買流程，確保 token 包和終身方案購買可以正常完成
2. 實作明確的訂閱升級規則驗證邏輯
3. 統一定期定額和單次購買的處理流程
4. 確保升級規則在前端和後端都有一致的驗證

## 影響範圍

- `/api/payment/onetime/create` - 單次購買訂單創建
- `/api/payment/callback` - 單次購買回調處理
- `/app/pricing/page.tsx` - 升級邏輯驗證
- `PaymentService.handleOnetimeCallback()` - 訂單查詢與處理
- 新增：升級規則驗證函式庫

## 升級規則規範

### 同階層升級規則
- 月繳 → 年繳 ✅
- 月繳 → 終身 ✅
- 年繳 → 終身 ✅
- 年繳 → 月繳 ❌（無法縮短計費週期）
- 終身 → 任何 ❌（終身方案無法變更）

### 不同階層升級規則
- 階層順序：Free (0) → Starter (1) → Business (2) → Professional (3) → Agency (4)
- 只能升級到更高階層 ✅
- 升級時可選擇任何計費週期（月繳/年繳/終身）✅
- 無法降級到低階層 ❌

## 預期成果

1. Token 包和終身方案購買流程正常運作
2. Pricing 頁面正確顯示可升級/不可升級的方案
3. 所有升級嘗試都經過規則驗證
4. 定期定額和單次購買都能正確處理付款回調
