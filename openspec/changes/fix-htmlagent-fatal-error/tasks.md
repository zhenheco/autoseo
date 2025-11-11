# 實施任務清單

## 第一階段: 立即執行（P0 - 阻塞問題）

### 1. HTMLAgent 完整重構
- [x] 1.1 修改 `process` 方法：自動包裝 HTML 片段為完整文檔
- [x] 1.2 重構 `insertFAQSchema` 方法：
  - [x] 1.2.1 移除對 `document.head` 的依賴
  - [x] 1.2.2 將 FAQ Schema 插入 `body` 末尾
  - [x] 1.2.3 增加多語言 FAQ 標題匹配（常見問題/FAQ/Q&A/問與答/qa）
  - [x] 1.2.4 改進 FAQ 項目解析邏輯
- [x] 1.3 為 `insertInternalLinks` 添加 try-catch 錯誤處理
- [x] 1.4 為 `insertExternalReferences` 添加 try-catch 錯誤處理
- [x] 1.5 為 `optimizeForWordPress` 添加 try-catch 錯誤處理
- [x] 1.6 確保 `process` 方法在任何錯誤情況下都返回可用的 HTML

### 2. 本地驗證
- [x] 2.1 執行 `npm run build` 確認無編譯錯誤
- [x] 2.2 執行 `npm run typecheck` 確認無類型錯誤
- [x] 2.3 檢查修改的代碼邏輯正確性

## 第二階段: 診斷增強（P1）

### 3. 增強 R2 上傳診斷
- [x] 3.1 在 ImageAgent `uploadToR2` 方法添加診斷日誌：
  - [x] 3.1.1 記錄 filename, contentType, base64Length
  - [x] 3.1.2 驗證環境變數狀態（SET/MISSING）
  - [x] 3.1.3 詳細錯誤堆疊記錄
- [x] 3.2 在 R2Client `uploadImage` 方法添加驗證：
  - [x] 3.2.1 檢查 credentials 是否存在
  - [x] 3.2.2 檢測非 ASCII 字符
  - [x] 3.2.3 改進錯誤訊息

### 4. MetaAgent 模型配置日誌
- [x] 4.1 在 Orchestrator `execute` 方法開頭添加模型配置日誌
- [x] 4.2 記錄所有 Agent 使用的模型名稱

## 第三階段: UI 優化（P2）

### 5. 文章列表顯示修正
- [x] 5.1 修改 `src/app/(dashboard)/dashboard/articles/page.tsx`
- [x] 5.2 將 `displayTitle` 邏輯從 `${keyword} - ${title}` 改為 `title || keywords.join(', ')`

## 第四階段: 資料庫診斷（P1）

### 6. 檢查 MetaAgent 模型配置
- [ ] 6.1 查詢 `agent_configs` 表中的 `meta_model` 值
- [ ] 6.2 如果是 `gpt-3.5-turbo`，更新為 `null` 或 `deepseek-chat`

### 7. 搜尋硬編碼模型
- [ ] 7.1 在 `src/lib/agents/` 中搜尋 `gpt-3.5-turbo`
- [ ] 7.2 在 `src/lib/services/` 中搜尋 `gpt-3.5-turbo`
- [ ] 7.3 移除任何硬編碼的 `gpt-3.5-turbo` 引用

## 第五階段: 環境變數檢查（P1）

### 8. 驗證 R2 配置
- [ ] 8.1 登入 Vercel Dashboard
- [ ] 8.2 檢查 Environment Variables：
  - [ ] `R2_ACCOUNT_ID`
  - [ ] `R2_ACCESS_KEY_ID`
  - [ ] `R2_SECRET_ACCESS_KEY`
  - [ ] `R2_BUCKET_NAME`
  - [ ] `R2_PUBLIC_DOMAIN`
- [ ] 8.3 確認無多餘空白字符或非 ASCII 字符
- [ ] 8.4 如有問題，重新生成 R2 credentials

## 第六階段: 部署與測試

### 9. 提交與部署
- [ ] 9.1 Git commit 所有修改
- [ ] 9.2 Git push 到 main 分支
- [ ] 9.3 等待 Vercel 自動部署完成

### 10. 完整流程測試
- [ ] 10.1 生成測試文章（關鍵字：「HTMLAgent 測試修復」）
- [ ] 10.2 觀察 Vercel 即時日誌（約 10 分鐘）
- [ ] 10.3 驗證文章生成成功：
  - [ ] HTMLAgent 無錯誤
  - [ ] 資料庫 `articles` 表有新記錄
  - [ ] `html_content` 欄位不為 null
  - [ ] FAQ Schema 在 HTML 中
- [ ] 10.4 驗證預覽功能：
  - [ ] 文章列表顯示正確標題（無關鍵字前綴）
  - [ ] 預覽區域顯示完整 HTML
  - [ ] 圖片正確顯示（R2 URL 或 fallback）
- [ ] 10.5 使用 Chrome DevTools 檢查：
  - [ ] Console 無錯誤
  - [ ] Network 請求正常
  - [ ] HTML 結構完整

### 11. 驗證模型配置
- [ ] 11.1 查看日誌中的 "Agent Models Configuration"
- [ ] 11.2 確認所有 Agent 使用正確模型：
  - [ ] ResearchAgent: `deepseek-reasoner`
  - [ ] StrategyAgent: `deepseek-chat`
  - [ ] WritingAgent: `deepseek-chat`
  - [ ] MetaAgent: `deepseek-chat` (NOT `gpt-3.5-turbo`)
  - [ ] ImageAgent: `gpt-image-1-mini`

### 12. 驗證 R2 上傳
- [ ] 12.1 查看診斷日誌 "R2 Upload Diagnostics"
- [ ] 12.2 確認環境變數狀態全部為 "SET"
- [ ] 12.3 如有錯誤，根據日誌修復：
  - [ ] 環境變數缺失 → 在 Vercel 設定
  - [ ] 非 ASCII 字符 → 重新生成 credentials
  - [ ] 其他錯誤 → 根據堆疊追蹤修復

## 第七階段: 文檔更新

### 13. 更新相關文檔
- [ ] 13.1 在計劃文件中標記為「已完成」
- [ ] 13.2 記錄實際修復過程中的發現
- [ ] 13.3 更新 ISSUELOG.md（如有）

## 驗收標準

### 必須通過的測試
1. ✅ 文章生成成功率 100%（至少連續 3 次成功）
2. ✅ 預覽功能正常顯示 HTML
3. ✅ 文章列表僅顯示標題（無關鍵字前綴）
4. ✅ 所有 Agent 使用正確的模型
5. ✅ R2 上傳成功或有清晰的診斷日誌
6. ✅ Console 無錯誤
7. ✅ 資料庫正確儲存文章

### 可選的改進
- ⚠️ R2 上傳成功率 >90%（取決於環境變數配置）
- ⚠️ FAQ Schema 正確插入並在 Google 測試工具驗證通過
