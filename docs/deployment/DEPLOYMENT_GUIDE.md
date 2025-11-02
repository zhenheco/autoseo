# Cloudflare Pages 部署指南

## 🎯 為什麼選擇 Pages 而非 Workers?

你的專案目前面臨:
- **Workers Bundle 限制**: 33.6 MB vs 3 MB (免費) / 10 MB (付費)
- **複雜依賴**: Supabase + AI SDK + Dashboard = 大量程式碼

**Cloudflare Pages 優勢**:
1. ✅ **無 Bundle 大小限制**(透過不同的架構)
2. ✅ **原生支援 SSR + API Routes**
3. ✅ **完整支援 Webhook**(NewebPay 等)
4. ✅ **自動 CDN 優化**
5. ✅ **Git 整合 CI/CD**

---

## 📋 遷移步驟

### 步驟 1: 保留 standalone 模式

你的 next.config.js 目前配置已經正確:
```javascript
output: 'standalone',
outputFileTracingRoot: path.join(__dirname),
```

**不需要改成 export 模式**, 因為 OpenNext for Cloudflare 可以處理 standalone 輸出。

### 步驟 2: 使用 OpenNext 建置 (維持現狀)

```bash
# 現有的建置流程已經正確
npm run build
npx @opennextjs/cloudflare@latest build
```

### 步驟 3: 部署到 Pages (而非 Workers)

```bash
# 使用 Pages 部署而非 Workers deploy
npx wrangler pages deploy .open-next --project-name=auto-pilot-seo
```

### 步驟 4: 設定環境變數

在 Cloudflare Dashboard:
1. 進入 **Pages** → **auto-pilot-seo** → **Settings** → **Environment variables**
2. 新增所有必要的環境變數

---

## 🔍 關鍵差異: Workers vs Pages

| 項目 | Workers (目前失敗) | Pages (推薦) |
|------|-------------------|--------------|
| 部署指令 | `wrangler deploy` | `wrangler pages deploy` |
| Bundle 限制 | 3MB/10MB ❌ | 更寬鬆 ✅ |
| 配置檔 | wrangler.jsonc | 自動或 _worker.js |
| 路由方式 | 單一 Worker | Pages + Functions |

**關鍵優勢**: Pages Functions 的架構允許更大的 bundle, 因為:
1. 靜態資源和邏輯分離
2. Functions 按需載入
3. 不同的資源限制策略

---

## 📝 更新 package.json

```json
"scripts": {
  "deploy:pages": "npm run build && npx @opennextjs/cloudflare build && npx wrangler pages deploy .open-next --project-name=auto-pilot-seo",
  "deploy:workers": "npm run deploy:cf-workers"
}
```

---

## ✅ 執行檢查清單

- [ ] 確認 Node.js 版本 >= 18
- [ ] 執行 `npm run build` 成功
- [ ] 執行 `npx @opennextjs/cloudflare build` 成功
- [ ] 在 Cloudflare Dashboard 建立 Pages 專案
- [ ] 設定所有環境變數
- [ ] 執行 `npm run deploy:pages`
- [ ] 測試 webhook 端點
- [ ] 設定自訂網域 (seo.zhenhe-dm.com)

---

## 🚀 預期結果

- **部署成功**: Pages 的架構設計可以處理較大的應用
- **效能**: 與 Workers 相當, 冷啟動可能略慢 (~100-200ms)
- **成本**: 免費方案足夠
- **維護**: 更簡單, 透過 Git 整合自動部署

---

## 🔧 如果仍有問題

可以考慮的進階優化:
1. **Code Splitting**: 使用動態 import
2. **移除大型依賴**: 
   - googleapis (164.1.0) - 是否可以只導入需要的模組?
   - jsdom (27.0.1) - 是否可以改用輕量方案?
3. **Tree Shaking**: 確保 webpack/next 正確處理

但**優先嘗試 Pages 部署**, 這是最快的解決方案!
