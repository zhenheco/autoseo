# 🚨 緊急安全修復 - Supabase Service Key 洩漏

## 問題摘要
GitHub 偵測到 Supabase Service Role Key 被意外提交到公開儲存庫中。此金鑰具有完整的資料庫存取權限，必須立即撤銷並替換。

## 已採取的行動

### 1. ✅ 已移除包含洩漏金鑰的檔案
- 已刪除所有測試檔案：
  - create-test-company.js
  - confirm-test-account.js
  - create-test-account.js
  - test-*.js (所有測試檔案)

### 2. ✅ 更新 .env.example
- 新增安全警告
- 移除任何實際金鑰痕跡
- 加入明確指示不要提交實際金鑰

## 🔴 立即需要執行的動作

### 1. 在 Supabase Dashboard 撤銷舊金鑰
1. 登入 [Supabase Dashboard](https://app.supabase.com)
2. 選擇您的專案
3. 前往 Settings → API
4. 點擊 "Roll service role key" 生成新的 Service Role Key
5. 複製新的金鑰

### 2. 更新本地環境變數
```bash
# 建立或更新 .env.local
cp .env.example .env.local

# 編輯 .env.local 並填入新的金鑰
# 確保 .env.local 在 .gitignore 中
```

### 3. 更新生產環境
- Vercel: 前往 Settings → Environment Variables 更新 SUPABASE_SERVICE_ROLE_KEY
- 其他平台: 更新對應的環境變數設定

### 4. 清理 Git 歷史記錄
```bash
# 使用 BFG Repo-Cleaner 或 git filter-branch 清除歷史
# 安裝 BFG
brew install bfg

# 清除包含金鑰的檔案
bfg --delete-files '{create-test-*.js,test-*.js}'

# 清除包含金鑰的文字
bfg --replace-text passwords.txt

# 強制推送清理後的歷史
git push --force
```

### 5. 監控異常活動
- 檢查 Supabase Dashboard 的 Database Activity
- 查看是否有異常的 API 呼叫或資料存取
- 檢查帳單是否有異常費用

## 預防措施

### 永遠不要在程式碼中硬編碼敏感資訊

❌ **錯誤做法：**
```javascript
const supabase = createClient(
  'https://YOUR_PROJECT_REF.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // 不要這樣做！
)
```

✅ **正確做法：**
```javascript
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
```

### 使用環境變數檔案
1. `.env.local` - 本地開發（不要提交到 git）
2. `.env.example` - 範例檔案（只包含變數名稱，不含實際值）
3. 確保 `.gitignore` 包含：
```
.env
.env.local
.env.*.local
```

### 設定 Git 前置檢查
建立 `.gitleaks.toml` 設定檔來自動檢查洩漏：
```bash
# 安裝 gitleaks
brew install gitleaks

# 執行檢查
gitleaks detect
```

### 使用 GitHub Secret Scanning
- 已預設啟用，會自動偵測已知的金鑰格式
- 定期檢查 GitHub Security 標籤

## 檢查清單

- [ ] 已在 Supabase Dashboard 撤銷舊金鑰
- [ ] 已生成並設定新的 Service Role Key
- [ ] 已更新所有環境的環境變數
- [ ] 已清理 Git 歷史記錄
- [ ] 已檢查資料庫活動日誌
- [ ] 已設定 git pre-commit hooks
- [ ] 團隊成員已被告知此事件

## 影響評估

**風險等級：高**

Service Role Key 具有以下權限：
- 完整資料庫存取權限
- 繞過 Row Level Security (RLS)
- 可以建立/刪除使用者
- 可以修改資料庫結構

**潛在影響：**
- 未授權的資料存取
- 資料洩漏或竄改
- 服務濫用導致費用增加

## 聯絡資訊

如需協助：
- Supabase Support: support@supabase.io
- GitHub Security: https://github.com/security

## 更新紀錄
- 2024-11-01: 初次發現並處理洩漏事件
- 移除所有包含洩漏金鑰的測試檔案
- 更新 .env.example 加入安全警告