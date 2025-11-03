# subscription-upgrade-rules Specification

## Purpose
定義並實作訂閱方案升級的驗證規則，確保用戶只能執行符合業務邏輯的升級操作。

## ADDED Requirements

### Requirement: System SHALL Provide Upgrade Rules Validation Library
The system SHALL provide a shared upgrade rules validation library for frontend and backend use.

#### Scenario: Define tier hierarchy
- **WHEN** 系統需要比較方案階層
- **THEN** 必須使用以下階層定義：
  ```typescript
  const TIER_HIERARCHY: Record<string, number> = {
    'free': 0,
    'starter': 1,
    'business': 2,
    'professional': 3,
    'agency': 4,
  }
  ```
  - 數字越大表示階層越高
  - 使用方案的 `slug` 欄位進行比較
  - **不使用** `company.subscription_tier` 進行比較（因為有映射轉換）

#### Scenario: Define billing period hierarchy
- **WHEN** 系統需要比較計費週期
- **THEN** 必須使用以下階層：
  - 'monthly' < 'yearly' < 'lifetime'
  - 月繳可升級到年繳或終身
  - 年繳只能升級到終身
  - 終身無法升級

#### Scenario: Validate same-tier upgrade
- **WHEN** 用戶嘗試在同階層內升級（例如 agency 月繳 → agency 年繳）
- **THEN** 驗證函式必須：
  - 比較當前計費週期和目標計費週期
  - 如果 `currentBillingPeriod === 'lifetime'`，返回 `false`
  - 如果目標週期更長（monthly→yearly, monthly→lifetime, yearly→lifetime），返回 `true`
  - 如果目標週期相同或更短，返回 `false`

#### Scenario: Validate cross-tier upgrade
- **WHEN** 用戶嘗試升級到不同階層（例如 starter → business）
- **THEN** 驗證函式必須：
  - 比較 `TIER_HIERARCHY[currentTierSlug]` 和 `TIER_HIERARCHY[targetTierSlug]`
  - 如果目標階層更高（數字更大），返回 `true`
  - 如果目標階層相同或更低，返回 `false`
  - 允許任何計費週期組合（只要階層更高）

#### Scenario: Validate upgrade function signature
- **WHEN** 實作升級驗證函式
- **THEN** 必須符合以下簽名：
  ```typescript
  function canUpgrade(
    currentTierSlug: string | null,
    currentBillingPeriod: 'monthly' | 'yearly' | 'lifetime',
    targetPlanSlug: string,
    targetBillingPeriod: 'monthly' | 'yearly' | 'lifetime'
  ): boolean
  ```
  - 如果 `currentTierSlug` 為 `null`（新用戶），允許任何升級
  - 返回 `true` 表示允許升級
  - 返回 `false` 表示不允許升級

### Requirement: Frontend MUST Display Upgrade Button State
The Pricing page MUST display button states according to upgrade rules.

#### Scenario: Disable button for current plan
- **WHEN** 顯示的方案與用戶當前方案完全相同（階層和計費週期）
- **THEN** 按鈕必須：
  - 設定 `disabled={true}`
  - 顯示文字「目前方案」
  - 不顯示箭頭圖示
  - 應用灰色樣式（disabled styling）

#### Scenario: Disable button for invalid upgrades
- **WHEN** `canUpgrade()` 返回 `false`
- **THEN** 按鈕必須：
  - 設定 `disabled={true}`
  - 顯示文字「無法升級」
  - 不顯示箭頭圖示
  - 應用灰色樣式（disabled styling）

#### Scenario: Enable button for valid upgrades
- **WHEN** `canUpgrade()` 返回 `true`
- **THEN** 按鈕必須：
  - 設定 `disabled={false}`
  - 顯示文字「開始使用」
  - 顯示箭頭圖示並帶有 hover 動畫
  - 應用主要按鈕樣式（primary/secondary）
  - 可以點擊觸發購買流程

