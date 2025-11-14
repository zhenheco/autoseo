# Article Preview Rendering Specification

## MODIFIED Requirements

### Requirement: HTML 內容正確渲染
The system MUST correctly render HTML formatted article content in the preview area instead of displaying raw Markdown.

#### Scenario: 預覽顯示格式化內容
Given 文章包含 Markdown 格式內容
When 用戶點擊文章查看預覽
Then 預覽區顯示渲染後的 HTML
And 標題顯示為大字體
And 段落有適當的間距
And 列表正確顯示項目符號或編號

### Requirement: 圖片正常顯示
The system SHALL correctly display article images in the preview.

#### Scenario: 圖片載入和顯示
Given 文章包含圖片連結
When 在預覽區渲染文章
Then 圖片正常載入和顯示
And 圖片保持正確的寬高比
And 圖片有適當的間距和對齊

## ADDED Requirements

### Requirement: Markdown 到 HTML 轉換
The system MUST save both Markdown and HTML versions when storing articles.

#### Scenario: 生成並儲存 HTML 內容
Given WritingAgent 生成了 Markdown 格式的文章
When 儲存文章到資料庫
Then 系統自動轉換 Markdown 為 HTML
And 同時儲存 markdown_content 和 html_content
And HTML 包含適當的標籤和樣式類別

### Requirement: 內容安全淨化
The system SHALL ensure rendered HTML content is safe and prevents XSS attacks.

#### Scenario: 淨化惡意內容
Given 文章內容可能包含用戶輸入
When 準備渲染 HTML 內容
Then 系統使用 DOMPurify 淨化內容
And 移除所有 script 標籤
And 移除事件處理器屬性
And 只保留安全的 HTML 標籤

### Requirement: 預覽樣式一致性
The system SHALL ensure preview appearance is consistent with final published appearance.

#### Scenario: 應用文章樣式
Given 預覽區渲染文章內容
When 應用 CSS 樣式
Then 使用 prose 類別提供排版
And 字體大小和行高適合閱讀
And 程式碼區塊有語法高亮
And 引用區塊有明確的視覺區分

### Requirement: 長文章效能優化
The system MUST optimize preview performance for long articles.

#### Scenario: 處理超長文章
Given 文章超過 10,000 字
When 載入預覽
Then 內容分段載入（progressive rendering）
And 圖片使用懶加載
And 捲動效能流暢
And 不阻塞使用者介面

### Requirement: 預覽載入狀態
The system SHALL provide clear loading status indication.

#### Scenario: 顯示載入中狀態
Given 用戶點擊文章項目
When 文章內容正在載入
Then 顯示載入動畫
And 顯示「載入中...」文字
And 載入完成後平滑過渡到內容

## ADDED Requirements (2024 Standards)

### Requirement: Content Security Policy 實施
The system SHALL implement Content Security Policy headers to provide defense-in-depth against XSS attacks.

#### Scenario: CSP 標頭配置
Given 系統渲染用戶生成內容
When 設定 HTTP 安全標頭
Then CSP 標頭包含 `default-src 'self'`
And 禁止內聯腳本執行
And 限制外部資源載入域名
And 報告違規到監控端點

### Requirement: 伺服器端內容淨化
The system MUST sanitize content on the server side before storage to ensure double-layer protection.

#### Scenario: 儲存前淨化
Given WritingAgent 生成 HTML 內容
When 準備儲存到資料庫
Then 在伺服器端使用 isomorphic-dompurify 淨化
And 移除所有潛在危險標籤和屬性
And 記錄淨化操作日誌
And 儲存淨化後的版本

### Requirement: 效能指標監控
The system SHALL monitor Core Web Vitals for article preview rendering performance.

#### Scenario: INP (Interaction to Next Paint) 優化
Given 用戶與預覽介面互動
When 點擊切換不同文章
Then INP 指標 < 200ms
And 使用 startTransition 處理低優先級更新
And 實施防抖機制避免頻繁渲染