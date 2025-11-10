# Email 發送錯誤疑難排解

## 錯誤訊息
```
error sending confirmation email
```

## 問題原因

此錯誤通常發生在 Supabase 無法發送驗證郵件時，可能的原因包括：

1. **Supabase Email 服務未啟用**
2. **Email Template 配置錯誤**
3. **Email Provider 設定問題**
4. **Rate Limit 限制**（免費方案每小時 3-4 封）

---

## 解決方案

### 步驟 1: 檢查 Email Authentication 是否啟用

1. 前往 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇您的專案
3. 導航至 **Authentication** → **Providers**
4. 確認 **Email** provider 已啟用（開關為綠色）

**設定項目：**
- ✅ Enable Email provider
- ✅ Confirm email（必須啟用才會發送驗證信）
- ⚠️ Secure email change（選用）

### 步驟 2: 檢查 Email Template

1. 前往 **Authentication** → **Email Templates**
2. 選擇 **Confirm signup** 範本
3. 確認 template 包含以下內容：

```html
<h2>確認您的信箱</h2>
<p>感謝您註冊我們的服務！</p>
<p>請點擊下方連結完成信箱驗證：</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">
    確認信箱
  </a>
</p>
<p>如果您沒有註冊此帳號，請忽略此信件。</p>
<p>此連結將在 5 分鐘後失效。</p>
```

**重要**：
- 必須使用 `{{ .SiteURL }}/auth/confirm`
- 必須包含 `token_hash={{ .TokenHash }}&type=email` 參數

### 步驟 3: 設定 Site URL

1. 前往 **Settings** → **API**
2. 找到 **Site URL** 設定
3. 設定為您的應用 URL：

```
生產環境: https://seo.zhenhe-dm.com
開發環境: http://localhost:3168
```

4. 設定 **Redirect URLs**（允許的重定向 URL）：

```
https://seo.zhenhe-dm.com/**
http://localhost:3168/**
```

### 步驟 4: 檢查 SMTP 設定（建議用於生產環境）

免費方案使用 Supabase 內建 SMTP，有以下限制：
- 每小時 3-4 封郵件
- 可能被標記為垃圾郵件

**建議配置自訂 SMTP**（生產環境）：

1. 前往 **Settings** → **Auth** → **SMTP Settings**
2. 配置您的 SMTP provider（Gmail, SendGrid, AWS SES 等）

**Gmail 範例**：
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP User: your-email@gmail.com
SMTP Password: your-app-password (不是帳號密碼)
SMTP Sender Name: Auto-pilot-SEO
SMTP Sender Email: your-email@gmail.com
```

**⚠️ Gmail 注意事項**：
- 必須啟用「兩步驟驗證」
- 使用「應用程式密碼」而非帳號密碼
- 產生應用程式密碼：https://myaccount.google.com/apppasswords

### 步驟 5: 測試 Email 發送

#### 方法 1: 使用 Supabase Dashboard
1. 前往 **Authentication** → **Users**
2. 點擊 **Send Magic Link** 測試
3. 檢查是否收到郵件

#### 方法 2: 使用測試 API
```bash
curl -X POST 'https://vdjzeregvyimgzflfalv.supabase.co/auth/v1/signup' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456"
  }'
