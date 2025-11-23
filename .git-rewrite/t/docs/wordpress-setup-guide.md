# WordPress Application Password 設定指南

## 當前狀態

✅ **WordPress URL 已確認**: `https://x-marks.com`
✅ **REST API 可用**: WordPress REST API 正常運作
❌ **認證失敗**: Application Password 無效或已過期

## 錯誤訊息

```
錯誤: 401 Unauthorized
訊息: "目前使用的密碼是無效的應用程式密碼"
```

## 解決步驟

### 步驟 1: 登入 WordPress 後台

前往：https://x-marks.com/wp-admin

使用您的 WordPress 帳號密碼登入。

### 步驟 2: 前往使用者設定

1. 點擊左側選單的「使用者」
2. 選擇「個人資料」
3. 滾動到頁面底部找到「應用程式密碼」區塊

### 步驟 3: 產生新的 Application Password

在「應用程式密碼」區塊中：

1. **應用程式名稱欄位**：輸入 `Auto-pilot-SEO`
2. **點擊「新增」按鈕**
3. **複製顯示的密碼**：格式為 `xxxx xxxx xxxx xxxx`（包含空格）

**重要提示：**

- 這個密碼只會顯示一次
- 立即複製並儲存
- 如果忘記，需要重新產生

### 步驟 4: 更新環境變數

開啟 `.env.local` 檔案，更新以下內容：

```env
# WordPress 整合
WORDPRESS_URL=https://x-marks.com
WORDPRESS_USERNAME=your-username
WORDPRESS_APP_PASSWORD=your-new-app-password-here
```

**範例：**

```env
WORDPRESS_URL=https://x-marks.com
WORDPRESS_USERNAME=admin
WORDPRESS_APP_PASSWORD=RbWb 4N63 9Uxn 65kI Fskl O1gU
```

**注意：**

- 密碼可以包含空格，也可以移除空格
- 兩種格式都可以：`xxxx xxxx xxxx xxxx` 或 `xxxxxxxxxxxxxxxx`
- 使用者名稱通常是您的 WordPress 登入帳號

### 步驟 5: 驗證設定

執行測試腳本驗證設定是否正確：

```bash
./scripts/load-env.sh npx tsx scripts/test-wordpress-xmarks.ts
```

**預期結果：**

```
=== 測試 x-marks.com WordPress REST API ===

步驟 1/5: 測試認證...
✓ 成功獲取 X 個分類
✓ 成功獲取 Y 個標籤

步驟 2/5: 確保測試分類和標籤存在...
✓ 分類 IDs: 1, 2
✓ 標籤 IDs: 3, 4, 5

步驟 3/5: 建立測試文章 (草稿)...
✓ 測試文章建立成功！
  文章 ID: 123
  文章連結: https://x-marks.com/?p=123

步驟 4/5: 測試文章更新...
✓ 文章更新成功！

步驟 5/5: 測試 Yoast SEO 元數據...
✓ Yoast SEO 元數據設定成功！

=== 測試完成 ===
✅ 所有測試都成功通過！
```

## 常見問題

### Q1: 找不到「應用程式密碼」區塊？

**可能原因：**

1. WordPress 版本過舊（需要 5.6+）
2. 網站未使用 HTTPS
3. 使用者權限不足

**解決方案：**

- 更新 WordPress 到最新版本
- 確認網站使用 SSL 憑證 (https://)
- 確認您的帳號是「管理員」角色

### Q2: Application Password 立即失效？

**可能原因：**

- 安全性外掛封鎖了 REST API
- 伺服器設定限制了 REST API
- Cloudflare 或 WAF 阻擋請求

**解決方案：**

1. 暫時停用安全性外掛測試
2. 檢查 Cloudflare Security Level（如果使用）
3. 聯絡主機商確認 REST API 是否被限制

### Q3: 仍然收到 401 錯誤？

**檢查步驟：**

1. **確認使用者名稱正確**

   ```bash
   # 在 WordPress 後台確認
   # 「使用者」→「個人資料」→「使用者名稱」欄位
   ```

2. **重新產生密碼**
   - 刪除舊的 Application Password
   - 產生新的密碼
   - 立即複製並測試

3. **測試基本認證**

   ```bash
   curl -I "https://x-marks.com/wp-json/wp/v2/users/me" \
     -H "Authorization: Basic $(echo -n 'username:password' | base64)"
   ```

4. **確認密碼格式**

   ```env
   # ✓ 正確
   WORDPRESS_APP_PASSWORD=RbWb 4N63 9Uxn 65kI

   # ✓ 也正確
   WORDPRESS_APP_PASSWORD=RbWb4N639Uxn65kI

   # ✗ 錯誤（有引號）
   WORDPRESS_APP_PASSWORD="RbWb 4N63 9Uxn 65kI"
   ```

## 安全性最佳實踐

1. **定期更換密碼**
   - 每 90 天更換一次 Application Password
   - 產生新密碼後刪除舊密碼

2. **使用描述性名稱**
   - 使用清楚的應用程式名稱（例如：`Auto-pilot-SEO-Production`）
   - 方便追蹤哪個密碼用於哪個用途

3. **限制權限**
   - 考慮建立專門用於 API 的使用者
   - 只給予必要的權限（編輯者或作者）

4. **監控使用**
   - 定期檢查 Application Passwords 列表
   - 刪除不再使用的密碼

## 後續步驟

設定完成並測試通過後：

1. ✅ 執行完整工作流測試

   ```bash
   ./scripts/load-env.sh npx tsx scripts/test-full-workflow-with-wordpress.ts
   ```

2. ✅ 檢查 WordPress 後台
   - 前往「文章」查看測試文章
   - 確認 HTML 格式正確
   - 確認 SEO 元數據正確
   - 確認分類和標籤正確

3. ✅ 開始生產使用
   - 配置 `website_configs` 表
   - 設定自動發布選項
   - 監控發布結果

---

**文檔版本：** 1.0
**最後更新：** 2025-01-28
**WordPress URL：** https://x-marks.com
**測試腳本：** `scripts/test-wordpress-xmarks.ts`
