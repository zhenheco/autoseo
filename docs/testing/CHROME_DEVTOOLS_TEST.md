# Chrome DevTools 前端測試指引

## 目標

使用 Chrome DevTools 全面測試 Auto Pilot SEO 應用的前端功能

## 測試 URL

- **HTTP**: http://1wayseo.com （SSL 憑證生成前使用）
- **HTTPS**: https://1wayseo.com （SSL 憑證生成後使用）
- **Vercel 部署 URL**: https://autopilot-fjjovgu1j-acejou27s-projects.vercel.app

## 測試清單

### 1. Console 錯誤檢查

#### 步驟

1. 開啟 Chrome
2. 前往測試 URL
3. 按 `F12` 或 `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows) 開啟 DevTools
4. 切換到 **Console** 標籤

#### 檢查項目

- [ ] 沒有紅色錯誤訊息（Error）
- [ ] 沒有黃色警告訊息（Warning）
- [ ] 所有資源載入成功（無 404 或 500 錯誤）
- [ ] 沒有 CORS 錯誤
- [ ] 沒有未處理的 Promise rejection

#### 常見錯誤

```javascript
// ❌ 需要修正的錯誤範例
// - TypeError: Cannot read property 'X' of undefined
// - ReferenceError: X is not defined
// - Failed to load resource: the server responded with a status of 404
// - CORS policy: No 'Access-Control-Allow-Origin' header
```

### 2. Network 分析

#### 步驟

1. DevTools → **Network** 標籤
2. 勾選 **Preserve log**
3. 重新載入頁面 (Cmd+R / Ctrl+R)

#### 檢查項目

- [ ] 所有請求回應狀態為 200 或 304
- [ ] 沒有失敗的請求（紅色標示）
- [ ] JavaScript 檔案載入成功
- [ ] CSS 檔案載入成功
- [ ] 圖片載入成功
- [ ] API 請求正常回應

#### 效能指標

| 項目             | 目標值 | 實際值     |
| ---------------- | ------ | ---------- |
| DOMContentLoaded | < 2s   | **\_\_\_** |
| Load             | < 5s   | **\_\_\_** |
| 總請求數         | < 50   | **\_\_\_** |
| 總傳輸大小       | < 2MB  | **\_\_\_** |

#### Network 過濾器

```bash
# 檢查特定資源類型
- JS: 勾選 JS
- CSS: 勾選 CSS
- Img: 勾選 Img
- XHR: 勾選 XHR/Fetch (API 請求)
```

### 3. Elements 檢查

#### 步驟

1. DevTools → **Elements** 標籤
2. 使用元素選擇器 (Cmd+Shift+C / Ctrl+Shift+C)
3. 點擊頁面上的元素

#### 檢查項目

- [ ] DOM 結構正確
- [ ] CSS 樣式正確套用
- [ ] 響應式設計正常（使用 Device Toolbar 測試）
- [ ] 沒有被覆蓋的重要樣式
- [ ] 顏色、字型、間距符合設計

#### 響應式測試

```bash
# 在 Device Toolbar (Cmd+Shift+M) 測試以下裝置：
- iPhone SE (375 x 667)
- iPhone 12 Pro (390 x 844)
- iPad (768 x 1024)
- iPad Pro (1024 x 1366)
- Desktop (1920 x 1080)
```

### 4. Application (存儲檢查)

#### 步驟

1. DevTools → **Application** 標籤

#### 檢查項目

##### Local Storage

- [ ] 查看 Application → Local Storage → http://1wayseo.com
- [ ] 檢查儲存的資料格式正確
- [ ] 測試清除後重新登入

##### Session Storage

- [ ] 查看 Application → Session Storage
- [ ] 檢查會話資料

##### Cookies

- [ ] 查看 Application → Cookies
- [ ] 檢查認證 cookie 是否正確設定
- [ ] 檢查 HttpOnly, Secure, SameSite 屬性

```javascript
// 預期的 Cookies
// Name: next-auth.session-token (或類似)
// HttpOnly: true
// Secure: true (HTTPS 後)
// SameSite: Lax
```

### 5. 功能測試

#### 登入功能

1. 前往登入頁面
2. 開啟 Console
3. 輸入帳號密碼並登入
4. 檢查：
   - [ ] 沒有 Console 錯誤
   - [ ] Network 顯示 API 請求成功
   - [ ] 成功重定向到 Dashboard
   - [ ] Cookie/LocalStorage 正確設定

#### Dashboard 頁面

1. 登入後進入 Dashboard
2. 檢查：
   - [ ] 資料正確顯示
   - [ ] 沒有 Console 錯誤
   - [ ] API 請求成功
   - [ ] 圖表/視覺化元件正常運作

#### 文章管理

1. 前往文章列表頁面
2. 檢查：
   - [ ] 文章列表載入成功
   - [ ] 分頁功能正常
   - [ ] 搜尋功能正常
   - [ ] 新增/編輯/刪除功能正常

#### 付款功能

1. 前往付款頁面
2. 檢查：
   - [ ] NewebPay 表單正確載入
   - [ ] 價格計算正確
   - [ ] Console 沒有錯誤

### 6. Performance 分析

#### 步驟

1. DevTools → **Performance** 標籤
2. 點擊 Record 按鈕
3. 執行操作（如載入頁面、點擊按鈕）
4. 停止錄製

#### 檢查項目

- [ ] FCP (First Contentful Paint) < 1.8s
- [ ] LCP (Largest Contentful Paint) < 2.5s
- [ ] TTI (Time to Interactive) < 3.8s
- [ ] TBT (Total Blocking Time) < 200ms
- [ ] CLS (Cumulative Layout Shift) < 0.1

### 7. Lighthouse 審核

#### 步驟

1. DevTools → **Lighthouse** 標籤
2. 選擇模式：Navigation (預設)
3. 選擇類別：
   - [x] Performance
   - [x] Accessibility
   - [x] Best Practices
   - [x] SEO
4. 點擊 **Analyze page load**

#### 目標分數

| 類別           | 目標 | 實際   |
| -------------- | ---- | ------ |
| Performance    | > 90 | **\_** |
| Accessibility  | > 90 | **\_** |
| Best Practices | > 90 | **\_** |
| SEO            | > 90 | **\_** |

### 8. 常見問題排查

#### 白屏問題

```javascript
// 檢查 Console 是否有以下錯誤：
// 1. JavaScript 載入失敗
// 2. React hydration 錯誤
// 3. API 請求失敗導致渲染中斷

