# WordPress 文章發布功能

## ADDED Requirements

### Requirement: 完整 WordPress 發布流程

系統 MUST 提供完整的 WordPress 文章發布功能，包含文章內容、分類、標籤、特色圖片和 SEO 元數據的同步。

#### Scenario: 發布文章到 WordPress

**Given** 用戶有一篇已生成的文章
**And** 已設定目標 WordPress 網站的憑證
**When** 用戶選擇網站並點擊「發布」
**Then** 系統應該：

- 建立 WordPress 客戶端連線
- 同步文章分類（不存在則建立）
- 同步文章標籤（不存在則建立）
- 上傳特色圖片（如果有）
- 調用 WordPress API 建立文章
- 更新 SEO 外掛元數據（Rank Math 或 Yoast）
- 保存 WordPress post ID 和 URL 到資料庫
- 更新文章狀態為 'published'
  **And** 返回發布結果包含 WordPress URL

#### Scenario: 處理 WordPress 認證失敗

**Given** 用戶設定的 WordPress 憑證無效
**When** 嘗試發布文章
**Then** 系統應該返回明確的錯誤訊息「WordPress 認證失敗，請檢查網站設定」
**And** 錯誤代碼為 'AUTH_FAILED'
**And** 不應更新文章狀態

#### Scenario: 處理網路連線失敗

**Given** WordPress 網站暫時無法連線
**When** 嘗試發布文章
**Then** 系統應該返回錯誤訊息「WordPress 連線失敗，請稍後重試」
**And** 錯誤代碼為 'NETWORK_ERROR'
**And** 標記錯誤為可重試 (retryable: true)

### Requirement: WordPressPublishService 服務

系統 MUST 提供獨立的 WordPress 發布服務類別，分離關注點。

#### Scenario: 使用 WordPressPublishService 發布

**Given** 有效的文章 ID、網站 ID 和公司 ID
**When** 調用 `WordPressPublishService.publish()`
**Then** 服務應該：

- 從資料庫獲取文章完整資料
- 從資料庫獲取網站設定
- 執行完整發布流程
- 返回 `{ success: true, wordpress_post_id, wordpress_url }`

#### Scenario: 分類同步

**Given** 文章包含分類 ["科技", "AI"]
**And** WordPress 網站已有「科技」分類但沒有「AI」分類
**When** 發布文章
**Then** 系統應該：

- 重用現有的「科技」分類 ID
- 建立新的「AI」分類
- 將兩個分類 ID 關聯到文章

#### Scenario: 特色圖片上傳

**Given** 文章有特色圖片 URL
**When** 發布文章
**Then** 系統應該：

- 下載圖片
- 上傳到 WordPress 媒體庫
- 獲取 media ID
- 設定為文章的 featured_media

### Requirement: SEO 外掛整合

系統 MUST 支援主流 WordPress SEO 外掛的元數據同步。

#### Scenario: Rank Math SEO 元數據同步

**Given** WordPress 網站安裝了 Rank Math SEO
**And** 文章有 SEO 元數據（title, description, focus keyword）
**When** 發布文章
**Then** 系統應該調用 Rank Math API 更新元數據：

- `rank_math_title`
- `rank_math_description`
- `rank_math_focus_keyword`

#### Scenario: Yoast SEO 元數據同步

**Given** WordPress 網站安裝了 Yoast SEO
**And** 文章有 SEO 元數據
**When** 發布文章
**Then** 系統應該在 `createPost` 時包含：

- `yoast_wpseo_title`
- `yoast_wpseo_metadesc`
- `yoast_wpseo_focuskw`

## 實作細節

### 資料庫變更

無需變更資料庫 schema，使用現有欄位：

- `wordpress_post_id`: 儲存 WordPress 文章 ID
- `wordpress_post_url`: 儲存 WordPress 文章 URL
- `wordpress_status`: 儲存 WordPress 狀態 ('publish', 'draft')
- `published_to_website_id`: 儲存目標網站 ID

### 新增檔案

- `src/lib/services/wordpress-publish.service.ts`

### 修改檔案

- `src/app/api/articles/[id]/publish/route.ts`

### 依賴關係

- 依賴 `WordPressClient` (已存在)
- 依賴 `website_configs` 表的有效憑證
