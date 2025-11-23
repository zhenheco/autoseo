# website-archive Specification

## Purpose

定義 `/dashboard/websites/[id]` 頁面作為網站文章歸檔的查看功能，僅顯示已發布到該網站的文章（唯讀）。

## ADDED Requirements

無（此 spec 主要移除功能）

## MODIFIED Requirements

### Requirement: Display Published Articles Only

系統 SHALL 僅顯示已發布到該網站的文章，不提供編輯和發布功能。

#### Scenario: Viewing website articles

- **WHEN** 使用者進入 `/dashboard/websites/[id]` 頁面
- **THEN** 查詢 `generated_articles` WHERE `published_to_website_id = [id]`
- **AND** 顯示網站統計資訊（已發布文章數、總字數）
- **AND** 列出已發布文章列表
- **AND** 每張文章卡片包含：
  - 標題
  - 摘要（excerpt）
  - 關鍵字 badges
  - 發布日期（`published_to_website_at`）
  - 字數、閱讀時間
  - WordPress post URL 連結
- **AND** 不顯示編輯、發布、預覽按鈕

#### Scenario: Article not yet published

- **WHEN** 使用者查看網站但尚無已發布文章
- **THEN** 顯示空白狀態
- **AND** 提示訊息「此網站尚無已發布文章」
- **AND** 提供連結「前往文章管理中樞發布文章」
- **AND** 點擊連結導向 `/dashboard/articles`

#### Scenario: Viewing WordPress post

- **WHEN** 使用者點擊文章卡片的「查看發布」連結
- **THEN** 在新視窗開啟 `wordpress_post_url`
- **AND** 不跳轉離開當前頁面

### Requirement: Read-Only Article Details

系統 SHALL 提供文章詳情查看功能，但不允許編輯。

#### Scenario: Expanding article details

- **WHEN** 使用者點擊文章卡片（非 WordPress 連結）
- **THEN** 展開顯示完整文章內容
- **AND** 使用 DOMPurify 淨化 HTML 後渲染
- **AND** 顯示文章 meta 資訊（發布日期、作者、分類）
- **AND** 不提供編輯功能
- **AND** 提供「在文章管理中樞編輯」連結
- **AND** 點擊連結導向 `/dashboard/articles?article=[id]`

#### Scenario: Navigating to edit from archive

- **WHEN** 使用者點擊「在文章管理中樞編輯」連結
- **THEN** 導向 `/dashboard/articles?article=[id]`
- **AND** 自動在右側 pane 載入該文章
- **AND** 預設開啟「編輯 HTML」tab
- **AND** 使用者可以編輯並重新發布

## REMOVED Requirements

### Requirement: Article Publish Control

移除 `/dashboard/websites/[id]` 的發布功能，所有發布操作移至 `/dashboard/articles`。

#### Scenario: Publish button no longer available

- **WHEN** 使用者查看 `/dashboard/websites/[id]` 的文章列表
- **THEN** 不顯示「發布」按鈕
- **AND** 不顯示 `ArticlePublishButton` 組件
- **AND** 如需發布，引導使用者前往 `/dashboard/articles`

### Requirement: HTML Content Editor Access

移除 `/dashboard/websites/[id]` 的「編輯 HTML」按鈕。

#### Scenario: Edit HTML button no longer available

- **WHEN** 使用者查看 `/dashboard/websites/[id]` 的文章列表
- **THEN** 不顯示「編輯 HTML」按鈕
- **AND** 不提供連結到 `/dashboard/articles/[id]/edit`
- **AND** 如需編輯，引導使用者前往 `/dashboard/articles`

### Requirement: Article Preview Page Access

移除 `/dashboard/websites/[id]` 的「預覽」按鈕（獨立頁面）。

#### Scenario: Preview button no longer available

- **WHEN** 使用者查看 `/dashboard/websites/[id]` 的文章列表
- **THEN** 不顯示「預覽」按鈕（獨立頁面）
- **AND** 可以在卡片內展開查看完整內容（inline 預覽）
- **AND** 如需完整編輯和預覽功能，引導使用者前往 `/dashboard/articles`