```

### 步驟 6: 檢查 Rate Limit

如果短時間內註冊多個帳號，可能觸發 rate limit：

**解決方案：**
1. 等待 1 小時後再試
2. 升級至付費方案（無 rate limit）
3. 配置自訂 SMTP（繞過 Supabase 限制）

### 步驟 7: 檢查垃圾郵件

驗證信可能被過濾到垃圾郵件：

1. 檢查垃圾郵件資料夾
2. 將 `noreply@mail.app.supabase.io` 加入白名單
3. 考慮使用自訂 SMTP 提高送達率

---

## 開發環境測試

如果只是開發測試，可以暫時停用 email 驗證：

### 臨時停用 Email 驗證

1. 前往 **Authentication** → **Providers** → **Email**
2. 關閉 **Confirm email** 選項
3. 使用者註冊後自動啟用（無需驗證）

**⚠️ 警告**：
- 僅用於開發環境
- 生產環境必須啟用 email 驗證
- 記得重新啟用

### 使用測試帳號

1. 使用可接收信件的測試信箱（如 Gmail, Outlook）
2. 避免使用臨時信箱（可能被 Supabase 阻擋）

---

## 常見錯誤和解決方案

### 錯誤 1: "Email rate limit exceeded"
**原因**: 超過免費方案限制（每小時 3-4 封）

**解決**:
- 等待 1 小時
- 升級方案
- 配置自訂 SMTP

### 錯誤 2: "Invalid email domain"
**原因**: 使用了被阻擋的臨時信箱

**解決**:
- 使用正規信箱（Gmail, Outlook, 企業信箱）
- 檢查 Supabase Dashboard 的 email 白名單設定

### 錯誤 3: "SMTP connection failed"
**原因**: 自訂 SMTP 配置錯誤

**解決**:
- 檢查 SMTP host、port、username、password
- 確認 SMTP provider 允許 third-party 應用
- Gmail 需要「應用程式密碼」

### 錯誤 4: 收不到驗證信
**可能原因**:
1. 在垃圾郵件資料夾
2. Email template 配置錯誤
3. Site URL 設定錯誤
4. Rate limit

**解決步驟**:
1. 檢查垃圾郵件
2. 驗證 email template
3. 確認 Site URL 正確
4. 等待並重試
5. 使用「重發驗證信」功能

---

## 驗證清單

部署前請確認：

- [ ] ✅ Email provider 已啟用
- [ ] ✅ Confirm email 已開啟
- [ ] ✅ Email template 已正確配置（使用 `/auth/confirm`）
- [ ] ✅ Site URL 已設定（`https://seo.zhenhe-dm.com`）
- [ ] ✅ Redirect URLs 已設定
- [ ] ✅ 生產環境已配置自訂 SMTP（建議）
- [ ] ✅ 測試帳號可正常收到驗證信
- [ ] ✅ 驗證連結可正常運作（無 404 錯誤）

---

## 進階設定

### 配置 SendGrid SMTP

```
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP User: apikey
SMTP Password: YOUR_SENDGRID_API_KEY
```

### 配置 AWS SES SMTP

```
SMTP Host: email-smtp.us-east-1.amazonaws.com
SMTP Port: 587
SMTP User: YOUR_IAM_ACCESS_KEY
SMTP Password: YOUR_IAM_SECRET_KEY
```

### 配置 Mailgun SMTP

```
SMTP Host: smtp.mailgun.org
SMTP Port: 587
SMTP User: postmaster@yourdomain.com
SMTP Password: YOUR_MAILGUN_PASSWORD
```

---

## 監控和日誌

### 查看 Supabase Logs

1. 前往 **Logs** → **Auth Logs**
2. 篩選 `signup` 事件
3. 檢查錯誤訊息

### 查看應用日誌

```bash
# 本地開發
npm run dev

# 查看 console.log 輸出
# 應該會看到 [Signup] 相關日誌
```

### 使用 Chrome DevTools

1. 開啟 DevTools (F12)
2. 切換至 **Network** 標籤
3. 提交註冊表單
4. 檢查 `/signup` 和相關 API 請求
5. 查看 Response 中的錯誤訊息

---

## 聯絡支援

如果以上步驟都無法解決問題：

1. 前往 [Supabase Discord](https://discord.supabase.com/)
2. 前往 [Supabase GitHub Issues](https://github.com/supabase/supabase/issues)
3. 提供以下資訊：
   - 錯誤訊息截圖
   - Auth Logs 截圖
   - Email template 配置
   - Site URL 設定

---

**最後更新**: 2025-01-11
**適用專案**: Auto-pilot-SEO
**Supabase 版本**: Latest
