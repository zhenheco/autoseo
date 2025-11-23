# article-hub Specification

## Purpose

定義 `/dashboard/articles` 作為文章管理中樞的核心功能，包括 split-pane 佈局、inline HTML 編輯、預覽、以及單篇和批次發布功能。

## ADDED Requirements

### Requirement: Split-Pane Layout

系統 SHALL 提供可調整的左右分欄佈局，左側為文章列表，右側為預覽/編輯區域。

#### Scenario: User views article hub

- **WHEN** 使用者進入 `/dashboard/articles` 頁面
- **THEN** 頁面顯示左右分欄佈局（使用 Allotment 組件）
- **AND** 左側 pane 寬度預設 30%，最小 300px，最大 500px
- **AND** 右側 pane 寬度預設 70%
- **AND** 中間分隔線（sash）可拖曳調整寬度
- **AND** 寬度調整後保存到 localStorage（300ms debounce）

#### Scenario: Double-click sash to reset pane sizes

- **WHEN** 使用者拖曳調整過 pane 寬度
- **AND** 雙擊中間分隔線（sash）
- **THEN** 左側 pane 重置為 `preferredSize`（30%）
- **AND** 右側 pane 重置為 `preferredSize`（70%）
- **AND** 儲存重置後的尺寸到 localStorage

#### Scenario: Snap-to-zero to hide left pane

- **WHEN** 使用者拖曳 sash 將左側 pane 縮小到接近 minSize（300px）
- **THEN** 左側 pane 自動完全隱藏（snap-to-zero）
- **AND** 右側 pane 擴展為全寬
- **AND** 提供視覺提示（如 sash 變色）表示可拖曳回復

#### Scenario: Restore hidden pane

- **WHEN** 左側 pane 已完全隱藏
- **AND** 使用者拖曳 sash 向右
- **THEN** 左側 pane 重新顯示並恢復到 minSize（300px）
- **AND** 右側 pane 相應縮小

#### Scenario: Responsive layout for mobile (Allotment vertical mode)

- **WHEN** 使用者在小螢幕（< 768px）瀏覽
- **THEN** Allotment 切換為垂直模式（`vertical` prop）
- **AND** 上方 pane 顯示文章列表（預設高度 40vh）
- **AND** 下方 pane 顯示預覽/編輯器（最小高度 60vh）
- **AND** 可拖曳垂直 sash 調整上下高度
- **AND** 支援 snap-to-zero 隱藏上方列表 pane

#### Scenario: Very small screen layout (< 640px)

- **WHEN** 使用者在極小螢幕（< 640px）瀏覽
- **THEN** 使用 Tabs 切換「列表」和「編輯器」view（替代 Allotment）
- **AND** 預設顯示列表 tab
- **AND** 點擊文章後自動切換到編輯器 tab
- **AND** 編輯器 tab 顯示「返回列表」按鈕

### Requirement: Article List in Left Pane

系統 SHALL 在左側 pane 顯示所有文章列表（不篩選網站）。

#### Scenario: Viewing article list

- **WHEN** 使用者查看文章列表
- **THEN** 顯示所有 `generated_articles` 不篩選 `website_id`
- **AND** 每張文章卡片包含：
  - 標題 (text-sm)
  - 狀態 badge
  - 日期、字數、閱讀時間 (text-[10px])
  - Checkbox（用於批次選擇）
- **AND** 卡片按 `created_at` 降冪排序
- **AND** 點擊卡片載入到右側 pane

#### Scenario: Selecting articles for batch operations

- **WHEN** 使用者勾選一或多張文章卡片的 checkbox
- **THEN** 顯示批次操作 toolbar
- **AND** Toolbar 顯示「已選取 X 篇文章」
- **AND** 提供「批次發布」和「取消選取」按鈕

### Requirement: Inline HTML Editor and Preview

系統 SHALL 在右側 pane 提供 HTML 預覽和編輯功能，使用 Tab navigation。

#### Scenario: Previewing article HTML

- **WHEN** 使用者在左側點擊文章
- **THEN** 右側 pane 載入該文章
- **AND** 預設顯示「預覽」tab
- **AND** HTML 內容使用 DOMPurify 淨化後渲染
- **AND** 顯示文章標題（可編輯）
- **AND** 提供「編輯 HTML」tab 切換按鈕

#### Scenario: Editing article HTML inline

- **WHEN** 使用者切換到「編輯 HTML」tab
- **THEN** 顯示 HTML 原始碼編輯器（react-simple-code-editor + Prism.js）
- **AND** 編輯器載入 `generated_articles.html_content`
- **AND** 提供 HTML 語法高亮
- **AND** 編輯器高度至少 500px，可捲動
- **AND** 工具列顯示「儲存」按鈕

#### Scenario: Saving HTML changes inline

- **WHEN** 使用者修改 HTML 並點擊「儲存」
- **THEN** 呼叫 PATCH `/api/articles/[id]` 更新 HTML
- **AND** 更新成功後顯示 toast 訊息「已儲存」
- **AND** 自動切換回「預覽」tab 顯示更新結果
- **AND** 左側列表的文章卡片更新 `updated_at` 時間

#### Scenario: Auto-save draft

