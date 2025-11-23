# Lifetime Pricing Specification Delta

## ADDED Requirements

### Requirement: 終身方案資料結構

系統 SHALL 支援僅包含終身價格的訂閱方案資料結構，移除月費和年費概念。

#### Scenario: 查詢可用終身方案

- **WHEN** 用戶訪問定價頁面
- **THEN** 系統應返回所有啟用的終身方案（is_lifetime = true AND is_active = true）
- **AND** 每個方案應包含：
  - name（方案名稱）
  - slug（唯一識別碼）
  - lifetime_price（終身價格，FREE 方案為 NULL）
  - base_tokens（每月 Token 配額）
  - features（功能配置 JSONB）
  - display_order（顯示順序）

#### Scenario: 終身方案定價邏輯驗證

- **WHEN** 系統載入終身方案資料
- **THEN** 應驗證以下定價邏輯：
  - STARTER: lifetime_price = 14,900
  - PROFESSIONAL: lifetime_price = 59,900（約 STARTER 的 4.02 倍）
  - BUSINESS: lifetime_price = 149,900（約 PROFESSIONAL 的 2.50 倍）
  - AGENCY: lifetime_price = 299,900（約 BUSINESS 的 2.00 倍）
- **AND** 所有價格應使用 xx,900 結尾（心理定價）

#### Scenario: Token 配額倍增清晰可見

- **WHEN** 用戶比較不同方案
- **THEN** 系統應顯示 Token 配額倍增關係：
  - STARTER: 50K（基準）
  - PROFESSIONAL: 250K（5× STARTER）
  - BUSINESS: 750K（15× STARTER, 3× PROFESSIONAL）
  - AGENCY: 2,000K（40× STARTER, 8× PROFESSIONAL）

### Requirement: 移除月費/年費支援

系統 SHALL NOT 支援月費或年費計費模式，所有新用戶僅能選擇終身方案。

#### Scenario: API 不接受 billingPeriod 參數

- **WHEN** 前端呼叫 `/api/payment/create` API
- **THEN** 該 API 不應接受 `billingPeriod`、`billing_cycle` 或類似參數
- **AND** 應直接使用方案的 `lifetime_price` 建立訂單

#### Scenario: 拒絕建立月費/年費訂單

- **WHEN** 嘗試建立 `billing_cycle` 為 `monthly` 或 `yearly` 的訂單
- **THEN** 系統應返回錯誤：`{ success: false, error: '僅支援終身方案' }`

#### Scenario: 現有月費/年費用戶保留權益

- **WHEN** 現有用戶的 `company_subscriptions.is_lifetime = false`
- **THEN** 系統應允許其繼續使用至當前週期結束
- **AND** 應在 Dashboard 顯示「遷移至終身方案」升級提示
- **AND** 提供遷移優惠（如按比例退款 + 折扣）

### Requirement: 定價頁面僅顯示終身方案

系統 SHALL 在定價頁面僅顯示終身方案，不顯示計費週期切換器。

#### Scenario: 移除計費週期切換器

- **WHEN** 用戶訪問 `/pricing` 頁面
- **THEN** 頁面不應顯示「Monthly / Yearly / Lifetime」切換按鈕
- **AND** 所有方案卡片應直接顯示終身價格

#### Scenario: 價值主張清晰化

- **WHEN** 用戶查看方案卡片
- **THEN** 每個方案應顯示：
  - 「一次付清，終身享有」標語
  - 終身價格（大字體）
  - 每月 Token 配額（附註「每月重置」）
  - 年化成本提示（如「相當於每年 NT$ 4,992」）

#### Scenario: 推薦方案標記

- **WHEN** 用戶瀏覽定價頁面
- **THEN** PROFESSIONAL 方案應標記為「⭐ 推薦」
- **AND** 該卡片應有視覺突出（如邊框顏色、陰影效果）

### Requirement: 免費方案（FREE）不在定價頁顯示

