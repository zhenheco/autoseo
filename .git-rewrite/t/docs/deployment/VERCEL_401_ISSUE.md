# Vercel 部署保護 (HTTP 401) 問題

## 問題

所有對 Vercel 部署 URL 的請求都返回 HTTP 401 Unauthorized

## 原因

Vercel 啟用了 **Deployment Protection (部署保護)** 功能，這是一個安全功能，防止未授權訪問預覽部署。

## 影響

- ✅ 自訂域名 `seo.zhenhe-dm.com` 不受影響（DNS 傳播後可正常訪問）
- ❌ Vercel 預設 URL `autopilot-fjjovgu1j-acejou27s-projects.vercel.app` 需要認證

## 解決方案

### 選項 1: 等待 DNS 傳播並使用自訂域名（推薦）

由於自訂域名不受部署保護影響，最簡單的方法是等待 DNS 完全傳播，然後使用 `seo.zhenhe-dm.com` 進行測試。

**步驟**：

1. 等待 5-30 分鐘讓 DNS 傳播
2. 測試 `http://seo.zhenhe-dm.com`（HTTP 現在可用）
3. 等待 SSL 憑證生成後測試 `https://seo.zhenhe-dm.com`

**驗證**：

```bash
# 檢查 DNS 是否傳播完成
nslookup seo.zhenhe-dm.com

# 測試訪問
curl -I http://seo.zhenhe-dm.com
```

### 選項 2: 在 Vercel Dashboard 關閉部署保護

如果需要立即測試 Vercel 預設 URL，可以關閉部署保護：

**步驟**：

1. 前往 [Vercel Dashboard](https://vercel.com/acejou27s-projects/autopilot-seo)
2. 點擊 **Settings** → **Deployment Protection**
3. 關閉 **Password Protection** 或 **Vercel Authentication**
4. 儲存設定
5. 重新部署（可選）

**注意**：關閉保護後，任何人都可以訪問預覽 URL

### 選項 3: 使用 Vercel 認證 Token

如果需要保持部署保護並透過 API 測試：

```bash
# 獲取 Vercel Token
# 前往 https://vercel.com/account/tokens 建立 Token

# 使用 Token 訪問
curl -H "Authorization: Bearer YOUR_VERCEL_TOKEN" \
  https://autopilot-fjjovgu1j-acejou27s-projects.vercel.app
```

## 當前狀態

### ✅ 正常運作

- DNS 配置：完成
- 自訂域名設定：完成
- HTTP 訪問（使用 IP）：測試成功（之前用 `--resolve` 強制 IP）

### ⏳ 待確認

- DNS 本地傳播：可能需要更多時間
- SSL 憑證：正在生成中
- 完整功能測試：等待 DNS 完全傳播後進行

## 測試策略

### 短期（現在）

1. 使用本地 `/etc/hosts` 強制 DNS 解析（Mac/Linux）
2. 等待 DNS 自然傳播（5-30 分鐘）
3. 使用瀏覽器直接測試（可手動接受 DNS 警告）

### 中期（DNS 傳播後）

1. 測試 HTTP 訪問：`http://seo.zhenhe-dm.com`
2. 等待 SSL 憑證生成
3. 測試 HTTPS 訪問：`https://seo.zhenhe-dm.com`
4. 執行完整前端測試

### 長期（生產環境）

1. 啟用 Vercel 部署保護（僅生產域名可公開訪問）
2. 配置自動化測試使用 Vercel API Token
3. 設定監控和告警

## 手動測試（無需等待 DNS）

### 使用瀏覽器直接測試

1. 在 Chrome 開啟 `http://76.76.21.61`（Vercel IP）
2. 或編輯 `/etc/hosts`：

   ```bash
   sudo nano /etc/hosts

   # 加入以下行
   76.76.21.61 seo.zhenhe-dm.com

   # 儲存並測試
   curl -I http://seo.zhenhe-dm.com
   ```

3. 測試完成後記得移除 `/etc/hosts` 的修改

## Chrome DevTools 測試指引

由於 Vercel 部署 URL 受保護，建議使用以下方式進行 Chrome DevTools 測試：

### 方法 1: 使用自訂域名（推薦）

```bash
# 等待 DNS 傳播後
# 開啟 Chrome → http://seo.zhenhe-dm.com
# 按 F12 開啟 DevTools
# 檢查 Console、Network、Elements
```

### 方法 2: 使用本地 hosts 檔案

```bash
# 編輯 /etc/hosts
sudo nano /etc/hosts

# 加入
76.76.21.61 seo.zhenhe-dm.com

# 測試
ping seo.zhenhe-dm.com

# 開啟瀏覽器測試
# 完成後移除此行
```

### 方法 3: 在 Vercel Dashboard 關閉保護（臨時）

1. Settings → Deployment Protection → 關閉
2. 測試完成後重新啟用

## 建議

**立即執行**：

- ✅ 等待 DNS 自然傳播（5-30 分鐘）
- ✅ 使用 `http://seo.zhenhe-dm.com` 測試（DNS 傳播後）
- ✅ 在 Vercel Dashboard 檢查 SSL 憑證狀態

**避免**：

- ❌ 不要在生產環境關閉部署保護
- ❌ 不要在公共網路使用未加密的 HTTP

## 相關連結

- [Vercel Dashboard](https://vercel.com/acejou27s-projects/autopilot-seo)
- [Deployment Protection 文件](https://vercel.com/docs/security/deployment-protection)
- [自訂域名設定](https://vercel.com/docs/projects/domains)

---

**更新時間**: 2025-11-02 16:00
**狀態**: 等待 DNS 傳播完成
