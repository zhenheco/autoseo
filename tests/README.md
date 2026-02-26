# E2E 測試指南

## 🎯 測試目標

這套 E2E 測試專為驗證 Z-1wayseo 專案的前端重新設計和國際化功能而設計，涵蓋：

- 🌐 **多語系功能**: 7 種語言切換和持久化
- 📱 **響應式佈局**: 跨設備和螢幕尺寸適配
- 👤 **使用者流程**: 註冊、登入、導航等關鍵路徑
- 🔧 **靜態分析**: 配置檔案和代碼品質檢查

## 📁 測試檔案結構

```
tests/
├── README.md              # 本檔案
├── i18n.spec.ts          # 國際化功能測試
├── responsive.spec.ts    # 響應式佈局測試
├── user-flows.spec.ts    # 使用者流程測試
└── static-analysis.spec.ts # 靜態分析測試
```

## 🚀 快速開始

### 1. 安裝依賴

```bash
npm install @playwright/test
npx playwright install
```

### 2. 運行測試

```bash
# 運行所有測試
npx playwright test

# 運行特定測試檔案
npx playwright test tests/i18n.spec.ts

# 帶界面運行測試
npx playwright test --ui

# 運行並生成報告
npx playwright test --reporter=html
```

### 3. 查看測試報告

```bash
npx playwright show-report
```

## 📋 測試詳情

### 🌐 國際化測試 (i18n.spec.ts)

**測試範圍**:

- 預設語言檢查 (繁體中文)
- 語言選擇器存在和可見性
- 語言切換功能
- 設定持久化 (cookie/localStorage)
- 7 種語言頁面載入測試
- 手機版語言選擇器

**支援語言**:

- zh-TW (繁體中文) - 基準語言
- en-US (English)
- ja-JP (日本語)
- ko-KR (한국어)
- de-DE (Deutsch)
- es-ES (Español)
- fr-FR (Français)

**測試要點**:

```javascript
// 檢查語言切換
await page.evaluate(() => {
  document.cookie = "ui-locale=en-US; path=/";
});

// 驗證持久化
const cookies = await page.context().cookies();
const localeCookie = cookies.find((c) => c.name === "ui-locale");
```

### 📱 響應式測試 (responsive.spec.ts)

**測試視窗**:

- Mobile: 375x667 (iPhone)
- Tablet: 768x1024 (iPad)
- Desktop: 1920x1080
- Large Desktop: 2560x1440

**測試項目**:

- 佈局適應性
- 導航選單 (漢堡選單)
- 圖片響應式載入
- 表格響應式設計
- 觸控友好性
- 文字可讀性

**關鍵檢查**:

```javascript
// 檢查水平滾動
const scrollWidth = await page.evaluate(
  () => document.documentElement.scrollWidth,
);
const clientWidth = await page.evaluate(
  () => document.documentElement.clientWidth,
);
expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 20);
```

### 👤 使用者流程測試 (user-flows.spec.ts)

**測試流程**:

- 首頁載入和導航
- 用戶註冊流程
- 用戶登入流程
- 文章生成流程
- 定價頁面瀏覽
- 搜尋功能
- 頁尾連結檢查
- 無障礙功能檢查

**無障礙檢查**:

- H1 標題結構
- 圖片 alt 屬性覆蓋率
- 表單 label 完整性
- ARIA 標籤使用

### 🔧 靜態分析測試 (static-analysis.spec.ts)

**檢查項目**:

- 多語系檔案完整性
- 語系鍵值一致性
- i18n 配置正確性
- Tailwind CSS 響應式設計
- TypeScript 配置
- Next.js 配置
- 安全配置檢查

## ⚙️ 配置說明

### Playwright 配置 (playwright.config.ts)

```typescript
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,

  // 支援多瀏覽器測試
  projects: [
    { name: "chromium" },
    { name: "firefox" },
    { name: "webkit" },
    { name: "Mobile Chrome" },
    { name: "Mobile Safari" },
  ],

  // 報告設定
  reporter: [["html"], ["json", { outputFile: "test-results/results.json" }]],
});
```

### 基礎 URL 設定

```typescript
use: {
  baseURL: 'http://localhost:3168',
  trace: 'on-first-retry',
  screenshot: 'only-on-failure'
}
```

## 🎯 測試最佳實踐

### 1. 測試組織

```javascript
test.describe("功能分組", () => {
  test.beforeEach(async ({ page }) => {
    // 每個測試前的準備工作
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("具體測試案例", async ({ page }) => {
    // 測試實作
  });
});
```

### 2. 選擇器策略

```javascript
// 優先使用 data-testid
const element = page.locator('[data-testid="component-name"]');

// 備用選擇器鏈
const button = page
  .locator('button[aria-label="提交"]')
  .or(page.locator("button").filter({ hasText: /提交|Submit/ }))
  .or(page.locator('[type="submit"]'));
```

### 3. 等待策略

```javascript
// 等待網路穩定
await page.waitForLoadState("networkidle");

// 等待元素出現
await expect(element).toBeVisible({ timeout: 10000 });

// 等待動畫完成
await page.waitForTimeout(500);
```

## 🚨 常見問題

### 1. 連接拒絕錯誤

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3168/
```

**解決方案**:

- 確保開發伺服器正在運行: `pnpm dev`
- 檢查 baseURL 設定是否正確

### 2. 元素未找到

```
Error: Timeout exceeded while waiting for selector
```

**解決方案**:

- 增加等待時間
- 使用更靈活的選擇器
- 檢查元素是否存在於 DOM 中

### 3. 測試超時

```
Error: Test timeout of 30000ms exceeded
```

**解決方案**:

- 增加測試超時時間
- 優化頁面載入速度
- 使用更精確的等待策略

## 📊 CI/CD 整合

### GitHub Actions 範例

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run tests
        run: npx playwright test

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## 📈 效能基準

### 載入時間目標

- 首頁載入: < 5 秒
- 語言切換: < 2 秒
- 路由導航: < 3 秒

### 響應式目標

- 無水平滾動條
- 按鈕最小 44px 觸控區域
- 文字行寬 < 65 字符

## 🔍 除錯技巧

### 1. 視覺除錯

```javascript
// 截圖
await page.screenshot({ path: "debug.png" });

// 錄影
await page.video()?.path();

// 追蹤
await page.tracing.start({ screenshots: true, snapshots: true });
```

### 2. Console 輸出

```javascript
page.on("console", (msg) => console.log(msg.text()));
page.on("pageerror", (err) => console.log(err.message));
```

### 3. 互動除錯

```bash
# 開啟瀏覽器視窗
npx playwright test --headed

# 除錯模式
npx playwright test --debug

# 互動模式
npx playwright codegen localhost:3168
```

---

## 📚 延伸閱讀

- [Playwright 官方文檔](https://playwright.dev/)
- [Next.js 測試指南](https://nextjs.org/docs/testing)
- [Web 無障礙指南](https://www.w3.org/WAI/WCAG21/quickref/)
- [響應式設計最佳實踐](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
