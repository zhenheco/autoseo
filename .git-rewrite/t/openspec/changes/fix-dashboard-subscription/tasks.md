# Implementation Tasks

## 1. Dashboard 統計數據動態化

### 1.1 修改 TokenBalanceCard 組件

- [x] 1.1.1 移除 `<Link>` 包裝，改為 `<div>`
- [x] 1.1.2 移除 hover 效果 CSS（`hover:bg-accent`, `cursor-pointer`）
- [x] 1.1.3 保持 Token 餘額從 API 讀取的邏輯
- [x] 1.1.4 驗證卡片為純顯示，無法點擊

**檔案**: `/src/components/dashboard/TokenBalanceCard.tsx`

### 1.2 Dashboard 頁面新增資料庫查詢

- [x] 1.2.1 在 Server Component 中新增公司 ID 查詢
- [x] 1.2.2 實作文章數查詢（`generated_articles` 表，使用 `count: 'exact', head: true`）
- [x] 1.2.3 實作網站數查詢（`website_configs` 表，篩選 `is_active: true`）
- [x] 1.2.4 將動態數值傳遞給 StatCard 組件
- [x] 1.2.5 處理查詢失敗的 fallback（顯示 0）

**檔案**: `/src/app/(dashboard)/dashboard/page.tsx`

### 1.3 驗證 Dashboard 功能

- [ ] 1.3.1 確認文章數顯示真實數據
- [ ] 1.3.2 確認網站數顯示真實數據
- [ ] 1.3.3 確認 Credit 餘額卡片不可點擊
- [ ] 1.3.4 測試無公司會員資格時顯示為 0

## 2. 金流核心修正（月繳支援）

### 2.1 修改 newebpay-service.ts

- [x] 2.1.1 在 `createRecurringPayment()` 新增 periodType 驗證（只接受 'M'）
- [x] 2.1.2 新增 periodPoint 格式驗證（1-31）
- [x] 2.1.3 實作 periodPoint 兩位數格式化（`padStart(2, '0')`）
- [x] 2.1.4 移除年繳相關邏輯
- [x] 2.1.5 確認 Period 參數格式符合藍新金流要求

**檔案**: `/src/lib/payment/newebpay-service.ts` (line 146-201)

### 2.2 修改 payment-service.ts 介面

- [x] 2.2.1 更新 `CreateRecurringOrderParams` interface（periodType 固定為 'M'）
- [x] 2.2.2 新增 periodType 驗證邏輯
- [x] 2.2.3 實作 periodPoint 預設值（當天日期）
- [x] 2.2.4 計算 total_amount（月費 × 12）
- [x] 2.2.5 更新資料庫寫入邏輯（period_type, period_point, period_times）

**檔案**: `/src/lib/payment/payment-service.ts` (line 130-244)

### 2.3 修改 payment-service.ts 續約計算

- [x] 2.3.1 實作 `calculateNextPaymentDate()` 月繳邏輯
- [x] 2.3.2 處理月份日期不存在情況（如 2/31 → 2/28）
- [x] 2.3.3 測試各種邊界情況（1/31, 1/29 在平閏年）
- [x] 2.3.4 移除年繳計算邏輯

**檔案**: `/src/lib/payment/payment-service.ts`

### 2.4 修改 API 層

- [x] 2.4.1 簡化 `/api/payment/recurring/create` 只接受 `planId`
- [x] 2.4.2 內部固定 `periodType: 'M'`
- [x] 2.4.3 內部固定 `periodTimes: 12`
- [x] 2.4.4 內部固定 `periodPoint: String(new Date().getDate())`
- [x] 2.4.5 內部固定 `periodStartType: 2`
- [x] 2.4.6 使用方案的 `price` 作為月費
- [x] 2.4.7 描述改為「月繳方案（12期）」
- [x] 2.4.8 移除前端傳入的參數驗證

**檔案**: `/src/app/api/payment/recurring/create/route.ts` (line 6-180)

### 2.5 測試金流參數

- [ ] 2.5.1 驗證提交到藍新金流的 `PeriodType` 為 'M'
- [ ] 2.5.2 驗證 `PeriodPoint` 格式為兩位數（'01'-'31'）
- [ ] 2.5.3 驗證 `PeriodTimes` 為 12
- [ ] 2.5.4 驗證 `PeriodAmt` 為月費金額
- [ ] 2.5.5 確認不會再出現「年期授權時間資料不正確」錯誤

