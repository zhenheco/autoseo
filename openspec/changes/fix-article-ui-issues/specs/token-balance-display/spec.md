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