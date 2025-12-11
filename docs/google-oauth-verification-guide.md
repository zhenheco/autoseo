# Google OAuth 驗證申請指南

此文件為 1waySEO 平台申請 Google OAuth 驗證的完整指南。

---

## 一、應用程式基本資訊

| 項目               | 值                                            |
| ------------------ | --------------------------------------------- |
| **應用程式名稱**   | 1waySEO                                       |
| **應用程式首頁**   | https://1wayseo.com                           |
| **隱私權政策 URL** | https://1wayseo.com/privacy                   |
| **服務條款 URL**   | https://1wayseo.com/terms                     |
| **授權回調 URI**   | https://1wayseo.com/api/google/oauth/callback |
| **支援電郵**       | service@1wayseo.com                           |

---

## 二、申請的 OAuth Scope

### 2.1 Scope 清單

| Scope                                                 | 敏感等級         | 用途                                |
| ----------------------------------------------------- | ---------------- | ----------------------------------- |
| `https://www.googleapis.com/auth/webmasters.readonly` | Sensitive (敏感) | 讀取用戶 Google Search Console 數據 |

### 2.2 為什麼需要 `webmasters.readonly` scope

**申請理由（可直接複製到驗證表單）：**

```
1waySEO is an AI-powered SEO content platform that helps website owners create optimized articles and monitor their search performance.

We request the webmasters.readonly scope for the following purposes:

1. **Display Search Performance Metrics**: Our platform displays the user's website search performance data (clicks, impressions, CTR, average position) in a dashboard, allowing users to monitor their SEO progress without leaving our platform.

2. **Keyword Analysis**: We show users which search queries are driving traffic to their website, helping them understand what content performs well and identify opportunities for new content.

3. **SEO Content Optimization**: By analyzing search performance data, we provide data-driven recommendations for improving existing content and planning new articles.

4. **Read-Only Access**: We only request read-only access. We do not modify, delete, or write any data to the user's Search Console account.

5. **User-Initiated Authorization**: Users explicitly choose to connect their Search Console by clicking a "Connect Search Console" button in their dashboard. The connection is entirely optional and not required to use our core service.

6. **Easy Revocation**: Users can disconnect their Search Console at any time from their dashboard or from Google Account permissions page.

This integration is essential for our users to have a unified view of their content performance and make informed decisions about their SEO strategy.
```

---

## 三、數據使用說明

### 3.1 我們如何使用這些數據

1. **儀表板展示**：在用戶的網站詳情頁面顯示以下指標
   - 總點擊次數 (Clicks)
   - 總曝光次數 (Impressions)
   - 平均點擊率 (CTR)
   - 平均排名位置 (Position)

2. **關鍵字分析**：顯示為網站帶來流量的搜尋關鍵字列表

3. **趨勢追蹤**：提供過去 28 天的效能變化圖表

### 3.2 數據儲存政策

- OAuth Token 以 AES-256-GCM 加密儲存
- 搜尋效能數據快取最多 6 小時
- 用戶撤銷授權時，所有相關數據立即刪除

### 3.3 我們不會做的事

- ❌ 不會將數據轉售給第三方
- ❌ 不會用於廣告投放
- ❌ 不會修改用戶的 Search Console 設定
- ❌ 不會在未經同意下分享用戶數據

---

## 四、示範影片腳本

**用途**：Google 驗證需要提供一段展示如何使用 scope 的影片（上傳到 YouTube 設為不公開）

### 影片建議長度：2-3 分鐘

### 影片腳本：