## 3. 前端訂閱入口修正

### 3.1 修改 UpgradePromptCard

- [x] 3.1.1 簡化 `handleUpgrade()` 只傳 `planId`
- [x] 3.1.2 移除硬編碼的 `periodType`, `periodPoint`, `periodTimes`
- [x] 3.1.3 保持錯誤處理邏輯
- [ ] 3.1.4 測試升級流程

**檔案**: `/src/components/dashboard/UpgradePromptCard.tsx` (line 63-144)

### 3.2 修改 subscription-plans

- [x] 3.2.1 簡化 `handleSubscribe()` 只傳 `planId`
- [x] 3.2.2 移除硬編碼參數
- [x] 3.2.3 保持錯誤處理
- [ ] 3.2.4 測試訂閱流程

**檔案**: `/src/app/(dashboard)/dashboard/subscription/subscription-plans.tsx` (line 23-70)

### 3.3 修改 Pricing 頁面

- [x] 3.3.1 修改計費週期狀態類型（'monthly' | 'lifetime'）
- [x] 3.3.2 更新計費週期切換按鈕文字（「月繳 12 期」、「終身方案」）
- [x] 3.3.3 修改 `getPlanPrice()` 函數（月繳顯示總價 = 月費 × 12）
- [x] 3.3.4 更新價格顯示邏輯（顯示「每月 $XXX」）
- [x] 3.3.5 新增「共 12 期，總計 $XXX」提示
- [x] 3.3.6 修改 `handlePlanPurchase()` 月繳邏輯（只傳 planId）
- [x] 3.3.7 移除年繳選項和相關邏輯

**檔案**: `/src/app/pricing/page.tsx` (line 199-375)

### 3.4 驗證前端功能

- [ ] 3.4.1 Pricing 頁面顯示「月繳（12期）」和「終身」選項
- [ ] 3.4.2 月繳價格顯示正確（每月 + 總計）
- [ ] 3.4.3 所有訂閱入口正確調用 API
- [ ] 3.4.4 可以成功跳轉到金流授權頁面

## 4. 回調處理驗證

### 4.1 測試首次授權回調

- [ ] 4.1.1 首次授權成功回調正確處理
- [ ] 4.1.2 訂閱狀態更新為 `active`
- [ ] 4.1.3 Token 配額正確發放
- [ ] 4.1.4 資料庫記錄正確

### 4.2 測試每月扣款回調

- [ ] 4.2.1 每月扣款回調正確處理
- [ ] 4.2.2 下次扣款日計算正確
- [ ] 4.2.3 期數計數正確遞增
- [ ] 4.2.4 第 12 期完成後訂閱狀態正確

### 4.3 測試邊界情況

- [ ] 4.3.1 1/31 訂閱在 2 月的扣款日（2/28 或 2/29）
- [ ] 4.3.2 1/29 訂閱在平年 2 月的扣款日（2/28）
- [ ] 4.3.3 扣款失敗的處理

## 5. 完整測試

### 5.1 端到端測試

- [ ] 5.1.1 新用戶註冊 → 選擇月繳方案 → 授權成功
- [ ] 5.1.2 免費用戶升級 → 月繳方案 → 授權成功
- [ ] 5.1.3 Dashboard 統計數據正確
- [ ] 5.1.4 訂閱頁面顯示正確

### 5.2 回歸測試

- [ ] 5.2.1 終身方案購買流程正常（不受此次修改影響）
- [ ] 5.2.2 單次 Token 購買流程正常
- [ ] 5.2.3 現有訂閱用戶數據正確顯示

### 5.3 建置和部署驗證

- [ ] 5.3.1 執行 `npm run lint` 無錯誤
- [ ] 5.3.2 執行 `npm run typecheck` 無錯誤
- [x] 5.3.3 執行 `npm run build` 成功
- [ ] 5.3.4 部署到測試環境驗證

## 依賴關係

- 2.1-2.4 應依序完成（金流核心修正有依賴關係）
- 3.1-3.3 可並行執行（前端修改相互獨立）
- 1.1-1.2 可與 3.x 並行（Dashboard 統計與訂閱流程獨立）
- 4.x 需要在 2.x 完成後執行（依賴金流邏輯修正）
- 5.x 需要在所有功能完成後執行（完整測試）
