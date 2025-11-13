# Tasks: 環境變數同步與驗證系統

## ✅ 階段一：緊急修復（優先級：🔴 最高）

### Task 1.1: 診斷並記錄當前狀態
- [ ] 列出所有 GitHub Secrets
- [ ] 列出所有 Vercel 環境變數
- [ ] 記錄不一致的變數
- [ ] 記錄包含換行符的變數
- [ ] 建立問題報告文件

**驗證**：產生 `docs/env-audit-report.md`

### Task 1.2: 手動修復關鍵環境變數
使用以下方法逐一修復（無換行符）：

```bash
# 方法一：使用 echo 避免換行
echo -n "actual_value_here" | gh secret set VAR_NAME --repo acejou27/Auto-pilot-SEO

# 方法二：從檔案讀取（確保檔案無換行）
printf "actual_value_here" > /tmp/secret.txt
gh secret set VAR_NAME --repo acejou27/Auto-pilot-SEO < /tmp/secret.txt
rm /tmp/secret.txt
```

需修復的變數（按優先級）：
1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. `OPENAI_API_KEY`
5. `DEEPSEEK_API_KEY`
6. `R2_ACCESS_KEY_ID`
7. `R2_SECRET_ACCESS_KEY`
8. `R2_ACCOUNT_ID`
9. `R2_BUCKET_NAME`
10. `USE_MULTI_AGENT_ARCHITECTURE`

**驗證**：執行 `gh workflow run article-generation.yml`，檢查「驗證環境變數」步驟通過

### Task 1.3: 執行端到端測試
- [ ] 觸發文章生成 workflow
- [ ] 監控執行過程
- [ ] 驗證環境變數載入正確
- [ ] 驗證 R2 圖片上傳成功
- [ ] 驗證 Multi-Agent 運作正常
- [ ] 至少執行 3 次成功測試

**驗證**：連續 3 次文章生成測試成功

---

## 🔧 階段二：自動化同步工具（優先級：🟡 高）

### Task 2.1: 改進同步腳本
修改 `scripts/sync-secrets-vercel-to-github.sh`：

- [ ] 修正換行符清理邏輯（使用 `tr -d '\n\r'` 和 `xargs`）
- [ ] 新增詳細的除錯日誌
- [ ] 新增 dry-run 模式
- [ ] 新增備份功能
- [ ] 新增回滾機制

**驗證**：執行腳本成功同步所有變數

### Task 2.2: 建立雙向同步支援
建立 `scripts/sync-secrets-github-to-vercel.sh`：

- [ ] 從 GitHub Secrets 讀取變數
- [ ] 推送到 Vercel 環境變數
- [ ] 處理 Production / Preview / Development 環境
- [ ] 衝突檢測和提示

**驗證**：成功將 GitHub Secrets 同步到 Vercel

### Task 2.3: 建立環境變數驗證工具
建立 `scripts/validate-env-vars.ts`：

- [ ] 檢測換行符和特殊字元
- [ ] 驗證必要變數是否存在
- [ ] 檢查變數值格式
  - URL 格式（`NEXT_PUBLIC_SUPABASE_URL`）
  - API Key 格式（`OPENAI_API_KEY`, `DEEPSEEK_API_KEY`）
  - Boolean 格式（`USE_MULTI_AGENT_ARCHITECTURE`）
- [ ] 產生驗證報告

**驗證**：工具能正確檢測所有格式問題

### Task 2.4: 整合到 GitHub Actions
建立 `.github/workflows/sync-env-vars.yml`：

- [ ] 定期檢查環境變數一致性（每日凌晨 2:00）
- [ ] 發現不一致時發送 Issue 通知
- [ ] 提供手動觸發選項
- [ ] 整合驗證工具

**驗證**：Workflow 能正確檢測並通知不一致

---

## 📊 階段三：監控與測試（優先級：🟢 中）

### Task 3.1: 建立單元測試
建立 `__tests__/env-sync.test.ts`：

- [ ] 測試環境變數載入
- [ ] 測試換行符檢測
- [ ] 測試格式驗證
- [ ] 測試同步邏輯

**驗證**：所有測試通過

### Task 3.2: 建立整合測試
建立 `__tests__/integration/github-actions.test.ts`：

- [ ] 測試 GitHub Actions 環境變數載入
- [ ] 測試 workflow 執行
- [ ] 測試錯誤處理

**驗證**：整合測試通過

### Task 3.3: 建立監控 Dashboard
建立 `src/app/admin/env-status/page.tsx`：

- [ ] 顯示 Vercel 環境變數狀態
- [ ] 顯示 GitHub Secrets 狀態
- [ ] 顯示同步狀態和最後同步時間
- [ ] 顯示驗證錯誤
- [ ] 提供手動同步按鈕

**驗證**：Dashboard 能正確顯示所有資訊

### Task 3.4: 建立文件
- [ ] 更新 README.md 說明環境變數設定
- [ ] 建立 `docs/env-var-management.md` 完整指南
- [ ] 建立疑難排解文件

**驗證**：文件完整且易懂

---

## 🎯 完成標準

### 階段一完成標準
- ✅ 所有關鍵環境變數無換行符
- ✅ GitHub Actions 環境變數驗證通過
- ✅ 文章生成測試連續 3 次成功

### 階段二完成標準
- ✅ 自動化同步腳本可靠運作
- ✅ 雙向同步功能正常
- ✅ 驗證工具能檢測所有問題
- ✅ CI/CD 整合完成

### 階段三完成標準
- ✅ 測試覆蓋率 > 80%
- ✅ 監控 Dashboard 上線
- ✅ 文件完整

---

## ⚠️ 風險與依賴

### 風險
- **資料丟失**：同步過程中可能覆蓋正確的值
  - 緩解：每次同步前建立備份
- **服務中斷**：錯誤的環境變數可能導致服務不可用
  - 緩解：在測試環境先驗證

### 依賴
- Vercel CLI 已安裝並認證
- GitHub CLI 已安裝並認證
- 有修改 GitHub Secrets 的權限
- 有修改 Vercel 環境變數的權限

---

## 📅 預估時間

- 階段一：2-3 小時
- 階段二：3-4 小時
- 階段三：2-3 小時
- **總計**：7-10 小時
