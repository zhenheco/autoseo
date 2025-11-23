# Article Management - Delta Spec

## ADDED Requirements

### Requirement: HTML 連結正確渲染

系統 SHALL 確保文章預覽中的所有 HTML 連結（內部和外部）能正確顯示和點擊。

#### Scenario: 外部連結正確顯示

- **WHEN** 文章包含外部連結（如 `<a href="https://example.com">連結</a>`）
- **THEN** 連結應正確渲染為可點擊的超連結
- **AND** 連結應包含 `target="_blank"` 和 `rel="noopener noreferrer"` 屬性

#### Scenario: 內部連結正確顯示

- **WHEN** 文章包含內部連結（如 `<a href="/about">關於我們</a>`）
- **THEN** 連結應正確渲染為可點擊的超連結
- **AND** 連結樣式應符合設計規範（藍色、無底線、hover 時顯示底線）

#### Scenario: HTML 內容性能優化

- **WHEN** 文章 HTML 內容載入
- **THEN** 系統應使用 `useMemo` 快取清理後的 HTML
- **AND** 只在內容變更時重新清理

### Requirement: 批次選擇功能

系統 SHALL 提供批次選擇文章的功能，支援單選和全選。

#### Scenario: 單篇文章勾選

- **WHEN** 使用者點擊文章列表項目左側的 checkbox
- **THEN** 該文章應被選取或取消選取
- **AND** 勾選狀態應即時反映在 UI 上

#### Scenario: 全選功能

- **WHEN** 使用者點擊「Select All」按鈕
- **THEN** 當前頁面所有文章應被選取
- **AND** 如果已經全選，則取消所有選取

#### Scenario: 勾選數量顯示

- **WHEN** 使用者勾選文章
- **THEN** 系統應顯示已勾選的文章數量
- **AND** 顯示格式為「已選取 X 篇文章」

### Requirement: 排程發佈功能

系統 SHALL 提供批次排程發佈功能，支援設定發佈時間和條件。

#### Scenario: 設定排程時間

- **WHEN** 使用者選擇排程時間
- **THEN** 系統應提供日期時間選擇器
- **AND** 支援選擇未來的任何日期時間

#### Scenario: 批次排程文章

- **WHEN** 使用者勾選多篇文章並點擊「SCHEDULE ALL」
- **THEN** 所有勾選的文章應設定為指定的排程時間
- **AND** 文章列表應顯示排程日期（如「28 Jan」）
- **AND** 系統應顯示成功訊息「已排程 X 篇文章」

#### Scenario: 重設排程

- **WHEN** 使用者點擊「RESET SCHEDULE」
- **THEN** 所有勾選文章的排程設定應被清除
- **AND** 文章狀態應回到「待發佈」

#### Scenario: 排程條件選擇

- **WHEN** 使用者選擇排程條件下拉選單
- **THEN** 系統應提供以下選項：
  - 立即發佈
  - 指定時間發佈
  - 間隔發佈（每 X 小時/天發佈一篇）
- **AND** 根據選擇的條件調整 UI 顯示

### Requirement: 文章狀態指示

系統 SHALL 清楚顯示每篇文章的狀態。

#### Scenario: 已完成文章

- **WHEN** 文章生成完成且未排程
- **THEN** 應顯示綠色勾勾圖示
- **AND** 狀態文字為「已完成」

#### Scenario: 已排程文章

- **WHEN** 文章已設定排程時間
- **THEN** 應顯示時鐘圖示
- **AND** 顯示排程日期（格式：「28 Jan」或「2025-01-28」）
- **AND** 狀態文字為「已排程」

#### Scenario: 處理中文章

- **WHEN** 文章正在生成
- **THEN** 應顯示轉圈動畫
- **AND** 狀態文字為「處理中」

### Requirement: 即時編輯功能

系統 SHALL 提供文章內容的即時編輯功能。

#### Scenario: 啟用編輯模式

- **WHEN** 使用者點擊文章預覽區域
- **THEN** 系統應啟用富文本編輯器
- **AND** 顯示完整的編輯工具列

#### Scenario: 文字格式編輯

- **WHEN** 使用者選取文字並點擊格式按鈕（粗體/斜體/底線）
- **THEN** 選取的文字應立即套用格式
- **AND** 編輯內容應即時反映在預覽中

#### Scenario: 標題格式變更

- **WHEN** 使用者選擇標題格式（H1-H4）
- **THEN** 當前段落應轉換為對應的標題樣式
- **AND** 格式變更應立即顯示

#### Scenario: 文字對齊調整

- **WHEN** 使用者點擊對齊按鈕（左/中/右/分散）
- **THEN** 選取的段落應套用對應的對齊方式
- **AND** 對齊效果應即時顯示

#### Scenario: 復原/重做功能

- **WHEN** 使用者點擊復原按鈕
- **THEN** 系統應還原上一個編輯動作
- **AND** 重做按鈕應變為可用

#### Scenario: 即時儲存

- **WHEN** 使用者編輯內容後停止輸入 3 秒
- **THEN** 系統應自動儲存編輯內容到資料庫
- **AND** 顯示「已儲存」提示

#### Scenario: 字數統計

- **WHEN** 使用者編輯文章內容
- **THEN** 系統應即時更新字數統計
- **AND** 顯示格式為「WORDS: XXX」

### Requirement: 單篇發佈功能

系統 SHALL 提供單篇文章的快速發佈功能。

#### Scenario: WordPress 發佈介面佈局

- **WHEN** 文章預覽頁面載入
- **THEN** 預覽底部應顯示發佈工具列
- **AND** 工具列包含以下元素（由左至右）：
  - WordPress 按鈕/標籤
  - 網站選擇下拉選單（顯示網站名稱，如「轉念之道」）
  - 發佈狀態下拉選單（Publish / Draft / Scheduled）
  - POST 按鈕（主要動作按鈕，紫色/品牌色）
