# WordPress REST API 疑難排解指南

## 問題診斷結果

### 檢測到的問題

執行 `./scripts/load-env.sh npx tsx scripts/diagnose-wordpress-api.ts` 後發現：

```
✗ 所有 REST API endpoints 都返回 404 HTML 頁面 (xCloud 登入頁)
✗ WordPress URL: https://app.xcloud.host/site/154886/
```

### 根本原因

**xCloud 代管環境的 URL 結構問題**

1. `https://app.xcloud.host/site/154886/` 是 xCloud 控制面板的 URL
2. 這不是 WordPress 網站的實際網域
3. REST API 無法透過這個 URL 存取

## 解決方案

### 選項 1：使用實際網域（推薦）

如果您的 WordPress 網站有實際網域（例如 `https://example.com`），請使用該網域：

```env
WORDPRESS_URL=https://example.com
```

**如何找到實際網域：**
1. 登入 xCloud 控制面板
2. 找到您的網站（Site ID: 154886）
3. 查看網站的實際網域或臨時網域

### 選項 2：使用 xCloud 臨時網域

xCloud 通常會提供臨時網域，格式可能為：

```env
WORDPRESS_URL=https://154886.xcloud.host
# 或
WORDPRESS_URL=https://site-154886.xcloud.host
```

**檢查方式：**
1. 登入 xCloud 控制面板
2. 進入您的網站設定
3. 尋找「Temporary URL」或「臨時網域」

### 選項 3：在 xCloud 控制面板中設定自訂網域

1. 進入 xCloud 控制面板
2. 選擇您的網站 (154886)
3. 前往「Domain」或「網域設定」
4. 新增您的自訂網域
5. 更新 DNS 設定指向 xCloud
6. 等待 DNS 傳播完成（通常 24-48 小時）

## 驗證步驟

設定正確的 WordPress URL 後，執行以下命令驗證：

```bash
# 1. 診斷 WordPress REST API
./scripts/load-env.sh npx tsx scripts/diagnose-wordpress-api.ts

# 2. 基本發布測試
./scripts/load-env.sh npx tsx scripts/test-wordpress-publish.ts

# 3. 完整工作流測試
./scripts/load-env.sh npx tsx scripts/test-full-workflow-with-wordpress.ts
```

### 預期結果

✅ 診斷輸出應顯示：
```
測試: REST API Root
URL: https://your-domain.com/wp-json
狀態碼: 200 OK
Content-Type: application/json
✓ 成功 - 回傳 JSON 資料
```

## Application Password 設定

一旦 WordPress URL 正確，還需要設定 Application Password：

### 步驟 1：啟用 Application Password

1. 登入 WordPress 後台
2. 前往「使用者」→「個人資料」
3. 滾動到「應用程式密碼」區塊
4. 輸入應用程式名稱（例如：「Auto-pilot-SEO」）
5. 點擊「新增」
6. **複製產生的密碼**（格式：`xxxx xxxx xxxx xxxx`）

### 步驟 2：更新環境變數

將密碼更新到 `.env.local`：

```env
WORDPRESS_URL=https://your-actual-domain.com
WORDPRESS_USERNAME=your-username
WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

**注意：**
- Application Password 可以包含空格
- 不需要移除空格，直接複製貼上即可

## 常見問題

### Q1: 為什麼 xCloud 控制面板 URL 無法使用？

A: `https://app.xcloud.host/site/154886/` 是 xCloud 的控制面板 URL，不是 WordPress 網站本身。WordPress REST API 只能透過實際網站網域存取。

### Q2: 如何確認 WordPress REST API 是否啟用？

A: 在瀏覽器中訪問 `https://your-domain.com/wp-json`，應該會看到 JSON 格式的 API 索引，而不是 HTML 頁面。

### Q3: Application Password 功能找不到？

A: Application Password 需要：
- WordPress 5.6 或更新版本
- 網站必須使用 HTTPS
- 使用者必須有適當權限（管理員或編輯）

如果仍然找不到，可能需要：
1. 更新 WordPress 到最新版本
2. 確認網站使用 SSL 憑證
3. 檢查是否有外掛停用了此功能

### Q4: 認證仍然失敗怎麼辦？

A: 如果 Application Password 無法使用，可以考慮：

1. **JWT 認證**（需要外掛）
   - 安裝 [JWT Authentication for WP REST API](https://wordpress.org/plugins/jwt-authentication-for-wp-rest-api/)
   - 設定 JWT Secret
   - 使用 JWT token 進行認證

2. **OAuth 2.0**（適合生產環境）
   - 安裝 [WP OAuth Server](https://wordpress.org/plugins/oauth2-provider/)
   - 設定 Client ID 和 Secret
   - 實作 OAuth 流程

## 聯絡 xCloud 支援

如果問題仍然存在，請聯絡 xCloud 支援團隊並提供以下資訊：

1. Site ID: 154886
2. 問題描述：無法存取 WordPress REST API
3. 需要確認的資訊：
   - 網站的實際網域或臨時網域
   - REST API 是否被防火牆阻擋
   - Application Password 功能是否可用

## 後續步驟

一旦 WordPress REST API 可正常存取：

1. ✅ 執行診斷腳本確認所有 endpoints 可用
2. ✅ 執行基本測試建立測試文章
3. ✅ 執行完整工作流測試發布實際文章
4. ✅ 檢查 WordPress 後台確認文章正確顯示
5. ✅ 驗證 SEO 元數據、分類、標籤等是否正確

---

**文檔版本：** 1.0
**最後更新：** 2025-01-28
**診斷工具：** `scripts/diagnose-wordpress-api.ts`
