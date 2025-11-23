# Content Assembly

## ADDED Requirements

### Requirement: Content Parts Integration

系統 SHALL 整合所有 agent 輸出成完整且連貫的 Markdown 文章。

#### Scenario: 按正確順序組合內容

- **GIVEN** ContentAssemblerAgent 接收到所有內容部分（introduction, sections, conclusion, qa）
- **WHEN** 執行組合
- **THEN** SHALL 按以下順序組合 Markdown：
  1. Introduction（前言）
  2. Sections（主要段落，按 outline 順序）
  3. Conclusion（結論）
  4. FAQ（常見問題）
- **AND** 每個部分之間 SHALL 添加適當的空行分隔（兩個換行符）

#### Scenario: 處理 Sections 陣列

- **GIVEN** sections 是一個陣列，每個元素是 SectionOutput
- **WHEN** 組合 sections
- **THEN** SHALL 按陣列順序逐個組合
- **AND** SHALL 保留每個 section 的 heading（H2）
- **AND** SHALL 在 sections 之間添加空行
- **AND** 總 sections 數量 SHALL 被記錄到統計資訊

#### Scenario: 生成統計資訊

- **GIVEN** 所有內容已組合成完整 Markdown
- **WHEN** 計算統計資訊
- **THEN** SHALL 計算：
  - `totalWords` - 總字數（中文按字符計算，英文按空格分隔）
  - `totalParagraphs` - 總段落數（按兩個連續換行符分隔）
  - `totalSections` - 主要段落數量（sections.length）
  - `totalFAQs` - 常見問題數量（qa.faqs.length）
- **AND** 統計資訊 SHALL 包含在 output 中

#### Scenario: 初步 HTML 轉換

- **GIVEN** 完整的 Markdown 文章已組合完成
- **WHEN** ContentAssemblerAgent 準備輸出
- **THEN** SHALL 使用 `marked` 庫將 Markdown 轉換為 HTML
- **AND** 此 HTML 為初步版本，尚未插入連結
- **AND** SHALL 同時輸出 Markdown 和 HTML 兩種格式

### Requirement: Content Validation

系統 SHALL 驗證組合後的文章符合最低品質要求。

#### Scenario: 驗證必要部分存在

- **GIVEN** 接收到內容部分
- **WHEN** 開始組合前的驗證
- **THEN** SHALL 檢查以下必要部分：
  - `title` 存在且非空
  - `introduction` 存在且非空
  - `sections` 陣列至少有 1 個元素
- **AND** 如果缺少任何必要部分，SHALL 拋出 `MissingRequiredContentError`

#### Scenario: 驗證最低字數要求

- **GIVEN** 所有內容已組合
- **WHEN** 檢查總字數
- **THEN** SHALL 計算總字數（introduction + sections + conclusion 的總和）
- **AND** 如果總字數 < 800，SHALL 拋出 `InsufficientContentError`
- **AND** 錯誤訊息 SHALL 包含實際字數和最低要求

#### Scenario: 非關鍵部分缺失的處理

- **GIVEN** conclusion 或 qa 缺失（null 或 undefined）
- **WHEN** 執行組合
- **THEN** SHALL 記錄 warning 日誌
- **AND** SHALL 跳過該部分，繼續組合其他內容
- **AND** 最終文章 SHALL 只包含可用的部分
- **AND** 驗證 SHALL 通過（只要必要部分存在）

#### Scenario: 驗證 Section 內容品質

- **GIVEN** sections 陣列中的每個 section
- **WHEN** 驗證 section 內容
- **THEN** 每個 section SHALL 有：
  - `markdown` 欄位非空
  - `wordCount` > 100（每個段落至少 100 字）
- **AND** 如果任何 section 不符合要求，SHALL 記錄 warning
- **AND** 該 section SHALL 仍被包含在最終文章中（但標記為低品質）

### Requirement: Formatting and Cleanup

系統 SHALL 清理和格式化組合後的 Markdown，確保一致性。

#### Scenario: 移除重複的標題

- **GIVEN** introduction 或 sections 可能包含與 title 重複的 H1 或 H2 標題
- **WHEN** 組合內容
- **THEN** SHALL 檢查並移除與 title 完全相同的標題
- **AND** 移除邏輯：
  - 移除開頭的 `# Title` 格式（H1）
  - 移除開頭的 `## Title` 格式（H2，如果與 title 相同）

#### Scenario: 統一空行格式

- **GIVEN** 不同 agent 可能使用不同數量的空行
- **WHEN** 組合內容
- **THEN** SHALL 標準化部分之間的空行為兩個換行符（`\n\n`）
- **AND** SHALL 移除多餘的連續空行（超過兩個換行符）
- **AND** SHALL 確保文章開頭和結尾沒有多餘空行

#### Scenario: 處理圖片 Markdown 格式

