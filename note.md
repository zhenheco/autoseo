# 問題排查經驗總結

## 2025-11-30: Vercel API 500 錯誤修復

### 問題描述

所有 API 路由在 Vercel 上返回 500 Internal Server Error，包括最簡單的無 import 端點。頁面路由（如首頁、登入頁）正常運作。

### 症狀

- 所有 `/api/*` 路由返回 500 HTML 錯誤頁面
- Response header 顯示 `x-matched-path: /500`
- `access-control-allow-origin` header 包含 `%0A`（換行符）
- 即使創建完全無 import 的測試端點也失敗

### 排查過程

1. **創建診斷端點**
   - `/api/debug/ping` - 極簡端點（無 import）
   - `/api/debug/env` - 環境變數檢查
   - `/api/debug/health` - 完整診斷（資料庫連線等）

2. **嘗試的修復方案（無效）**
   - 移除 `output: "standalone"` 配置
   - 移除 `outputFileTracingRoot` 配置
   - 強制使用 pnpm（`installCommand: "pnpm install"`）

3. **最終發現根本原因**
   - Middleware 的 `matcher` 配置包含所有 `/api/*` 路徑
   - 即使在 middleware 函數內跳過 debug 路由，**import 語句在模組載入時就已執行**
   - Middleware import 的模組可能有問題，導致整個 middleware 崩潰
   - 所有經過 middleware 的請求都被導向 500 錯誤頁面

### 解決方案

**1. Middleware Matcher 排除 Debug 路由**

```typescript
// src/middleware.ts
export const config = {
  matcher: [
    // 加入 api/debug 到排除清單
    "/((?!_next/static|_next/image|favicon.ico|api/debug|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**2. 修復 CORS 換行符問題**

```javascript
// next.config.js
{
  key: "Access-Control-Allow-Origin",
  value: (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3168").trim(),
}
```

**3. 強制使用 pnpm（可選但建議）**

```json
// vercel.json
{
  "installCommand": "pnpm install"
}
```

### 關鍵教訓

1. **Middleware 的 import 在模組載入時執行**
   - 即使在函數內 early return，import 語句已經執行
   - 如果 import 的模組有問題，整個 middleware 會崩潰
   - 使用 matcher 排除路由比在函數內檢查更可靠

2. **環境變數可能包含隱藏字元**
   - Vercel 環境變數可能包含換行符
   - 使用 `.trim()` 清理環境變數值

3. **診斷端點的重要性**
   - 創建完全獨立的診斷端點用於隔離問題
   - 診斷端點應該：
     - 無外部 import（測試基礎連線）
     - 逐步增加複雜度（環境變數 → 資料庫連線）
     - 從 middleware matcher 排除

4. **Vercel 部署調試技巧**
   - 使用 `x-matched-path` header 確認路由匹配
   - 使用 Vercel MCP 工具繞過認證訪問預覽 URL
   - 檢查 build logs 確認套件管理器和依賴安裝

### 相關檔案

- `src/middleware.ts` - Middleware 配置
- `next.config.js` - Next.js 配置（CORS headers）
- `vercel.json` - Vercel 部署配置
- `src/app/api/debug/` - 診斷端點目錄
