# Gmail 認證問題診斷報告

## 測試日期
2025-10-31

## 問題摘要
郵件邀請功能在發送郵件時遇到 Gmail 認證失敗（535 錯誤）。

## 已完成的修復工作

### 1. ✅ 修復 Nodemailer 配置
**問題**: 使用明確的 SMTP 配置而非 Gmail 服務配置
**解決方案**:
- 改用官方建議的 `service: 'Gmail'` 配置
- 檔案: `src/lib/email.ts:20-26`

**修改前**:
```typescript
const transportConfig = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: gmailUser,
    pass: gmailAppPassword,
  },
}
```

**修改後**:
```typescript
const transportConfig = {
  service: 'Gmail',
  auth: {
    user: gmailUser,
    pass: gmailAppPassword,
  },
}
```

### 2. ✅ 實作密碼自動處理
**問題**: Gmail 應用程式密碼格式包含空格（例如：`ibos nplf rbur chvk`）
**解決方案**:
- 在程式碼中自動移除密碼中的所有空格
- 檔案: `src/lib/email.ts:14`

```typescript
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '')
```

### 3. ✅ 恢復原始密碼格式
**檔案**: `.env.local:39`
```bash
GMAIL_APP_PASSWORD=ibos nplf rbur chvk
```

### 4. ✅ 建立測試端點
**檔案**: `src/app/api/test-email/route.ts`
**用途**: 可直接測試郵件發送功能，無需認證

**檔案**: `src/app/api/test-email-debug/route.ts`
**用途**: 驗證密碼配置是否正確讀取

## 測試結果

### 密碼配置驗證
訪問 `http://localhost:3168/api/test-email-debug` 的結果：

```json
{
  "gmailUser": "acejou27@gmail.com",
  "passwordLength": 19,        // 原始長度（含空格）
  "passwordProcessedLength": 16, // 處理後長度（移除空格）
  "hasSpaces": true,            // 確認有空格
  "firstChars": "ibos",         // 開頭正確
  "lastChars": "chvk"           // 結尾正確
}
```

✅ 密碼配置正確讀取並處理

### 郵件發送測試
訪問 `http://localhost:3168/api/test-email` 的結果：

```
❌ 郵件發送失敗: Error: Invalid login: 535-5.7.8 Username and Password not accepted.
```

**錯誤詳情**:
- 錯誤代碼: `535` (認證失敗)
- 錯誤類型: `EAUTH` (Authentication Error)
- Gmail 回應: `Username and Password not accepted`

## 根本原因分析

經過完整測試，確認：
1. ✅ 程式碼邏輯正確（密碼處理、SMTP 配置）
2. ✅ 環境變數正確讀取
3. ✅ Nodemailer 配置正確
4. ❌ **Gmail 應用程式密碼無效或已過期**

### 為何確定是密碼問題？

1. **535 錯誤明確指示**: Gmail 伺服器明確回應「用戶名和密碼不被接受」
2. **密碼處理正確**: 測試端點確認密碼正確處理（19 → 16 字元）
3. **配置符合官方文件**: 使用 context7 查詢的 nodemailer 官方配置
4. **SMTP 連線成功**: 錯誤發生在認證階段，不是連線階段

### 可能的密碼問題原因

根據 Gmail 錯誤訊息連結（https://support.google.com/mail/?p=BadCredentials）：

1. **應用程式密碼已過期或被撤銷**
2. **應用程式密碼輸入錯誤**（但測試顯示讀取正確）
3. **兩步驟驗證未啟用**（需要先啟用才能生成應用程式密碼）
4. **帳號安全設定變更**

## 🔧 需要用戶執行的操作

### 重新生成 Gmail 應用程式密碼

#### 步驟 1: 確認兩步驟驗證已啟用
1. 前往 https://myaccount.google.com/security
2. 確認「兩步驟驗證」已啟用
3. 如未啟用，請先啟用

#### 步驟 2: 生成新的應用程式密碼
1. 前往 https://myaccount.google.com/apppasswords
2. 或從 Google 帳號 > 安全性 > 應用程式密碼
3. 選擇應用程式：**郵件**
4. 選擇裝置：**其他（自訂名稱）**
5. 輸入名稱：`Auto Pilot SEO`
6. 點擊「產生」

#### 步驟 3: 更新 .env.local
1. 複製新生成的 16 字元密碼（例如：`xxxx xxxx xxxx xxxx`）
2. 更新 `.env.local` 檔案：
   ```bash
   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
   ```
   ⚠️ **重要**: 保留空格，程式會自動處理

#### 步驟 4: 重啟開發伺服器
```bash
npm run dev
```

#### 步驟 5: 測試郵件發送
訪問測試端點：
```bash
curl http://localhost:3168/api/test-email
```

如果成功，應該看到：
```json
{"message":"✅ 郵件發送成功"}
```

並且郵箱 `acejou27@gmail.com` 會收到測試郵件。

## 測試文件清單

以下測試檔案可在測試完成後刪除：

1. `test-invitation.js`
2. `create-test-account.js`
3. `test-with-service-role.js`
4. `test-invitation-direct.js`
5. `src/app/api/test-email/route.ts`
6. `src/app/api/test-email-debug/route.ts`

## 已修改的核心檔案

### 1. `/src/lib/email.ts`
**修改**: Gmail 配置和密碼處理
**行數**: 14, 20-26

### 2. `/.env.local`
**修改**: 恢復密碼原始格式（含空格）
**行數**: 39

## 後續建議

### 安全性
- 應用程式密碼生成後，妥善保管
- 定期更換應用程式密碼
- 不要在程式碼或版本控制中暴露密碼

### 監控
- 建立郵件發送日誌
- 記錄發送成功/失敗統計
- 設定錯誤通知

### 備用方案
如 Gmail 持續有問題，可考慮：
1. 使用第三方郵件服務（SendGrid, Mailgun, AWS SES）
2. 使用 Gmail API（OAuth2 認證）
3. 使用企業郵件服務

## 總結

✅ **已完成**:
- 修復 Nodemailer 配置
- 實作密碼自動處理
- 建立完整測試環境
- 診斷並確認問題根源

⏳ **待用戶操作**:
- 重新生成 Gmail 應用程式密碼
- 更新 `.env.local`
- 重啟伺服器並測試

一旦新的應用程式密碼配置完成，郵件邀請功能應該能正常運作。