### Requirement: Frontend MUST Detect Current Plan from Mandate
The frontend MUST obtain user current plan slug from recurring_mandates table instead of using company.subscription_tier.

#### Scenario: Query active mandate to get current plan slug
- **WHEN** Pricing 頁面載入用戶資訊
- **THEN** 系統必須：
  - 查詢 `recurring_mandates` 表
  - 篩選條件：`company_id` = 當前用戶的 company_id, `status` = 'active'
  - 排序：`created_at DESC`
  - 限制：1 筆
  - 使用 `.maybeSingle()` 避免錯誤

#### Scenario: Join mandate with subscription_plans to get slug
- **WHEN** 查詢到 active mandate
- **THEN** 系統必須：
  - 取得 `mandate.subscription_plan_id`
  - 查詢 `subscription_plans` 表
  - SELECT `slug`, `is_lifetime`
  - 將 `slug` 設定為 `currentTierSlug` 狀態

#### Scenario: Determine current billing period
- **WHEN** 查詢到 active mandate 和對應的 plan
- **THEN** 系統必須：
  - 如果 `plan.is_lifetime === true`，設定 `currentBillingPeriod = 'lifetime'`
  - 否則如果 `mandate.period_type === 'Y'`，設定 `currentBillingPeriod = 'yearly'`
  - 否則設定 `currentBillingPeriod = 'monthly'`

#### Scenario: Handle no active mandate
- **WHEN** 用戶沒有 active mandate（新用戶或免費方案）
- **THEN** 系統必須：
  - 從 `companies.subscription_tier` 取得 tier
  - 設定 `currentTierSlug = company.subscription_tier`（例如 'free'）
  - 設定 `currentBillingPeriod = 'monthly'`（預設值）

### Requirement: Backend MUST Validate Upgrade Requests
The backend API MUST validate upgrade rules when processing subscription purchase requests.

#### Scenario: Validate upgrade in recurring payment API
- **WHEN** `/api/payment/recurring/create` 收到購買請求
- **THEN** 系統必須：
  - 取得用戶當前的 `currentTierSlug` 和 `currentBillingPeriod`
  - 從請求中取得 `targetPlanSlug` 和 `targetBillingPeriod`
  - 呼叫 `canUpgrade()` 驗證
  - 如果返回 `false`，拒絕請求並返回 `{ success: false, error: '不符合升級規則' }`
  - 如果返回 `true`，繼續處理購買流程

#### Scenario: Log upgrade validation result
- **WHEN** 後端執行升級驗證
- **THEN** 必須記錄：
  - 用戶的 company_id
  - 當前方案：tierSlug, billingPeriod
  - 目標方案：planSlug, billingPeriod
  - 驗證結果：true/false
  - 如果失敗，記錄原因（同階層縮短/降級/終身變更）

### Requirement: Code MUST Document Upgrade Rules
The code MUST explicitly document upgrade rules in comments.

#### Scenario: Document rules in canUpgrade function
- **WHEN** 實作 `canUpgrade()` 函式
- **THEN** 必須包含以下註解：
  ```typescript
  /**
   * 驗證訂閱方案升級是否符合業務規則
   *
   * 同階層升級規則：
   * - 月繳 → 年繳 ✅
   * - 月繳 → 終身 ✅
   * - 年繳 → 終身 ✅
   * - 年繳 → 月繳 ❌
   * - 終身 → 任何 ❌
   *
   * 不同階層升級規則：
   * - 只能升級到更高階層 (Free → Starter → Business → Professional → Agency)
   * - 升級時可選擇任何計費週期
   * - 無法降級到低階層
   */
  ```

#### Scenario: Add validation examples in tests
- **WHEN** 撰寫升級規則測試
- **THEN** 必須包含以下測試案例：
  - ✅ Monthly Agency → Yearly Agency
  - ❌ Yearly Agency → Monthly Agency
  - ✅ Monthly Business → Lifetime Professional
  - ❌ Monthly Business → Monthly Starter
  - ✅ Free → Monthly Starter
  - ❌ Lifetime Agency → Yearly Agency
