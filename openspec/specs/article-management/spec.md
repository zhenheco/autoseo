# article-management Specification

## Purpose

TBD - created by archiving change improve-article-management-ui. Update Purpose after archive.

## Requirements

### Requirement: Credit Balance Display in Header

系統 SHALL 在頂部導航欄顯示 Credit 餘額，與語系選擇並列。

#### Scenario: User views dashboard

- **WHEN** 使用者進入任何 dashboard 頁面
- **THEN** 頂部導航欄右側顯示 Credit 餘額（格式：`Credits: 400000 | Lifetime Platinum`）
- **AND** Credit 資訊旁顯示「Buy More!」連結
- **AND** 語系選擇下拉選單緊鄰 Credit 資訊

#### Scenario: Credit balance updates

- **WHEN** 使用者消費或購買 Credit
- **THEN** 導航欄的 Credit 餘額即時更新
- **AND** 不需要重新整理頁面

### Requirement: Compact Article List Layout

系統 SHALL 提供緊湊的文章列表佈局，提高資訊密度。

#### Scenario: Viewing article list

- **WHEN** 使用者瀏覽文章列表頁面
- **THEN** 文章卡片標題使用 `text-base` 字體（而非 `text-lg`）
- **AND** 卡片內邊距使用 `p-4`（而非 `p-6`）
- **AND** 卡片之間間距使用 `space-y-2`（而非 `space-y-4`）
- **AND** Meta 資訊（字數、閱讀時間、日期）使用 `text-xs` 字體
- **AND** 在相同螢幕空間內可顯示更多文章

#### Scenario: Responsive layout

- **WHEN** 使用者在小螢幕裝置（< 768px）瀏覽
- **THEN** 文章列表保持可讀性
- **AND** 最小字體不小於 `12px`
- **AND** 重要資訊（標題、狀態）優先顯示

### Requirement: Schedule Badge Display

系統 SHALL 在文章卡片右上角顯示排程資訊（如已設定）。

#### Scenario: Article has scheduled publish time

- **WHEN** 文章的 `article_jobs.scheduled_publish_at` 欄位有值
- **AND** `article_jobs.status` 為 `scheduled`
- **THEN** 卡片右上角顯示排程 Badge
- **AND** Badge 格式為 `🕒 MM/DD HH:mm`（如：`🕒 11/20 14:30`）
- **AND** 使用 `outline` variant 以區分其他狀態 Badge

#### Scenario: Article not scheduled

- **WHEN** `article_jobs.scheduled_publish_at` 為 null
- **OR** `article_jobs.status` 不是 `scheduled`
- **THEN** 不顯示排程 Badge

### Requirement: HTML Content Editor

系統 SHALL 提供 HTML 內容編輯功能，允許使用者直接修改文章 HTML。

#### Scenario: User opens HTML editor

- **WHEN** 使用者點擊文章的「編輯 HTML」按鈕
- **THEN** 跳轉至 `/dashboard/articles/[id]/edit` 頁面
- **AND** 顯示輕量級程式碼編輯器（react-simple-code-editor + Prism.js）
- **AND** 編輯器載入文章的 `generated_articles.html_content` 欄位內容
- **AND** 提供 HTML 語法高亮

#### Scenario: User saves HTML changes

- **WHEN** 使用者修改 HTML 內容並點擊「儲存」
- **THEN** 系統使用 cheerio 驗證 HTML 基本結構
- **AND** 更新 `generated_articles.html_content` 欄位
- **AND** 重新計算 `generated_articles.word_count`（基於純文字內容長度）
- **AND** 重新計算 `generated_articles.reading_time`（字數 ÷ 300）
- **AND** 更新 `generated_articles.updated_at` 為當前時間
- **AND** 顯示成功訊息

#### Scenario: User previews HTML

- **WHEN** 使用者點擊「預覽」按鈕
- **THEN** 在對話框中顯示 HTML 渲染結果
- **AND** 使用 DOMPurify 淨化 HTML 內容（移除潛在危險標籤和屬性）
- **AND** 保留當前編輯內容（未儲存也可預覽）
- **AND** 提供關閉預覽按鈕

#### Scenario: HTML validation fails

- **WHEN** 使用者儲存的 HTML 內容為空（純文字長度為 0）
- **OR** cheerio 解析 HTML 時拋出錯誤
- **THEN** API 回傳 400 錯誤狀態碼
- **AND** 顯示錯誤訊息「HTML 結構無效」或「HTML 內容為空」
- **AND** 不儲存變更
- **AND** 使用者可繼續編輯

### Requirement: Article Publish Control

系統 SHALL 提供單篇文章發布控制，包括發布目標和狀態選擇。

#### Scenario: User opens publish settings

- **WHEN** 使用者點擊文章的「發布設定」按鈕
- **THEN** 開啟發布設定對話框
- **AND** 顯示以下選項：
  - 發布目標（第一階段僅支援 WordPress，使用既有 `wordpress_status` 欄位）
  - 狀態（draft/pending/publish/future - WordPress 標準狀態）
  - 排程時間（僅當狀態為「future」時顯示）

#### Scenario: User schedules article

- **WHEN** 使用者選擇狀態為「future」（已排程）
- **AND** 選擇未來的日期時間
- **AND** 點擊「確認」
- **THEN** 更新 `generated_articles.wordpress_status` 為 `future`
- **AND** 更新 `article_jobs.scheduled_publish_at` 為所選時間
- **AND** 更新 `article_jobs.status` 為 `scheduled`
- **AND** 文章卡片右上角顯示排程 Badge
- **AND** 關閉對話框並顯示成功訊息

#### Scenario: User publishes article immediately

- **WHEN** 使用者選擇狀態為「publish」（已發布）
- **AND** 點擊「立即發布」
- **THEN** 呼叫 WordPress REST API 發布文章
- **AND** 更新 `generated_articles.wordpress_status` 為 `publish`
- **AND** 更新 `generated_articles.published_at` 為當前時間
- **AND** 儲存 `generated_articles.wordpress_post_id` 和 `wordpress_post_url`
- **AND** 顯示成功訊息並提供 WordPress 文章連結

#### Scenario: WordPress credentials not configured

- **WHEN** 使用者嘗試發布文章
- **BUT** 網站的 WordPress API 認證資訊尚未配置
- **THEN** 顯示錯誤訊息「WordPress 連線尚未設定」
- **AND** 提供連結前往網站設定頁面配置 WordPress URL、使用者名稱和應用程式密碼
- **AND** 不執行發布操作

#### Scenario: WordPress API failure

- **WHEN** 使用者嘗試發布文章
- **BUT** WordPress REST API 回傳錯誤（如認證失敗、網路錯誤）
- **THEN** 顯示具體的錯誤訊息（如「認證失敗：請檢查應用程式密碼」）
- **AND** 文章狀態保持不變
- **AND** 記錄錯誤日誌供除錯
- **AND** 使用者可重試發布

### Requirement: Batch Publish (Future)

系統 SHALL 支援批次發布功能（延後至使用者有明確需求時實作）。

#### Scenario: User selects multiple articles

- **WHEN** 使用者勾選多篇文章
- **AND** 點擊「批次發布」按鈕
- **THEN** 開啟批次發布對話框
- **AND** 顯示選中文章清單
- **AND** 允許選擇統一的發布目標和狀態

#### Scenario: Batch publish execution

- **WHEN** 使用者確認批次發布
- **THEN** 依序對每篇文章執行發布操作
- **AND** 顯示進度指示器
- **AND** 完成後顯示成功/失敗統計
- **AND** 失敗的文章提供錯誤訊息