系統 SHALL NOT 在公開定價頁面顯示 FREE 方案，僅在註冊流程中提供。

#### Scenario: 定價頁面不顯示 FREE

- **WHEN** 查詢定價頁面方案時
- **THEN** 應過濾掉 slug = 'free' 的方案
- **AND** 僅返回 STARTER, PROFESSIONAL, BUSINESS, AGENCY

#### Scenario: 註冊時自動分配 FREE

- **WHEN** 新用戶完成註冊
- **THEN** 系統應自動為其公司分配 FREE 方案
- **AND** 設定 `monthly_token_quota = 10000`
- **AND** 設定 `is_lifetime = true`（FREE 也視為終身，但無付費）

## MODIFIED Requirements

### Requirement: 訂單建立（修改自 payment-processing）

系統 SHALL 僅支援建立終身方案訂單，不再支援訂閱制訂單。

#### Scenario: 建立終身方案訂單

- **WHEN** 用戶選擇終身方案並提交支付
- **THEN** 系統應：
  - 生成唯一 `order_no`（格式：`ORD{timestamp}{random4digits}`）
  - 插入 `payment_orders` 表，`payment_type = 'lifetime'`
  - 將方案 ID 存入 `related_id` 欄位
  - 使用 `subscription_plans.lifetime_price` 作為訂單金額
  - 生成藍新金流支付表單
- **AND** 不應建立 `recurring_mandates` 記錄（因為終身方案無續約）

#### Scenario: 拒絕建立訂閱訂單

- **WHEN** 嘗試建立 `payment_type = 'subscription'` 的訂單
- **THEN** 系統應返回 `{ success: false, error: '不再支援訂閱制，請選擇終身方案' }`

### Requirement: 訂閱顯示（修改自 subscription-display）

系統 SHALL 正確顯示終身方案的訂閱狀態，區分「永久有效」和「當前週期」概念。

#### Scenario: 終身方案顯示永久有效

- **WHEN** 用戶為終身方案（is_lifetime = true 且 lifetime_price != NULL）
- **THEN** Dashboard 應顯示「終身有效」狀態
- **AND** 不應顯示「到期日」或「下次續約日期」

#### Scenario: 終身方案仍顯示月配額重置日

- **WHEN** 用戶為付費終身方案（monthly_token_quota > 0）
- **THEN** 系統應顯示「月配額重置日」（current_period_end）
- **AND** 標註為「配額重置」而非「訂閱到期」

#### Scenario: 免費方案不顯示重置日

- **WHEN** 用戶為 FREE 方案（monthly_token_quota = 0）
- **THEN** 不應顯示任何重置日或到期日
- **AND** 顯示「一次性配額，永不過期」提示

## REMOVED Requirements

### Requirement: 週期性支付委託建立（移除）

系統 SHALL NOT 建立週期性支付委託（recurring mandates），因終身方案無需續約。

**理由**：終身方案為一次性付費，無需藍新金流的週期扣款功能。

**影響**：

- `/api/payment/recurring/create` API 將被棄用
- `recurring_mandates` 表僅保留現有記錄，不再新增
- 移除「設定扣款日」相關 UI 組件

### Requirement: 計費週期選擇（移除）

系統 SHALL NOT 允許用戶選擇計費週期（月費/年費/終身）。

**理由**：統一為終身定價，簡化決策流程。

**影響**：

- 定價頁面移除 `<BillingPeriodToggle />` 組件
- API 參數移除 `billingPeriod`、`billing_cycle` 欄位
- 前端狀態移除 `billingPeriod` state

### Requirement: 月費/年費價格顯示（移除）

系統 SHALL NOT 在任何頁面顯示 `monthly_price` 或 `yearly_price`。

**理由**：僅提供終身方案，無需顯示其他價格。

**影響**：

- 定價卡片組件移除月費/年費顯示邏輯
- 資料庫查詢不再 select `monthly_price`, `yearly_price` 欄位（但保留以維持向後兼容）
