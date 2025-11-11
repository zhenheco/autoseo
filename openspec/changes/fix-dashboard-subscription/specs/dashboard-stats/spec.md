## ADDED Requirements

### Requirement: Dashboard 統計數據動態顯示
系統 SHALL 從資料庫動態讀取並顯示 Dashboard 的統計數據（文章數、網站數），而非使用硬編碼值。

#### Scenario: 顯示公司總文章數
- **WHEN** 用戶查看 Dashboard 頁面
- **THEN** 系統應從 `generated_articles` 表查詢該公司的文章總數
- **AND** 使用 Supabase `.select('*', { count: 'exact', head: true })` 只獲取數量
- **AND** 在 StatCard 組件中顯示動態數值

#### Scenario: 顯示公司網站數量
- **WHEN** 用戶查看 Dashboard 頁面
- **THEN** 系統應從 `website_configs` 表查詢該公司的啟用網站數量
- **AND** 篩選條件為 `eq('is_active', true)`
- **AND** 使用 Supabase `.select('*', { count: 'exact', head: true })` 只獲取數量
- **AND** 在 StatCard 組件中顯示動態數值

#### Scenario: 查詢失敗時的 fallback
- **WHEN** 資料庫查詢失敗或用戶無公司會員資格
- **THEN** 文章數和網站數應顯示為 0
- **AND** 不應拋出錯誤或中斷頁面渲染

### Requirement: Token 餘額卡片純顯示
TokenBalanceCard 組件 SHALL 為純顯示組件，不提供點擊功能。

#### Scenario: 移除可點擊包裝
- **WHEN** 檢查 TokenBalanceCard 組件
- **THEN** 不應包含 `<Link>` 包裝
- **AND** 應使用 `<div>` 或 `<Card>` 作為根元素
- **AND** 不應有 `cursor-pointer` 或 hover 效果的 CSS class

#### Scenario: 保持 Token 餘額動態讀取
- **WHEN** 顯示 Token 餘額
- **THEN** 仍應從 API 或資料庫讀取最新數值
- **AND** 顯示邏輯維持不變（總餘額 = monthly_quota_balance + purchased_token_balance）

#### Scenario: 文字保持硬編碼
- **WHEN** 顯示卡片標題和說明
- **THEN** "Credit 餘額"、"Token" 等文字可保持硬編碼
- **AND** 只有數值需要動態讀取
