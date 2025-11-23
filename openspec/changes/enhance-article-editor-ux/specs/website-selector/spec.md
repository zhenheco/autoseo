# Spec: Website Selector

## Overview

新增發布網站選擇下拉選單，讓使用者在發布文章時可以直接選擇目標網站。基於現代 CMS 工作流程模式設計，提供清晰的發布目標指示和錯誤處理。

## ADDED Requirements

### Requirement: Website selection dropdown with visual clarity

**ID**: `website-selector-001`

發布對話框 SHALL 包含網站選擇下拉選單，並提供清晰的視覺回饋，讓使用者明確知道將發布到哪個網站。

#### Scenario: User opens publish dialog

**Given** 使用者在文章編輯頁面
**And** 文章已儲存
**When** 使用者點擊「發布」按鈕
**Then** 系統應顯示發布對話框
**And** 對話框應包含標籤為「發布目標網站 \*」的必填欄位
**And** 下拉選單應顯示「選擇發布網站」預設文字
**And** 發布按鈕應為停用狀態

#### Scenario: Dropdown shows user's websites with icons

**Given** 使用者擁有 3 個 WordPress 網站
**And** 網站分別為「部落格 A (https://blog-a.com)」、「部落格 B (https://blog-b.com)」
**When** 使用者點擊網站選擇下拉選單
**Then** 下拉選單應顯示 3 個選項
**And** 每個選項應包含 Globe 圖示
**And** 每個選項應顯示網站名稱（粗體）
**And** 每個選項應顯示主機名稱（灰色小字）
**And** 格式應為「{Globe 圖示} {網站名稱} (hostname)」

#### Scenario: User selects a website

**Given** 發布對話框已開啟
**When** 使用者選擇「部落格 A」
**Then** 下拉選單應顯示所選網站
**And** 應顯示 Alert 提示「文章將發布至：部落格 A」
**And** Alert 應包含 Info 圖示
**And** 發布按鈕應變為可用狀態

---

### Requirement: Website list fetching with caching

**ID**: `website-selector-002`

系統 SHALL 從資料庫查詢使用者的網站列表，並使用快取策略避免重複請求。

#### Scenario: Fetch websites on dialog open

**Given** 使用者點擊「發布」按鈕
**When** 發布對話框開啟
**Then** 系統應呼叫 API 查詢網站列表
**And** API endpoint 應為 `/api/websites?company_id={companyId}`
**And** 查詢應基於使用者的 company_id
**And** 回傳應包含 `id`, `name`, `url`, `is_active` 欄位

#### Scenario: Use cached websites list

**Given** 使用者在 60 秒內曾查詢過網站列表
**When** 使用者再次開啟發布對話框
**Then** 系統應使用快取的網站列表
**And** 不應發送新的 API 請求
**And** 這可透過 SWR 或 React Query 的 `dedupingInterval: 60000` 實現

#### Scenario: No websites available

**Given** 使用者尚未設定任何網站
**When** 發布對話框開啟
**Then** 網站選擇下拉選單應顯示空狀態訊息
**And** 訊息應為「尚無可用網站」
**And** 應提供連結「前往設定新增網站」指向 `/settings/websites`
**And** 發布按鈕應保持停用狀態

#### Scenario: API error handling

**Given** 網站列表 API 請求失敗
**When** 發布對話框開啟
**Then** 應顯示錯誤訊息「無法載入網站列表」
**And** 應提供「重試」按鈕
**When** 使用者點擊「重試」
**Then** 系統應重新發送 API 請求

---

### Requirement: Smart default website selection

**ID**: `website-selector-003`

系統 SHALL 使用多層邏輯選擇預設網站：localStorage → 上次發布網站 → 第一個可用網站。

#### Scenario: Remember last selected website from localStorage

**Given** localStorage 包含 `last-selected-website-{companyId}` = "site-123"
**And** "site-123" 存在於網站列表中
**When** 使用者開啟發布對話框
**Then** 網站選擇下拉選單應預設選擇 "site-123"
**And** Alert 應自動顯示「文章將發布至：{網站名稱}」

#### Scenario: Fallback to article's last published website

**Given** localStorage 沒有記錄
**And** 文章曾發布到「部落格 A」（儲存在 `articles.website_id`）
**When** 使用者開啟發布對話框
**Then** 應預設選擇「部落格 A」
**And** 這可避免使用者誤發布到錯誤的網站

#### Scenario: Fallback to first available website

**Given** localStorage 沒有記錄
**And** 文章從未發布過（`website_id` 為 null）
**And** 使用者有 2 個可用網站
**When** 發布對話框開啟
**Then** 應預設選擇列表中的第一個網站
**And** Alert 應顯示預設選擇的網站

#### Scenario: Update localStorage on selection

**Given** 使用者選擇了「部落格 B」
**When** 選擇動作完成
**Then** 系統應立即更新 localStorage
**And** localStorage key 應為 `last-selected-website-{companyId}`
**And** localStorage value 應為「部落格 B」的 ID

---

### Requirement: Publish with website validation

**ID**: `website-selector-004`

發布 API MUST 接受並驗證 `website_id` 參數，確保文章發布到正確且有效的 WordPress 網站。

#### Scenario: Publish to selected website

**Given** 使用者選擇了「部落格 A」（ID: "site-123"）
**And** 使用者點擊「確認發布」按鈕
**When** 系統執行發布操作
**Then** API 請求應為 `POST /api/articles/{articleId}/publish`
**And** 請求 body 應包含 `{ website_id: "site-123" }`
**And** 伺服器應驗證 `website_id` 屬於該使用者的 company
**And** 文章應發布到對應的 WordPress 網站
**And** `articles.website_id` 應更新為 "site-123"

#### Scenario: Server validates website ownership

**Given** 使用者嘗試發布文章
**And** 請求包含 `website_id: "site-999"`
**And** "site-999" 不屬於該使用者的 company
**When** 伺服器處理請求
**Then** 應拒絕請求並回傳 403 Forbidden
**And** 錯誤訊息應為「無權限發布到該網站」
**And** 客戶端應顯示錯誤 toast

#### Scenario: Publish success feedback

**Given** 文章成功發布到「部落格 A」
**When** API 回應成功
**Then** 應顯示 success toast「已發布至 部落格 A」
**And** toast 應包含 Check 圖示
**And** toast 應自動消失（3 秒後）
**And** 文章列表應自動更新狀態

---

### Requirement: Website selector in batch publish

**ID**: `website-selector-005`

批次發布對話框 SHALL 包含網站選擇器，並明確提示將發布多少篇文章到目標網站。

#### Scenario: Select website for batch publish

**Given** 使用者選擇了 5 篇文章
**And** 使用者點擊「批次發布」按鈕
**When** 批次發布對話框開啟
**Then** 對話框標題應為「批次發布（5 篇文章）」
**And** 對話框應包含網站選擇下拉選單
**And** 使用者應能選擇單一目標網站

#### Scenario: Batch publish confirmation

**Given** 使用者選擇了 5 篇文章
**And** 使用者選擇「部落格 A」作為目標網站
**When** 使用者點擊「確認批次發布」
**Then** 應顯示確認對話框
**And** 確認訊息應為「確定要將 5 篇文章發布到『部落格 A』嗎？」
**And** 確認對話框應包含「取消」和「確認」按鈕

#### Scenario: Batch publish progress indication

**Given** 批次發布正在執行
**When** 系統發布文章
**Then** 應顯示進度條「正在發布：3 / 5」
**And** 進度條應實時更新
**And** 發布完成後應顯示摘要「成功：5，失敗：0」
**And** 若有失敗，應列出失敗的文章標題和原因

---

### Requirement: Website status indicator

**ID**: `website-selector-006`

網站選擇下拉選單 SHALL 顯示網站狀態指示器，讓使用者知道哪些網站可用。

#### Scenario: Active website indicator

**Given** 網站「部落格 A」的 `is_active` 為 true
**When** 下拉選單顯示網站列表
**Then** 「部落格 A」應正常顯示
**And** 可被選擇

#### Scenario: Inactive website indicator

**Given** 網站「部落格 B」的 `is_active` 為 false
**When** 下拉選單顯示網站列表
**Then** 「部落格 B」應顯示為灰色（disabled）
**And** 應附註「（已停用）」
**And** 不可被選擇
**And** Hover 時應顯示 tooltip「此網站已停用，請聯絡管理員」
