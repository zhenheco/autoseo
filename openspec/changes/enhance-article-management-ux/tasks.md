# 實作任務清單

## 1. 修復 HTML 連結渲染問題

- [x] 1.1 更新 ArticleHtmlPreview 組件，使用 useMemo 優化性能
- [x] 1.2 檢查並修正 DOMPurify ALLOWED_ATTR 配置，確保包含 href, target, rel
- [x] 1.3 添加連結樣式（藍色、hover 底線）
- [x] 1.4 測試內外部連結點擊功能

## 2. 修正文章狀態管理邏輯

- [x] 2.1 修改 `/api/articles/generate-batch` 實作冪等性檢查
- [x] 2.2 使用 slug 或 title+keyword 作為唯一性判斷
- [x] 2.3 實作 upsert 邏輯（存在則更新，不存在則創建）
- [x] 2.4 確保狀態正確轉換（pending → processing → completed）
- [x] 2.5 確保語系（targetLanguage）和字數（wordCount）正確儲存到 metadata
- [x] 2.6 驗證文章生成時使用正確的語系和字數設定
- [x] 2.7 移除 ArticleGenerationButtons 中的圖片數量選擇器
- [x] 2.8 從 GenerationItem interface 移除 imageCount 欄位
- [x] 2.9 測試避免重複創建文章任務

## 3. 實作批次選擇功能

- [x] 3.1 在文章列表頁面每列新增 Checkbox 組件
- [x] 3.2 實作批次選擇 state 管理（useState）
- [x] 3.3 實作「Select All」功能
- [x] 3.4 顯示已選取文章數量
- [x] 3.5 添加勾選狀態視覺反饋

## 4. 實作排程發佈工具列

- [ ] 4.1 建立 ArticleScheduleToolbar 組件
- [ ] 4.2 新增排程時間選擇器（日期時間 picker）
- [ ] 4.3 新增排程條件下拉選單（立即發佈、指定時間、間隔發佈）
- [ ] 4.4 實作「SCHEDULE ALL」按鈕功能
- [ ] 4.5 實作「RESET SCHEDULE」按鈕功能
- [ ] 4.6 顯示排程日期在文章列表

## 5. 實作文章狀態指示器

- [x] 5.1 建立 ArticleStatusBadge 組件
- [x] 5.2 實作不同狀態的圖示和樣式：
  - 已完成：綠色勾勾
  - 已排程：時鐘圖示 + 日期
  - 處理中：轉圈動畫
- [x] 5.3 整合到文章列表頁面

## 6. 實作即時編輯功能

- [ ] 6.1 整合富文本編輯器（建議使用 Tiptap 或 Lexical）
- [ ] 6.2 建立編輯工具列組件（RichTextToolbar）
- [ ] 6.3 實作文字格式功能（粗體、斜體、底線）
- [ ] 6.4 實作標題格式選擇（H1-H4）
- [ ] 6.5 實作文字對齊功能（左、中、右、分散對齊）
- [ ] 6.6 實作復原/重做功能
- [ ] 6.7 實作自動儲存（debounce 3秒）
- [ ] 6.8 新增字數統計顯示

## 7. 實作單篇發佈功能

- [ ] 7.1 建立 ArticlePublishDialog 組件
- [ ] 7.2 新增發佈狀態選擇器（草稿、已發佈、排程）
- [ ] 7.3 實作 WordPress 發佈 API endpoint (`/api/articles/[id]/publish`)
- [ ] 7.4 顯示發佈結果和「GO TO POST」連結
- [ ] 7.5 支援多平台選擇（WordPress、其他 CMS）

## 8. 實作文章複製功能

- [x] 8.1 在預覽頁面右上角新增「複製」按鈕
- [x] 8.2 實作 Clipboard API 複製功能
- [x] 8.3 添加降級方案（document.execCommand）
- [x] 8.4 顯示複製成功/失敗 alert

## 9. 實作多網站選擇器

- [ ] 9.1 建立 WebsiteSelector 組件
- [ ] 9.2 從 API 獲取使用者的網站列表
- [ ] 9.3 支援多選功能
- [ ] 9.4 實作批次發佈 API endpoint (`/api/articles/publish-batch`)

## 10. 資料庫變更

- [ ] 10.1 為 `article_jobs` 表新增唯一性約束（考慮 slug 或 title+created_at）
- [ ] 10.2 考慮新增 `article_publications` 表記錄發佈歷史
- [ ] 10.3 在 `generated_articles` 表新增 `scheduled_at` 欄位
- [ ] 10.4 新增資料庫遷移腳本

## 11. 測試與驗證

- [x] 11.1 測試 HTML 連結顯示和點擊
- [x] 11.2 測試批次選擇和全選功能
- [ ] 11.3 測試排程發佈流程
- [ ] 11.4 測試即時編輯和自動儲存
- [ ] 11.5 測試單篇發佈到 WordPress
- [x] 11.6 測試文章複製功能
- [ ] 11.7 測試多網站發佈
- [x] 11.8 測試避免重複創建文章

## 12. UI/UX 優化

- [ ] 12.1 確保所有組件樣式一致
- [ ] 12.2 添加載入狀態和錯誤處理
- [ ] 12.3 添加成功/失敗的視覺反饋（Toast）
- [ ] 12.4 確保 RWD 響應式設計
- [ ] 12.5 添加適當的動畫效果