- **AND** 發佈後顯示「Published on: [日期] GO TO POST」

#### Scenario: 選擇發佈網站

- **WHEN** 使用者點擊網站選擇下拉選單
- **THEN** 系統應列出所有已配置的 WordPress 網站
- **AND** 每個網站項目顯示網站名稱
- **AND** 使用者可選擇一個目標網站

#### Scenario: 選擇發佈狀態

- **WHEN** 使用者點擊發佈狀態下拉選單
- **THEN** 系統應顯示以下選項：
  - Publish（立即發佈為公開文章）
  - Draft（儲存為草稿）
  - Scheduled（排程發佈，需額外選擇時間）
- **AND** 預設選項為「Publish」

#### Scenario: 執行發佈動作

- **WHEN** 使用者選擇網站和狀態後點擊「POST」按鈕
- **THEN** 系統應執行發佈動作
- **AND** 按鈕顯示載入狀態（如「發佈中...」）
- **AND** 發佈成功後顯示「Published on: [日期] GO TO POST」
- **AND** 「GO TO POST」是可點擊的連結，導向 WordPress 文章頁面

#### Scenario: 發佈錯誤處理

- **WHEN** 發佈過程中發生錯誤
- **THEN** 系統應顯示錯誤訊息
- **AND** 提供重試按鈕
- **AND** 記錄錯誤詳情到 article_publications 表

#### Scenario: 儲存為草稿

- **WHEN** 使用者選擇「Draft」狀態並點擊 POST
- **THEN** 文章應儲存到 WordPress 但不公開
- **AND** 狀態顯示為「Saved as Draft」
- **AND** 提供「GO TO POST」連結查看草稿

#### Scenario: 排程單篇發佈

- **WHEN** 使用者選擇「Scheduled」狀態
- **THEN** 系統應顯示日期時間選擇器
- **AND** 使用者設定排程時間後點擊 POST
- **AND** 文章設定為在指定時間自動發佈
- **AND** 顯示「Scheduled for: [日期時間]」

### Requirement: 文章複製功能

系統 SHALL 提供快速複製文章內容的功能。

#### Scenario: 複製文章 HTML

- **WHEN** 使用者在文章預覽頁面點擊右上角的「複製」按鈕
- **THEN** 系統應將完整的 HTML 內容複製到剪貼簿
- **AND** 顯示成功 Toast 訊息「已複製到剪貼簿」

#### Scenario: 複製失敗處理

- **WHEN** 瀏覽器不支援 Clipboard API 或複製失敗
- **THEN** 系統應嘗試使用降級方案（document.execCommand）
- **AND** 如果仍然失敗，顯示錯誤訊息「複製失敗，請手動選取文字複製」

#### Scenario: 複製按鈕位置

- **WHEN** 文章預覽頁面載入
- **THEN** 複製按鈕應顯示在文章標題右上角
- **AND** 按鈕應包含複製圖示和文字「複製」
- **AND** 按鈕樣式應與整體 UI 一致

### Requirement: 多網站發佈選擇

系統 SHALL 支援選擇發佈目標網站。

#### Scenario: 選擇發佈網站

- **WHEN** 使用者點擊批次發佈功能
- **THEN** 系統應顯示網站選擇器
- **AND** 列出使用者擁有的所有網站配置

#### Scenario: 多網站同時發佈

- **WHEN** 使用者選擇多個目標網站並確認發佈
- **THEN** 系統應將選中的文章發佈到所有選定的網站
- **AND** 顯示發佈進度
- **AND** 發佈完成後顯示結果摘要

## MODIFIED Requirements

### Requirement: 批次文章生成狀態管理

系統 SHALL 正確管理批次生成的文章狀態，避免重複創建。

#### Scenario: 避免重複創建文章任務

- **WHEN** 使用者選擇標題並開始生成
- **THEN** 系統應檢查是否已存在相同標題的任務
- **AND** 如果存在，更新現有任務而非創建新任務
- **AND** 使用標題+時間戳作為唯一性判斷

#### Scenario: 正確的狀態轉換

- **WHEN** 文章任務創建後
- **THEN** 狀態應依序為：pending → processing → completed
- **AND** 不應出現多個相同標題的任務

#### Scenario: 任務完成後創建文章記錄

- **WHEN** 文章生成完成（狀態變為 completed）
- **THEN** 系統應在 `generated_articles` 表創建一筆記錄
- **AND** `article_jobs` 表的記錄保持 completed 狀態
- **AND** 不再創建新的 article_job

#### Scenario: 保留語系和字數設定

- **WHEN** 使用者在批次生成時選擇語系和字數
- **THEN** 系統應將這些設定儲存到 `article_jobs.metadata`
- **AND** 文章生成時應使用這些設定
- **AND** 語系選項包含：zh-TW, zh-CN, en, ja, ko, es, fr, de, pt, it, ru, ar, th, vi, id
- **AND** 字數選項包含：800, 1200, 1500, 2000, 3000, 5000

### Requirement: 自動圖片配置

系統 SHALL 自動為每個 H2 標題配置圖片，不需使用者手動設定。

#### Scenario: 自動圖片生成

- **WHEN** 文章生成時包含 H2 標題
- **THEN** 系統應自動為每個 H2 標題下方插入相關圖片
- **AND** 圖片應與該段落主題相關

#### Scenario: 移除圖片數量選擇

- **WHEN** 使用者開啟批次生成對話框
- **THEN** UI 不應顯示「圖片數量」選擇器
- **AND** 系統自動決定圖片配置
