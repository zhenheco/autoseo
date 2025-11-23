# Tasks: 修復 Credit 顯示與訂閱方案問題

## 階段 1: 修正訂閱方案顯示（高優先級）

### Task 1: 修改訂閱頁面方案顯示邏輯

- [ ] 編輯 `src/app/(dashboard)/dashboard/subscription/page.tsx`
- [ ] 修改 line 86-88 的邏輯，優先顯示 `subscription_plans.name`
- [ ] 添加 fallback 處理避免顯示無效值
- [ ] 驗證: 檢查訂閱頁面不再顯示 "basic"

**估計時間**: 10 分鐘

### Task 2: 本地測試訂閱頁面

- [ ] `pnpm run dev` 啟動本地開發環境
- [ ] 訪問 `/dashboard/subscription` 頁面
- [ ] 確認方案類型顯示正確
- [ ] 確認與 `/pricing` 頁面一致

**估計時間**: 5 分鐘

## 階段 2: 統一 Credit 命名（中優先級）

### Task 3: 搜尋所有 "Token" 相關 UI 文字

- [ ] 使用 Grep 搜尋 `"Token 餘額"`, `"Token Balance"` 等
- [ ] 記錄所有需要修改的檔案和位置
- [ ] 排除資料庫 schema 和後端邏輯相關檔案

**估計時間**: 10 分鐘

### Task 4: 修改 TokenBalanceDisplay 組件

- [ ] 編輯 `src/components/billing/TokenBalanceDisplay.tsx`
- [ ] line 75: "Token 餘額:" → "Credit 餘額:"
- [ ] line 89: "月配額:" → "月配額:" (保持不變)
- [ ] 驗證: 文章管理頁面顯示 "Credit 餘額"

**估計時間**: 5 分鐘

### Task 5: 搜尋並更新其他 UI 文字

- [ ] 搜尋 `src/app` 和 `src/components` 目錄
- [ ] 將所有面向用戶的 "Token" 文字替換為 "Credit"
- [ ] **保留**: API 欄位名稱、資料庫欄位、內部變數名

**檔案清單** (可能需要修改):

- `src/app/(dashboard)/dashboard/billing/**`
- `src/components/billing/**`
- `src/components/subscription/**`

**估計時間**: 20 分鐘

### Task 6: 驗證所有頁面

- [ ] 文章管理頁面: 顯示 "Credit 餘額"
- [ ] 訂閱頁面: 顯示 "Credit 餘額", "購買 Credit"
- [ ] Billing 相關頁面: 統一使用 Credit

**估計時間**: 10 分鐘

## 階段 3: 診斷 HTML 轉換問題（需驗證）

### Task 7: 生成測試文章並查看日誌

- [ ] 選擇一個新關鍵字
- [ ] 觸發文章生成
- [ ] 等待生成完成（約 2-3 分鐘）
- [ ] 查看 GitHub Actions 日誌
- [ ] 搜尋 `[WritingAgent]` 相關輸出

**估計時間**: 10 分鐘（包括等待）

### Task 8: 分析日誌並定位問題

根據日誌輸出判斷:

**情況 A**: 日誌顯示 "Is HTML?: true"

- 問題出在資料庫儲存或前端渲染
- 檢查 `article-storage.ts` line 200-203
- 檢查前端 DOMPurify 配置

**情況 B**: 日誌顯示 "Is HTML?: false"

- 問題出在 `marked.parse()` 執行失敗
- 檢查 WritingAgent 的 Markdown 清理邏輯
- 考慮降級 marked 版本或使用替代方案

**情況 C**: 沒有看到 `[WritingAgent]` 日誌

- WritingAgent 未被執行
- 檢查 orchestrator 流程
- 確認 writing phase 是否正常觸發

**估計時間**: 15 分鐘

### Task 9: 根據診斷結果修復（待定）

- [ ] 根據 Task 8 的分析結果
- [ ] 實作對應的修復方案
- [ ] 添加額外的錯誤處理和日誌

**估計時間**: 30-60 分鐘（取決於問題複雜度）

### Task 10: 驗證 HTML 轉換修復

- [ ] 生成新文章
- [ ] 檢查資料庫 `html_content` 欄位格式
- [ ] 確認文章預覽正確顯示 HTML
- [ ] 確認沒有 Markdown 語法殘留

**估計時間**: 10 分鐘

## 階段 4: 建置與部署

### Task 11: 執行完整建置測試

- [ ] `pnpm run lint`
- [ ] `pnpm run typecheck` 或 `pnpm exec tsc --noEmit`
- [ ] `pnpm run build`
- [ ] 確認無錯誤

**估計時間**: 5 分鐘

### Task 12: Git Commit 並推送

- [ ] `git add -A`
- [ ] `git commit` (使用清晰的 commit message)
- [ ] `git push origin main`

**估計時間**: 3 分鐘

### Task 13: 驗證 Vercel 部署

- [ ] 等待 Vercel 建置完成（~2 分鐘）
- [ ] 檢查部署狀態為 "Ready"
- [ ] 訪問生產環境驗證修復

**估計時間**: 5 分鐘

## 階段 5: 驗證與監控

### Task 14: 完整功能驗證

- [ ] 訂閱頁面: 確認方案名稱正確
- [ ] 文章管理頁面: 確認顯示 "Credit 餘額"
- [ ] 生成新文章: 確認 HTML 預覽正確
- [ ] Token 扣除: 確認餘額正確減少

**估計時間**: 15 分鐘

### Task 15: 監控與文件更新

- [ ] 監控 Vercel 錯誤日誌（24小時）
- [ ] 更新 CHANGELOG.md
- [ ] 更新開發文件關於 Credit vs Token 的說明
- [ ] Archive 此 OpenSpec change

**估計時間**: 20 分鐘

## 總計估計時間

- **階段 1**: 15 分鐘
- **階段 2**: 45 分鐘
- **階段 3**: 65-95 分鐘（取決於問題複雜度）
- **階段 4**: 13 分鐘
- **階段 5**: 35 分鐘

**總計**: 約 2.5-3.5 小時

## 依賴關係

- Task 1-2 可獨立執行
- Task 3-6 須按順序執行
- Task 7-10 須在前面階段完成後執行
- Task 11-13 須在所有修改完成後執行
- Task 14-15 須在部署後執行

## 並行化機會

可以並行執行：

- Task 1-2 (訂閱方案) 和 Task 3-6 (Credit 命名) 可同時進行
- Task 7 可以在其他修改進行時同時執行