- **GIVEN** 內容中包含圖片 Markdown `![alt](url)`
- **WHEN** 組合和驗證
- **THEN** SHALL 驗證圖片 Markdown 格式正確
- **AND** SHALL 確保每個圖片都有 alt text
- **AND** SHALL 確保 URL 是有效的（http:// 或 https:// 開頭）
- **AND** 如果發現格式錯誤，SHALL 記錄 warning 但保留原內容

### Requirement: Error Handling and Fallback

系統 SHALL 處理組合過程中的異常情況。

#### Scenario: 處理 Markdown 轉 HTML 失敗

- **GIVEN** `marked` 庫在轉換某些特殊 Markdown 時失敗
- **WHEN** 嘗試轉換為 HTML
- **THEN** SHALL 捕獲錯誤並記錄
- **AND** SHALL 重試一次（移除可能導致問題的特殊字符後）
- **AND** 如果仍失敗，SHALL 使用簡化的轉換（僅將換行符轉為 `<br>`）
- **AND** SHALL 標記 HTML 品質為 "degraded"

#### Scenario: 處理空內容或 null 值

- **GIVEN** 某個內容部分為空字串或 null
- **WHEN** 執行組合
- **THEN** SHALL 跳過該部分
- **AND** SHALL 記錄 info 日誌（`[ContentAssembler] Skipping empty [partName]`）
- **AND** 如果該部分是必要的（如 introduction），SHALL 拋出錯誤

#### Scenario: 記錄執行資訊

- **GIVEN** ContentAssemblerAgent 執行完成
- **WHEN** 返回結果
- **THEN** SHALL 包含 `executionInfo`：
  - `model`: 'content-assembler'（固定值，因為不使用 AI）
  - `executionTime`: 執行時間（毫秒）
  - `totalCost`: 0（不使用 AI，無成本）
  - `partsAssembled`: 組合的部分數量
  - `partsSkipped`: 跳過的部分數量（如 null 的 conclusion）

### Requirement: Markdown Structure Integrity

系統 SHALL 確保組合後的 Markdown 結構正確且符合規範。

#### Scenario: 驗證 Heading 層級

- **GIVEN** 組合後的 Markdown
- **WHEN** 檢查 heading 結構
- **THEN** SHALL 驗證：
  - Introduction 可以有 H2 或 H3 headings
  - Each section SHALL 以 H2 heading 開始
  - Section 內部可以有 H3 或 H4 sub-headings
  - FAQ 部分 SHALL 以 H2 "常見問題" 開始，每個問題為 H3
- **AND** 如果發現不符合規範的 heading 層級，SHALL 記錄 warning

#### Scenario: 保留 Markdown 特殊格式

- **GIVEN** 內容包含 Markdown 特殊格式（如 bold, italic, code block, list）
- **WHEN** 組合內容
- **THEN** SHALL 保留所有 Markdown 格式化標記
- **AND** SHALL 不修改或轉義特殊字符（除非導致解析錯誤）
- **AND** 特殊格式範例：
  - `**bold**` - 粗體
  - `*italic*` - 斜體
  - `` `code` `` - 行內程式碼
  - ` ```language...``` ` - 程式碼區塊
  - `- item` 或 `1. item` - 清單

#### Scenario: 處理表格

- **GIVEN** 內容包含 Markdown 表格
- **WHEN** 組合和轉換
- **THEN** SHALL 保留完整的表格結構
- **AND** SHALL 確保表格格式正確（header row + separator + data rows）
- **AND** 轉換為 HTML 時，表格 SHALL 自動添加樣式類別（在 HTMLAgent 階段）

### Requirement: Performance Optimization

系統 SHALL 優化組合過程的效能，特別是對於長文章。

#### Scenario: 高效字串拼接

- **GIVEN** 需要組合多個部分成單一字串
- **WHEN** 執行拼接操作
- **THEN** SHALL 使用陣列 join 而非重複的字串連接（`array.join('\n\n')` 而非 `str1 + str2 + ...`）
- **AND** 單次組合操作 SHALL 在 100ms 內完成（即使對於 10000 字的文章）

#### Scenario: 快取統計計算

- **GIVEN** 統計資訊（字數、段落數）需要多次使用
- **WHEN** 第一次計算完成後
- **THEN** SHALL 將結果存儲在變數中
- **AND** 後續使用 SHALL 直接讀取快取值
- **AND** 避免重複計算相同的統計資訊

#### Scenario: 處理大型文章

- **GIVEN** 文章總字數超過 5000 字
- **WHEN** 執行組合和驗證
- **THEN** 所有操作 SHALL 在 500ms 內完成
- **AND** 記憶體使用 SHALL < 50MB（除 Markdown/HTML 內容本身外）
- **AND** 如果超時，SHALL 記錄 warning 但仍返回結果
