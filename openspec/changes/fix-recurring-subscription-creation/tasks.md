# Tasks: Fix Recurring Subscription Creation Failure

## Phase 1: 診斷和驗證

### Task 1.1: 驗證問題根因
- [x] 檢查資料庫中是否有委託記錄
- [x] 分析日誌找出失敗點
- [x] 確認前後端 API 格式不匹配
- **驗證**: 已確認委託記錄不存在，前端格式期待錯誤

## Phase 2: 修正前端表單提交

### Task 2.1: 統一 subscription-plans.tsx 的表單提交邏輯
- 移除直接提交表單的方式
- 改用 `submitPaymentForm` 函數（與 pricing 頁面相同）
- 跳轉到 `/dashboard/billing/authorizing` 頁面
- **驗證**: 手動測試訂閱流程

### Task 2.2: 加強錯誤處理
- 檢查 `response.ok` 狀態
- 檢查 `data.success` 欄位
- 顯示詳細的錯誤訊息
- **驗證**: 模擬 API 錯誤測試

## Phase 3: 加強後端日誌

### Task 3.1: 改善 PaymentService 日誌
- 委託建立時記錄完整參數
- 資料庫寫入失敗時記錄錯誤詳情
- 成功時記錄委託 ID 和編號
- **驗證**: 檢查日誌輸出

### Task 3.2: 改善 API 端點日誌
- 記錄收到的請求參數
- 記錄 PaymentService 回應
- 記錄回傳給前端的資料
- **驗證**: 完整流程日誌追蹤

## Phase 4: 測試與驗證

### Task 4.1: 整合測試
- 測試完整訂閱流程：
  1. 選擇方案
  2. 建立委託
  3. 跳轉授權頁面
  4. 驗證委託記錄存在
  5. 模擬 NewebPay 回調
  6. 驗證訂閱狀態更新
- **驗證**: 所有步驟成功完成

### Task 4.2: 錯誤情境測試
- 測試資料庫寫入失敗
- 測試網路錯誤
- 測試重複訂閱
- **驗證**: 錯誤處理正確

### Task 4.3: 建置和部署
- 執行 `npm run build` 檢查類型錯誤
- 提交變更並推送
- 等待 Vercel 部署完成
- **驗證**: 部署成功，無錯誤

## Phase 5: 補救措施（可選）

### Task 5.1: 手動補救遺失的委託記錄
- 如果需要，手動建立 `MAN17621498992740331` 委託記錄
- 更新訂閱狀態
- **驗證**: 使用者訂閱恢復正常

## Dependencies

- Task 2.1 是關鍵任務，必須先完成
- Task 3.1 和 3.2 可並行
- Task 4.1 依賴 Phase 2 和 3

## Parallel Work Opportunities

- Phase 2 和 Phase 3 可並行開發
- Task 3.1 和 3.2 可同時進行
