# Fix Dashboard Subscription

## Why

Dashboard 目前存在兩個關鍵問題：

1. 統計數據（文章數、網站數）使用硬編碼值，無法反映真實資料
2. 訂閱流程配置為年繳但參數錯誤，導致藍新金流授權失敗（錯誤：「年期授權時間資料不正確，無該日期」）

根本原因分析：

- 當前配置 `periodType: 'Y'`（年繳）但 `periodPoint: '1'` 不符合年繳格式（應為 `MMDD`）
- 用戶實際需求為月繳 12 期方案，非年繳
- Credit 餘額卡片誤設為可點擊按鈕，應改為純顯示

## What Changes

### Dashboard 統計數據動態化

- TokenBalanceCard 移除點擊功能，改為純顯示組件
- Dashboard 頁面從資料庫動態讀取文章數（`generated_articles` 表）
- Dashboard 頁面從資料庫動態讀取網站數（`website_configs` 表）
- 移除所有硬編碼的統計數值

### 訂閱流程改為月繳 12 期

- **BREAKING**: 修改 `payment-processing` 為月繳專用（`periodType: 'M'`）
- `newebpay-service.ts` 只接受月繳參數，驗證 `periodPoint` 格式（01-31）
- `payment-service.ts` 固定 `periodType: 'M'`，預設 `periodTimes: 12`
- API 層（`/api/payment/recurring/create`）只接受 `planId` 參數，內部固定所有月繳參數
- 前端組件（UpgradePromptCard, subscription-plans, pricing page）簡化為只傳 `planId`
- Pricing 頁面計費週期改為「月繳 12 期」和「終身方案」
- 更新續約日期計算邏輯，支援月繳並處理月份日期不存在情況

## Impact

### Affected Specs

- **NEW**: `dashboard-stats` - Dashboard 統計數據顯示
- **MODIFIED**: `payment-processing` - 定期定額支付處理邏輯

### Affected Code

- `/src/components/dashboard/TokenBalanceCard.tsx` - 移除點擊功能
- `/src/app/(dashboard)/dashboard/page.tsx` - 新增資料庫查詢
- `/src/lib/payment/newebpay-service.ts` - 月繳參數驗證
- `/src/lib/payment/payment-service.ts` - 月繳邏輯和續約計算
- `/src/app/api/payment/recurring/create/route.ts` - 固定月繳參數
- `/src/components/dashboard/UpgradePromptCard.tsx` - 簡化升級邏輯
- `/src/app/(dashboard)/dashboard/subscription/subscription-plans.tsx` - 簡化訂閱邏輯
- `/src/app/pricing/page.tsx` - 修改計費週期選項

### Breaking Changes

- 現有年繳配置將不再支援（新訂閱限制為月繳）
- API `/api/payment/recurring/create` 參數簡化，不再接受 `periodType`, `periodPoint`, `periodTimes`

### Migration Path

- 現有資料庫記錄保持不變（資料庫層仍支援年繳）
- 新訂閱一律使用月繳 12 期
- 回調處理同時支援月繳和年繳（向後相容）