// 解決方式：
// - 檢查 Network 標籤，確認所有資源載入成功
// - 檢查環境變數是否正確設定
// - 檢查 API endpoints 是否正常運作
```

#### 樣式問題

```javascript
// 檢查 Elements → Styles 面板
// 1. CSS 檔案是否載入
// 2. 樣式是否被覆蓋（strikethrough）
// 3. Tailwind CSS 是否正確編譯

// 解決方式：
// - 檢查 CSS 檔案路徑
// - 檢查 Tailwind 配置
// - 清除瀏覽器快取
```

#### API 請求失敗

```javascript
// 檢查 Network → XHR/Fetch
// 1. 請求 URL 是否正確
// 2. 回應狀態碼
// 3. Request Headers（特別是 Authorization）
// 4. Response Body

// 解決方式：
// - 檢查環境變數（API URL, API Key）
// - 檢查 CORS 設定
// - 檢查認證 token
```

## 自動化測試命令

### 使用 curl 測試 API

```bash
# 測試首頁
curl -I http://1wayseo.com

# 測試 API endpoint
curl http://1wayseo.com/api/ai-models

# 測試登入 API（需要實際資料）
curl -X POST http://1wayseo.com/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### 使用 Chrome 無頭模式

```bash
# 擷取 Console 日誌
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless \
  --disable-gpu \
  --dump-dom \
  http://1wayseo.com > page.html

# 擷取截圖
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless \
  --disable-gpu \
  --screenshot \
  --window-size=1920,1080 \
  http://1wayseo.com
```

## 測試報告範本

### 測試結果摘要

**測試日期**: \***\*\_\_\_\_\*\***
**測試者**: \***\*\_\_\_\_\*\***
**測試 URL**: http://1wayseo.com

| 測試項目         | 狀態       | 備註 |
| ---------------- | ---------- | ---- |
| Console 無錯誤   | ⬜ ✅ / ❌ |      |
| Network 請求成功 | ⬜ ✅ / ❌ |      |
| 響應式設計       | ⬜ ✅ / ❌ |      |
| 登入功能         | ⬜ ✅ / ❌ |      |
| Dashboard        | ⬜ ✅ / ❌ |      |
| 文章管理         | ⬜ ✅ / ❌ |      |
| 付款功能         | ⬜ ✅ / ❌ |      |
| Performance      | ⬜ ✅ / ❌ |      |
| Lighthouse 分數  | ⬜ ✅ / ❌ |      |

### 發現的問題

1. **問題描述**: \***\*\_\_\*\***
   - **嚴重程度**: 🔴 高 / 🟡 中 / 🟢 低
   - **重現步驟**: \***\*\_\_\*\***
   - **預期行為**: \***\*\_\_\*\***
   - **實際行為**: \***\*\_\_\*\***
   - **錯誤訊息**: \***\*\_\_\*\***

### 建議修正

1. ***
2. ***
3. ***

---

**完成測試後，請將結果記錄在此文件或 ISSUELOG.md 中**
