# Tasks for fix-onetime-purchase-and-upgrade-logic

## Phase 1: 修復單次購買流程（優先）

### 1.1 檢查並修正訂單創建流程

- [ ] 檢查 `/api/payment/onetime/create` 的實作
- [ ] 確認訂單在資料庫 INSERT 完成後才生成付款表單
- [ ] 驗證 `order_no` 生成邏輯與 NewebPay `MerchantOrderNo` 一致
- [ ] 加入錯誤處理：INSERT 失敗時不生成付款表單
- [ ] 測試：創建 token 包訂單，確認資料庫有記錄

### 1.2 驗證 handleOnetimeCallback 重試機制

- [ ] 檢查 `PaymentService.handleOnetimeCallback()` 的現有實作
- [ ] 確認已有 20 次重試機制（間隔 500ms ~ 2000ms）
- [ ] 確認使用 `.maybeSingle()` 而非 `.single()`
- [ ] 驗證日誌記錄每次重試嘗試
- [ ] 測試：模擬資料庫延遲，確認重試機制運作

### 1.3 修正回調處理邏輯

- [ ] 檢查 `/api/payment/callback` route 實作
- [ ] 確認正確處理 `handleOnetimeCallback` 的返回值
- [ ] 驗證成功時重定向到 `/dashboard/subscription?payment=success`
- [ ] 驗證失敗時重定向到 `/dashboard/subscription?payment=failed&error={error}`
- [ ] 確保錯誤訊息正確 encode 到 URL

### 1.4 實作 Token 包購買業務邏輯

- [ ] 檢查 `handleOnetimeCallback` 中的 token_package 處理
- [ ] 確認使用 `related_id` 查詢 `token_packages` 表
- [ ] 確認正確更新 `companies.seo_token_balance`
- [ ] 加入錯誤處理：token 包不存在、餘額更新失敗
- [ ] 測試：完整的 token 包購買流程

### 1.5 實作終身方案購買業務邏輯

- [ ] 檢查 `handleOnetimeCallback` 中的 lifetime_subscription 處理
- [ ] 確認使用 `related_id` 查詢 `subscription_plans` 表
- [ ] 確認正確更新 `companies.subscription_tier`
- [ ] 確認設定 `subscription_ends_at` 為 NULL
- [ ] 使用 `mapPlanSlugToTier()` 映射方案 slug 到 tier
- [ ] 測試：完整的終身方案購買流程

### 1.6 端到端測試

- [ ] 測試 token 包購買：選擇 → 付款 → 回調 → 餘額更新
- [ ] 測試終身方案購買：選擇 → 付款 → 回調 → 訂閱更新
- [ ] 驗證成功訊息顯示在 subscription 頁面
- [ ] 驗證失敗時顯示錯誤訊息
- [ ] 確認付款成功郵件與系統狀態一致

## Phase 2: 實作升級規則驗證（次要）

### 2.1 創建升級規則驗證函式庫

- [ ] 創建 `src/lib/subscription/upgrade-rules.ts`
- [ ] 實作 `TIER_HIERARCHY` 常數
- [ ] 實作 `canUpgrade()` 函式
- [ ] 加入完整的 JSDoc 註解說明規則
- [ ] 實作單元測試驗證所有升級情境

### 2.2 修正 Pricing 頁面當前方案偵測

- [ ] 修改 `loadUser()` 函式
- [ ] 查詢 `recurring_mandates` 取得 active mandate
- [ ] Join `subscription_plans` 取得 plan slug
- [ ] 設定 `currentTierSlug` 為 plan.slug
- [ ] 根據 `is_lifetime` 和 `period_type` 設定 `currentBillingPeriod`
- [ ] 處理無 active mandate 的情況（使用 company tier）

### 2.3 更新 Pricing 頁面按鈕邏輯

- [ ] 從 `upgrade-rules.ts` 導入 `canUpgrade` 和 `TIER_HIERARCHY`
- [ ] 修改按鈕 `disabled` 屬性使用 `canUpgrade()`
- [ ] 修改按鈕文字：目前方案 / 無法升級 / 開始使用
- [ ] 條件性顯示箭頭圖示
- [ ] 測試各種升級情境的按鈕狀態

### 2.4 實作後端升級驗證

- [ ] 在 `/api/payment/recurring/create` 加入驗證
- [ ] 導入 `canUpgrade` 函式
- [ ] 取得用戶當前 tierSlug 和 billingPeriod
- [ ] 驗證請求的升級是否符合規則
- [ ] 如果不符合，返回錯誤並記錄
- [ ] 測試：嘗試無效的升級請求

### 2.5 撰寫升級規則測試

- [ ] 測試同階層升級：月繳→年繳 ✅
- [ ] 測試同階層縮短：年繳→月繳 ❌
- [ ] 測試跨階層升級：starter→business ✅
- [ ] 測試降級：business→starter ❌
- [ ] 測試終身變更：lifetime→任何 ❌
- [ ] 測試新用戶：free→任何 ✅

### 2.6 端到端測試升級流程

- [ ] 測試月繳用戶看到的可升級方案
- [ ] 測試年繳用戶看到的可升級方案
- [ ] 測試終身用戶無法升級
- [ ] 測試實際執行升級購買流程
- [ ] 驗證後端拒絕無效的升級請求

## Phase 3: 文件與監控

### 3.1 更新相關文件

- [ ] 更新 payment-callbacks spec 反映修正
- [ ] 在 project.md 加入升級規則說明
- [ ] 記錄常見問題與解決方案
- [ ] 更新測試帳號重置腳本

### 3.2 加強日誌記錄

- [ ] 確認所有關鍵步驟都有日誌
- [ ] 統一日誌格式：`[ServiceName] 操作描述`
- [ ] 加入性能追蹤：訂單創建、查詢、更新時間
- [ ] 記錄升級驗證結果

### 3.3 監控與警報

- [ ] 設定 Sentry 追蹤「找不到訂單」錯誤
- [ ] 監控訂單創建失敗率
- [ ] 監控回調處理成功率
- [ ] 設定無效升級嘗試警報

## Dependencies & Parallelization

### 可並行執行

- Phase 1.1-1.3（單次購買基礎設施）可並行
- Phase 2.1-2.2（升級規則函式庫和前端偵測）可並行

### 需依序執行

- Phase 1.4-1.5 依賴 1.1-1.3 完成
- Phase 1.6 依賴 1.4-1.5 完成
- Phase 2.3-2.4 依賴 2.1-2.2 完成
- Phase 2.6 依賴 2.3-2.5 完成
- Phase 3 依賴 Phase 1-2 完成

## Definition of Done

每個任務完成時必須：

- ✅ 程式碼通過 TypeScript 編譯
- ✅ 通過 `npm run lint`
- ✅ 相關測試通過
- ✅ 在本地環境驗證功能
- ✅ 加入適當的錯誤處理
- ✅ 加入必要的日誌記錄
- ✅ 更新相關文件