- **WHEN** 使用者在編輯器輸入 HTML
- **THEN** 1 秒後自動儲存草稿到 localStorage
- **AND** 頁面重新整理後恢復草稿內容
- **AND** 成功儲存到伺服器後清除 localStorage 草稿

#### Scenario: Editing article title inline

- **WHEN** 使用者點擊右側 pane 的文章標題
- **THEN** 標題變為可編輯的 input
- **AND** 按下 Enter 或失去 focus 時儲存
- **AND** 呼叫 PATCH `/api/articles/[id]` 更新 `title`
- **AND** 左側列表的標題同步更新

### Requirement: Single Article Publish

系統 SHALL 支援從右側 pane 發布單篇文章到指定網站。

#### Scenario: Opening publish dialog for single article

- **WHEN** 使用者在右側 pane 點擊「發布」按鈕
- **THEN** 開啟 `PublishControlDialog` 對話框
- **AND** 對話框包含以下欄位：
  - 選擇目標網站（下拉選單）
  - 發布目標（WordPress，未來可擴充）
  - 發布狀態（draft/publish/scheduled）
  - 排程時間（僅當狀態為 scheduled 時顯示）

#### Scenario: Publishing article to selected website

- **WHEN** 使用者選擇目標網站和發布設定
- **AND** 點擊「立即發布」或「設定排程」
- **THEN** 呼叫 POST `/api/articles/[id]/publish` 並傳入 `website_id`
- **AND** 更新 `published_to_website_id` 和 `published_to_website_at`
- **AND** 發布成功後顯示 toast 訊息
- **AND** 關閉對話框
- **AND** 文章狀態 badge 更新為「已發布」或「已排程」

#### Scenario: Publish without selecting website

- **WHEN** 使用者點擊「立即發布」但未選擇目標網站
- **THEN** 顯示錯誤訊息「請選擇目標網站」
- **AND** 不執行發布操作
- **AND** 保持對話框開啟狀態

### Requirement: Batch Publish

系統 SHALL 支援批次發布多篇文章到同一網站。

#### Scenario: Opening batch publish dialog

- **WHEN** 使用者勾選多篇文章（`selectedItems.size > 0`）
- **AND** 點擊批次操作 toolbar 的「批次發布」按鈕
- **THEN** 開啟 `BatchPublishDialog` 對話框
- **AND** 對話框顯示已選取的文章清單（標題）
- **AND** 提供以下欄位：
  - 選擇目標網站（所有文章將發布到同一網站）
  - 發布狀態（draft/publish，不支援 scheduled）

#### Scenario: Executing batch publish

- **WHEN** 使用者選擇目標網站和發布狀態
- **AND** 點擊「批次發布」
- **THEN** 呼叫 POST `/api/articles/batch-publish`
- **AND** 傳入 `article_ids` 陣列和 `website_id`
- **AND** 顯示進度指示器「發布中 X/Y」
- **AND** 完成後顯示成功/失敗統計
- **AND** 失敗的文章顯示錯誤訊息
- **AND** 成功的文章狀態更新為「已發布」
- **AND** 清空選取狀態

#### Scenario: Batch publish with mixed results

- **WHEN** 批次發布完成
- **AND** 部分文章發布成功，部分失敗
- **THEN** 顯示摘要訊息「成功 X 篇，失敗 Y 篇」
- **AND** 列出失敗的文章標題和錯誤原因
- **AND** 成功的文章 `published_to_website_id` 已更新
- **AND** 失敗的文章保持原狀態

### Requirement: Empty State

系統 SHALL 在無文章時顯示友善的空白狀態。

#### Scenario: No articles exist

- **WHEN** 使用者進入頁面但沒有任何文章
- **THEN** 左側 pane 顯示空白狀態
- **AND** 顯示圖示和提示文字「還沒有任何文章」
- **AND** 提供「新增文章」按鈕
- **AND** 點擊按鈕開啟批次生成對話框

#### Scenario: No article selected

- **WHEN** 使用者尚未點擊任何文章
- **THEN** 右側 pane 顯示提示訊息
- **AND** 顯示「選擇左側文章以開始編輯或預覽」
- **AND** 顯示引導圖示（如箭頭指向左側）

## MODIFIED Requirements

無（此為新功能，不修改既有 spec）

## REMOVED Requirements

### Requirement: Dedicated Edit Page

移除獨立的 `/dashboard/articles/[id]/edit` 頁面，功能整合到主頁面右側 pane。

#### Scenario: Accessing edit URL directly

- **WHEN** 使用者訪問 `/dashboard/articles/[id]/edit`
- **THEN** 重定向到 `/dashboard/articles?article=[id]`
- **AND** 自動在右側 pane 載入該文章
- **AND** 預設開啟「編輯 HTML」tab

### Requirement: Dedicated Preview Page

移除獨立的 `/dashboard/articles/[id]/preview` 頁面，功能整合到主頁面右側 pane。

#### Scenario: Accessing preview URL directly

- **WHEN** 使用者訪問 `/dashboard/articles/[id]/preview`
- **THEN** 重定向到 `/dashboard/articles?article=[id]`
- **AND** 自動在右側 pane 載入該文章
- **AND** 預設開啟「預覽」tab
