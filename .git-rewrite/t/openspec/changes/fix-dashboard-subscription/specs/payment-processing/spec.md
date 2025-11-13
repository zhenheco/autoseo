## MODIFIED Requirements

### Requirement: Recurring Payment Mandate Creation
系統 SHALL 建立月繳定期定額支付委託，固定為 12 期月繳方案，並透過藍新金流的定期定額功能處理。

#### Scenario: 建立月繳 12 期委託
- **WHEN** 公司訂閱方案
- **THEN** 系統 SHALL:
  - 生成唯一的 mandate_no，格式為 `SUB{timestamp}{random9chars}`
  - 生成唯一的 order_no 用於首次支付
  - 在 `recurring_mandates` 表插入記錄，status 為 `pending`
  - 在 `payment_orders` 表插入關聯記錄
  - 固定設定 `period_type` 為 `'M'`（月繳）
  - 設定 `period_point` 為當天日期（1-31）
  - 固定設定 `period_times` 為 `12`
  - 設定 `period_start_type` 為 `2`（立即執行委託金額授權）
  - 使用藍新金流 API 生成加密的 Period 參數
  - 回傳包含 `apiUrl`, `postData`, `merchantId` 的支付表單

#### Scenario: 拒絕非月繳訂閱
- **WHEN** 傳入的 `periodType` 不為 `'M'`
- **THEN** 系統 SHALL:
  - 拋出錯誤 `'目前僅支援月繳訂閱（periodType: M）'`
  - 不建立任何資料庫記錄
  - 不生成支付表單

#### Scenario: 驗證 periodPoint 格式
- **WHEN** 建立月繳委託
- **THEN** 系統 SHALL:
  - 使用當天日期作為預設 `periodPoint`（`String(new Date().getDate())`）
  - 驗證 periodPoint 在 1-31 範圍內
  - 將 periodPoint 格式化為兩位數（`padStart(2, '0')`）
  - 若驗證失敗，拋出錯誤 `'月繳的 periodPoint 必須在 1-31 之間'`

#### Scenario: 計算總金額
- **WHEN** 建立月繳 12 期委託
- **THEN** 系統 SHALL:
  - 設定 `period_amount` 為方案月費（`plan.price`）
  - 計算 `total_amount` 為 `period_amount × 12`
  - 將兩者都儲存至 `recurring_mandates` 表

#### Scenario: API 層固定參數
- **WHEN** `/api/payment/recurring/create` 接收請求
- **THEN** API SHALL:
  - 只要求 `planId` 參數
  - 內部固定設定 `periodType: 'M'`
  - 內部固定設定 `periodTimes: 12`
  - 內部固定設定 `periodPoint: String(new Date().getDate())`
  - 內部固定設定 `periodStartType: 2`
  - 使用方案的 `price` 作為月費金額
  - 描述設為 `"${plan.name} 月繳方案（12期）"`

#### Scenario: 前端簡化為只傳 planId
- **WHEN** 前端組件（UpgradePromptCard, subscription-plans, pricing page）呼叫訂閱 API
- **THEN** 只應傳送 `{ planId: plan.id }`
- **AND** 不應傳送 `periodType`, `periodPoint`, `periodTimes`, `periodStartType` 參數
- **AND** 所有參數由後端內部控制

### Requirement: 月繳續約日期計算
系統 SHALL 正確計算月繳訂閱的下次扣款日，並處理月份日期不存在的情況。

#### Scenario: 計算下個月扣款日
- **WHEN** 當前扣款成功，需要計算下次扣款日
- **THEN** 系統 SHALL:
  - 在當前日期基礎上加 1 個月
  - 使用原 `periodPoint` 作為目標日期
  - 若該月沒有該日期（如 2 月沒有 31 號），使用該月最後一天
  - 回傳計算後的 Date 物件

#### Scenario: 處理 1/31 訂閱的 2 月扣款
- **WHEN** 用戶在 1/31 訂閱（periodPoint = "31"）
- **THEN** 2 月的扣款日應為:
  - 平年：2/28
  - 閏年：2/29
- **AND** 3 月的扣款日應恢復為 3/31

#### Scenario: 處理 1/29 訂閱的平年 2 月扣款
- **WHEN** 用戶在 1/29 訂閱（periodPoint = "29"）且當年為平年
- **THEN** 2 月的扣款日應為 2/28（該月最後一天）
- **AND** 3 月的扣款日應恢復為 3/29

### Requirement: Payment Form Generation
系統 SHALL 生成符合藍新金流月繳要求的加密支付表單。

#### Scenario: 生成月繳支付表單
- **WHEN** 建立月繳委託
- **THEN** 系統 SHALL:
  - 使用 AES-256-CBC 加密支付資料（藍新金流 key 和 IV）
  - 包含 mandate_no 作為 MerchantOrderNo
  - 包含 `PeriodType: 'M'`
  - 包含 `PeriodPoint`（格式為兩位數，如 "01", "15", "31"）
  - 包含 `PeriodTimes: '12'`
  - 包含 `PeriodAmt`（方案月費）
  - 包含 `PeriodStartType: '2'`
  - 包含 ReturnURL 指向 `/api/payment/recurring/callback`
  - 包含 NotifyURL 指向 `/api/payment/recurring/notify`
  - 包含 ClientBackURL 指向 `/dashboard/subscription`
  - 生成 SHA256 hash 確保資料完整性
  - 回傳可直接提交的表單資料

#### Scenario: 驗證藍新金流參數格式
- **WHEN** 生成 Period 參數
- **THEN** 系統 SHALL:
  - 確保 `PeriodType` 為字串 `'M'`
  - 確保 `PeriodPoint` 為兩位數字串（`'01'`-`'31'`）
  - 確保 `PeriodTimes` 為數字字串（`'12'`）
  - 確保 `PeriodAmt` 為數字字串（方案月費）
  - 所有金額欄位不包含小數點（整數）
