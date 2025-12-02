## ADDED Requirements

### Requirement: 增強 SectionAgent 重試邏輯

系統 SHALL 對 SectionAgent 的 API 請求失敗進行更積極的重試。

#### Scenario: 增加重試次數

- **WHEN** SectionAgent 的 AI 呼叫失敗
- **THEN** 系統最多重試 5 次（原本 3 次）
- **AND** 每次重試之間使用指數退避策略
- **AND** 初始延遲 2 秒，最大延遲 30 秒

#### Scenario: 擴展可重試錯誤類型

- **WHEN** 發生以下錯誤時
  - ECONNRESET
  - ETIMEDOUT
  - rate_limit_exceeded
  - fetch failed
  - network error
  - socket hang up
  - EHOSTUNREACH
- **THEN** 系統自動重試
- **AND** 不立即 fallback 到 legacy 模式

#### Scenario: 調整 timeout 配置

- **WHEN** SectionAgent 執行 AI 呼叫
- **THEN** timeout 設定為 120 秒（原本 90 秒）
- **AND** 與 DeepSeek API 的 timeout 配置一致

### Requirement: 寬鬆的錯誤匹配

系統 SHALL 使用更寬鬆的錯誤匹配邏輯判斷是否應該重試。

#### Scenario: 匹配錯誤碼

- **WHEN** 錯誤包含 code 屬性
- **THEN** 與可重試錯誤列表進行大小寫不敏感匹配

#### Scenario: 匹配錯誤訊息

- **WHEN** 錯誤 message 包含可重試錯誤關鍵字
- **THEN** 進行部分匹配（不需完全相同）
- **AND** 大小寫不敏感

#### Scenario: 通用網路錯誤

- **WHEN** 錯誤訊息包含 'network', 'fetch', 'timeout' 等關鍵字
- **THEN** 視為可重試錯誤
- **AND** 自動重試
