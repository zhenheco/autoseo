# 實作藍新金流支付整合

## Why

Auto-pilot SEO 需要支付系統來處理訂閱計畫、代幣包和終身方案的購買。藍新金流（NewebPay）是台灣主流的第三方支付服務，能提供信用卡單次付款和定期定額扣款功能。當前系統已有部分實作，但需要完整的規範來確保：

1. 支付流程的可靠性和一致性
2. 正確處理同步和非同步回調
3. 資料庫複製延遲的容錯機制
4. 使用者體驗的優化（狀態輪詢、錯誤處理）

## What Changes

### 新增功能

- **單次付款流程**：支援訂閱計畫、代幣包、終身方案的一次性付款
- **定期定額流程**：支援月/年週期的自動扣款授權和管理
- **支付回調處理**：處理藍新的 ReturnURL 和 NotifyURL 回調
- **訂單狀態查詢**：提供輪詢 API 供前端查詢支付狀態
- **資料庫重試機制**：應對 Supabase 複製延遲（1-5 秒）

### 修改的現有邏輯

- payment-service.ts: 添加重試機制到 `handleRecurringCallback`
- order-status API: 支援 mandate_no 查詢
- 前端輪詢組件: 改進錯誤處理和停止條件

### 技術債務清理

- 移除未使用的 payment-service-refactored.ts
- 統一 orderNo/mandateNo 的命名規範
- 補充完整的 TypeScript 類型定義

## Impact

### Affected Specs

- **payment-processing** (新增): 定義支付創建和訂單管理
- **payment-callbacks** (新增): 定義回調處理邏輯和錯誤恢復
- **payment-status** (新增): 定義狀態查詢和前端輪詢

### Affected Code

- `/src/lib/payment/payment-service.ts` - 核心支付邏輯
- `/src/lib/payment/newebpay-service.ts` - 藍新 API 整合
- `/src/app/api/payment/*/route.ts` - API 端點
- `/src/app/(dashboard)/dashboard/billing/` - 前端頁面
- `/src/components/billing/PaymentStatusChecker.tsx` - 輪詢組件
- Database: `payment_orders`, `recurring_mandates` 表

### Breaking Changes

無。此為新功能的完整規範化，不影響現有功能。

### Migration Required

無。現有資料庫 schema 已支援。

### Performance Considerations

- 重試機制最多增加 5 秒延遲
- 前端輪詢每 2 秒一次，最多 90 次（3 分鐘）
- 建議監控 Supabase 查詢延遲