```
[開場 - 10秒]
「大家好，這是 1waySEO 平台的 Google Search Console 整合功能示範。」

[場景 1 - 登入平台 - 15秒]
1. 開啟瀏覽器前往 https://1wayseo.com
2. 登入帳號

[場景 2 - 進入網站詳情頁 - 15秒]
1. 點擊左側選單「網站管理」
2. 選擇一個網站進入詳情頁

[場景 3 - 連接 Search Console - 30秒]
1. 滾動到「Search Console」區塊
2. 點擊「連接 Search Console」按鈕
3. 畫面跳轉到 Google 授權頁面
4. 選擇 Google 帳號
5. 查看請求的權限（webmasters.readonly）
6. 點擊「允許」

[場景 4 - 查看數據 - 45秒]
1. 授權成功後，自動跳回 1waySEO
2. 展示儀表板上的 GSC 數據：
   - 點擊次數
   - 曝光次數
   - 點擊率 (CTR)
   - 平均排名
3. 展示關鍵字列表（如果有數據）
4. 強調：「這些數據是從用戶的 Google Search Console 讀取的，
   我們只有讀取權限，不會修改任何設定。」

[場景 5 - 撤銷授權 - 20秒]
1. 點擊「斷開連接」按鈕
2. 確認斷開
3. 說明：「用戶可以隨時撤銷授權」

[結尾 - 15秒]
「以上就是 1waySEO 如何使用 Google Search Console API。
我們只讀取數據用於展示，不會修改用戶帳號設定。謝謝觀看！」
```

### 影片上傳設定：

- **標題**：1waySEO - Google Search Console Integration Demo
- **隱私設定**：不公開 (Unlisted)
- **語言**：英文描述 + 可選中文語音

---

## 五、驗證申請步驟

### 步驟 1：進入 Google Cloud Console

1. 前往 https://console.cloud.google.com/
2. 選擇你的專案

### 步驟 2：進入 Google Auth Platform

1. 點擊左上角 `☰` 漢堡選單
2. 選擇 `Google Auth platform`（或 `APIs & Services` → `OAuth consent screen`）

### 步驟 3：填寫 Branding 資訊

1. 應用程式名稱：`1waySEO`
2. 使用者支援電子郵件：`service@1wayseo.com`
3. 應用程式首頁：`https://1wayseo.com`
4. 應用程式隱私權政策連結：`https://1wayseo.com/privacy`
5. 應用程式服務條款連結：`https://1wayseo.com/terms`
6. 授權網域：`1wayseo.com`

### 步驟 4：設定 Data Access（Scopes）

1. 進入 `Data Access` 頁面
2. 點擊 `Add or remove scopes`
3. 搜尋 `webmasters`
4. 勾選 `https://www.googleapis.com/auth/webmasters.readonly`
5. 儲存

### 步驟 5：提交驗證申請

1. 回到 `Audience` 頁面
2. 點擊 `Publish app` 或 `Submit for verification`
3. 填寫驗證表單：
   - **為什麼需要這些 scope**：複製上方「2.2 為什麼需要 webmasters.readonly scope」的內容
   - **示範影片連結**：貼上 YouTube 不公開影片連結
4. 提交申請

### 步驟 6：等待審核

- 敏感 scope 驗證通常需要 3-5 個工作天
- Google 可能會要求補充資料或修改
- 審核通過後會收到電子郵件通知

---

## 六、常見問題

### Q1：為什麼選擇 External 而不是 Internal？

Internal 僅限 Google Workspace 組織內部成員使用。1waySEO 是面向公眾的 SaaS 服務，所以必須選擇 External。

### Q2：驗證需要多久？

敏感 scope（如 webmasters.readonly）通常需要 3-5 個工作天。如果 Google 有疑問會延長。

### Q3：驗證期間用戶能使用嗎？

驗證期間，只有在 Audience → Test users 中添加的用戶（最多 100 人）可以使用。

### Q4：驗證失敗怎麼辦？

Google 會告知具體原因。常見問題：

- 隱私權政策不完整 → 補充內容
- 示範影片不清楚 → 重新錄製
- 申請理由不充分 → 補充說明

---

## 七、聯絡資訊

如有驗證相關問題，請聯絡：

- **技術支援**：service@1wayseo.com
- **Google Support**：https://support.google.com/cloud/contact/cloud_platform

---

_最後更新：2025-12-11_
