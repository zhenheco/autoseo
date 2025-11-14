# Implementation Tasks

## Phase 1: Article Preview Rendering Fix (最優先)

### 準備工作
- [ ] 安裝 DOMPurify 套件用於 HTML 淨化
- [ ] 安裝 marked 或 remark 用於 Markdown 轉 HTML（如尚未安裝）
- [ ] 檢查現有文章的 html_content 欄位是否有資料

### Markdown 到 HTML 轉換
- [ ] 在 WritingAgent 中實作 Markdown 到 HTML 轉換
- [ ] 更新 article-storage.ts 確保同時儲存 markdown 和 html
- [ ] 為現有文章執行資料遷移腳本（轉換 markdown 為 html）

### 預覽渲染修復
- [ ] 修改 articles/page.tsx 確保使用 html_content 欄位
- [ ] 添加 DOMPurify 淨化步驟在渲染前
- [ ] 更新預覽區的 CSS 類別（添加 prose 樣式）
- [ ] 測試圖片顯示是否正常
- [ ] 測試各種格式元素（標題、列表、程式碼區塊）

### 效能優化
- [ ] 實作長文章的虛擬捲動
- [ ] 添加圖片懶加載
- [ ] 實作內容快取機制

## Phase 2: Token Balance Display Adjustment

### 位置調整
- [ ] 從文章列表區域移除 TokenBalanceDisplay 組件
- [ ] 在頁面頂部標題區域添加 TokenBalanceDisplay
- [ ] 調整樣式確保水平居中對齊
- [ ] 優化在不同螢幕尺寸的顯示效果

### 餘額顯示優化
- [ ] 簡化餘額顯示格式（月配額 + 購買餘額）
- [ ] 添加餘額不足的視覺警告（紅色文字、警告圖示）
- [ ] 實作餘額數字變化的過渡動畫

### 即時更新機制
- [ ] 在 generate-batch API 返回後觸發餘額更新
- [ ] 使用 SWR 的 mutate 功能強制重新獲取
- [ ] 實作全域事件系統協調餘額更新
- [ ] 添加樂觀更新（立即顯示預估扣除）
- [ ] 處理更新失敗的錯誤情況

### API 優化
- [ ] 確保 /api/billing/balance 返回正確格式
- [ ] 優化 API 響應時間
- [ ] 實作餘額快取機制
- [ ] 添加餘額變更的 WebSocket 通知（可選）

## Phase 3: Keyword Title Workflow Optimization

### UI 文字和標籤調整
- [ ] 將「關鍵字」標籤改為「文章主題/關鍵字」
- [ ] 更新輸入欄位的 placeholder 文字
- [ ] 添加幫助提示說明主題和標題的區別
- [ ] 更新對話框標題為「批次文章生成 - 主題設定」

### 標題生成邏輯優化
- [ ] 修改 /api/articles/generate-titles 確保不直接使用關鍵字作為標題
- [ ] 改進 prompt 讓 AI 生成更多樣化的標題
- [ ] 確保生成的標題都是完整、可發布的格式
- [ ] 添加標題重複檢測機制

### 進行中列表管理
- [ ] 實作標題去重邏輯
- [ ] 確保每個標題只出現一次在列表中
- [ ] 正確顯示關鍵字和標題的配對關係
- [ ] 添加標題編輯功能（點擊可修改）

### 自訂標題功能增強
- [ ] 優化自訂標題輸入體驗
- [ ] 確保自訂標題保留原始關鍵字 metadata
- [ ] 添加標題字數限制提示
- [ ] 實作標題預覽功能

## Phase 4: Testing & Validation

### 單元測試
- [ ] 測試 Markdown 到 HTML 轉換函數
- [ ] 測試 DOMPurify 淨化邏輯
- [ ] 測試 Token 餘額計算
- [ ] 測試標題去重邏輯

### 整合測試
- [ ] 測試完整的文章生成流程
- [ ] 測試餘額扣除和更新流程
- [ ] 測試預覽渲染管道
- [ ] 測試錯誤處理和降級方案

### E2E 測試
- [ ] 用戶完整操作流程測試
- [ ] 跨瀏覽器相容性測試
- [ ] 行動裝置顯示測試
- [ ] 效能測試（大量文章、長文章）

### 使用者驗收測試
- [ ] 邀請用戶測試新的關鍵字/標題流程
- [ ] 收集對 Token 餘額顯示的回饋
- [ ] 驗證預覽效果符合期望
- [ ] 記錄並處理發現的問題

## Phase 5: Documentation & Deployment

### 文件更新
- [ ] 更新使用者操作手冊
- [ ] 更新 API 文件
- [ ] 記錄資料遷移步驟
- [ ] 準備版本發布說明

### 部署準備
- [ ] 執行資料庫遷移腳本
- [ ] 更新環境變數（如需要）
- [ ] 準備回滾計劃
- [ ] 設定監控和警報

### 部署執行
- [ ] 部署到測試環境
- [ ] 執行冒煙測試
- [ ] 部署到生產環境
- [ ] 監控錯誤日誌和效能指標

### 後續追蹤
- [ ] 監控用戶使用情況
- [ ] 收集用戶回饋
- [ ] 處理緊急問題
- [ ] 規劃下一階段優化

## Dependencies & Blockers

### 技術依賴
- DOMPurify 套件安裝
- Markdown 解析器（marked/remark）
- Tailwind Typography 插件（prose 樣式）

### 資料依賴
- 現有文章資料格式確認
- Token 計費 API 規格確認
- 圖片儲存位置和格式

### 時程考量
- Phase 1 需要最優先完成（影響用戶體驗最大）
- Phase 2 和 3 可以並行開發
- Phase 4 需要所有功能完成後進行
- Phase 5 部署需要選擇低峰時段

## Success Metrics

### 技術指標
- 預覽載入時間 < 500ms
- Token 餘額更新延遲 < 1s
- 零 XSS 漏洞
- 標題生成成功率 > 95%

### 業務指標
- 用戶滿意度提升
- 文章生成錯誤率降低
- 支援請求減少
- 系統使用率提升