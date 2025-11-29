# Email Verification 測試步驟

## 問題診斷

您看到的 "404" 可能是以下情況之一：

### 情況 1: Token 已過期

- Token 有效期：**5 分鐘**
- 症狀：重定向到 `/zh/login?error=verification_failed`
- 解決：重新註冊或使用「重發驗證信」

### 情況 2: Token 已被使用

- Token 只能使用**一次**
- 症狀：重定向到 `/zh/login?error=verification_failed`
- 解決：使用「重發驗證信」功能

### 情況 3: 瀏覽器快取問題

- 症狀：顯示舊的 404 頁面
- 解決：清除快取或使用無痕模式

---

## 完整測試流程

### Step 1: 清除舊資料

```bash
# 清除瀏覽器快取
Cmd+Shift+Delete (Mac) / Ctrl+Shift+Delete (Windows)

# 或使用無痕模式
Cmd+Shift+N (Mac) / Ctrl+Shift+N (Windows)
```

### Step 2: 註冊新帳號

1. 前往 https://1wayseo.com/zh/signup
2. 輸入**全新的** email（未使用過的）
3. 輸入密碼並確認
4. 提交註冊

### Step 3: 檢查驗證信

1. 登入您的信箱
2. 找到來自 Supabase 的驗證信
3. **檢查連結格式**：
   ```
   https://1wayseo.com/auth/confirm?token_hash=pkce_xxx&type=email
   ```
4. 確認路徑是 `/auth/confirm`（不是 `/auth/callback`）

### Step 4: 使用 Chrome DevTools 監控

1. 開啟 Chrome DevTools (F12)
2. 切換到 **Network** 標籤
3. 勾選 **Preserve log**
4. 點擊驗證連結
5. 觀察網路請求

### Step 5: 檢查結果

**成功的情況**：

```
Request: GET /auth/confirm?token_hash=xxx&type=email
Status: 307 Temporary Redirect
Location: /zh/dashboard
```

→ 應該自動登入並重定向到 dashboard

**Token 過期的情況**：

```
Request: GET /auth/confirm?token_hash=xxx&type=email
Status: 307 Temporary Redirect
Location: /zh/login?error=verification_failed&error_description=Email+link+is+invalid+or+has+expired
```

→ 重定向到登入頁並顯示錯誤訊息

**真正的 404（不應該發生）**：

```
Request: GET /auth/confirm
Status: 404 Not Found
```

→ 如果看到這個，表示路由確實沒部署

---

## 使用 curl 測試

如果不確定，可以用 curl 測試：

```bash
# 測試 1: 檢查路由是否存在
curl -I "https://1wayseo.com/auth/confirm?token_hash=test&type=email"

# 預期結果：HTTP/2 307（表示路由存在）
# 如果是 404，表示路由未部署

# 測試 2: 測試實際 token
curl -I "https://1wayseo.com/auth/confirm?token_hash=YOUR_TOKEN&type=email"

# 預期結果：
# - 有效 token: 307 → /zh/dashboard
# - 無效/過期 token: 307 → /zh/login?error=verification_failed
```

---

## 常見問題

### Q1: 我看到 "Email link is invalid or has expired"

**A**: 這是正常的！表示：

- Token 已過期（超過 5 分鐘）
- Token 已被使用
- Token 格式錯誤

**解決方案**：

1. 前往登入頁
2. 輸入您的 email
3. 點擊「重新發送驗證信」（如果有此選項）
4. 或重新註冊（使用不同 email）

### Q2: 重發驗證信在哪裡？

**A**: 目前在以下位置：

- `/zh/login` 頁面（如果顯示「未驗證」錯誤）
- `/zh/signup` 頁面（如果顯示「未驗證」錯誤）

### Q3: 為什麼我的 token 這麼快就過期？

**A**: Supabase 的設計：

- Email verification token 有效期：**5 分鐘**
- Magic link token 有效期：**5 分鐘**
- Password reset token 有效期：**5 分鐘**

這是安全考量，防止 token 被濫用。

### Q4: 我能延長 token 有效期嗎？

**A**: 不行，這是 Supabase 的固定設定，無法修改。

建議：

- 收到驗證信後立即點擊
- 如果超時，使用「重發驗證信」
- 開發時考慮暫時停用 email 驗證

---

## 檢查清單

測試前請確認：

- [ ] 使用**全新的** email（未註冊過）
- [ ] 清除瀏覽器快取或使用無痕模式
- [ ] 開啟 Chrome DevTools Network 標籤
- [ ] 驗證信中的連結是 `/auth/confirm`（不是 `/auth/callback`）
- [ ] 在 **5 分鐘內**點擊驗證連結
- [ ] 檢查 Network 標籤中的實際 HTTP 狀態碼

---

## 成功指標

如果以下都成立，表示功能正常：

✅ 註冊後收到驗證信
✅ 驗證信連結格式為 `/auth/confirm?token_hash=xxx&type=email`
✅ 點擊連結後 Network 顯示 `307` (不是 `404`)
✅ 如果 token 有效：自動登入並重定向到 dashboard
✅ 如果 token 無效：顯示錯誤訊息並提供「重發驗證信」選項

---

## 如果真的是 404

如果確認是真的 404（Network 顯示 `404 Not Found`），請執行：

```bash
# 1. 確認檔案存在
ls src/app/auth/confirm/route.ts

# 2. 重新建置
npm run build

# 3. 檢查 build 輸出
npm run build 2>&1 | grep "auth/confirm"

# 4. 重新部署
git add -A
git commit -m "fix: 確保 auth/confirm 路由正確部署"
git push origin main

# 5. 等待部署完成
sleep 90

# 6. 測試
curl -I "https://1wayseo.com/auth/confirm?token_hash=test&type=email"
```

---

**最後更新**: 2025-01-11
**目前狀態**: `/auth/confirm` 路由已部署並正常運作（測試確認返回 307）
