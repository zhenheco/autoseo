# Token Balance Display Specification

## MODIFIED Requirements

### Requirement: Token 餘額顯示位置調整
The system SHALL display Token balance in an appropriate position that is convenient for users without interfering with main operations.

#### Scenario: 餘額顯示在頁面頂部
Given 用戶在文章管理頁面
When 頁面載入完成
Then Token 餘額顯示在「文章管理」標題和「批次文章生成」按鈕之間
And 餘額資訊水平居中對齊
And 不佔用過多垂直空間

### Requirement: 餘額資訊簡化顯示
The system MUST clearly display the combination of monthly quota and purchased balance.

#### Scenario: 顯示組合餘額
Given 用戶有月配額 50,000 tokens
And 用戶購買了 10,000 tokens
When 查看 Token 餘額顯示
Then 顯示總餘額 60,000
And 分別顯示「月配額剩餘: 50,000」
And 分別顯示「購買餘額: 10,000」

## ADDED Requirements

### Requirement: 餘額即時更新機制
The system SHALL immediately update Token balance display after article generation.

#### Scenario: 文章生成後自動更新餘額
Given 用戶當前餘額為 60,000 tokens
When 用戶生成一篇文章（消耗 1,500 tokens）
Then 餘額立即更新為 58,500
And 不需要手動刷新頁面
And 更新有平滑的過渡效果

### Requirement: 餘額不足警告提示
The system MUST provide clear warnings when balance is insufficient.

#### Scenario: 低餘額警告
Given 用戶餘額低於 1,000 tokens
When 查看餘額顯示
Then 餘額數字顯示為紅色
And 顯示「餘額不足」標籤
And 提供「立即升級」連結

### Requirement: 餘額更新失敗處理
The system SHALL gracefully handle balance update failures.

#### Scenario: API 請求失敗時的降級處理
Given Token 餘額 API 暫時無法訪問
When 嘗試更新餘額
Then 保留上次成功獲取的餘額
And 顯示小型錯誤提示「餘額更新失敗，顯示快取資料」
And 自動重試（最多 3 次）

## ADDED Requirements (2024 Real-time Architecture)

### Requirement: 樂觀更新實施
The system SHALL implement optimistic UI updates for immediate user feedback during token transactions.

#### Scenario: 樂觀扣除 Token
Given 用戶當前餘額 50,000 tokens
When 開始生成文章（預估消耗 1,500 tokens）
Then 立即顯示餘額為 48,500（樂觀更新）
And UI 顯示處理中狀態
And 背景執行實際扣除
And 收到伺服器確認後更新為實際餘額

### Requirement: WebSocket 即時推送
The system SHOULD implement WebSocket connections for real-time balance updates with HTTP polling fallback.

#### Scenario: WebSocket 餘額同步
Given 用戶開啟多個瀏覽器標籤
When 在一個標籤中消耗 Token
Then 所有標籤通過 WebSocket 接收更新
And 延遲 < 100ms
And WebSocket 斷線時自動降級到輪詢
And 重連後恢復即時推送

### Requirement: SWR 快取優化
The system SHALL optimize SWR caching strategy to balance real-time needs with server load.

#### Scenario: 智能快取策略
Given SWR 配置用於餘額管理
When 設定快取參數
Then dedupingInterval 設為 2000ms（防止重複請求）
And refreshInterval 設為 10000ms（WebSocket 為主時）
And revalidateOnFocus 保持啟用
And 實施請求合併（request batching）

### Requirement: 效能基準監控
The system MUST meet specific performance benchmarks for balance updates.

#### Scenario: 更新延遲要求
Given 效能監控系統運行中
When 測量餘額更新延遲
Then 樂觀更新延遲 = 0ms
And WebSocket 更新延遲 < 100ms
And HTTP 輪詢更新延遲 < 1000ms
And 記錄 P95 和 P99 延遲指標