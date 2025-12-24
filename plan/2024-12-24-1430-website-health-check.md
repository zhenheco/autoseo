# 網站健檢功能實作計畫

## 規劃摘要

為用戶的 WordPress 網站新增 SEO 健檢功能，採用漸進式策略：Phase 1 實作基本檢查（免費 API），Phase 2 預留完整爬蟲擴展。

**檢查項目：**

- Core Web Vitals (LCP, INP, CLS)
- Lighthouse 綜合分數（效能、無障礙、SEO、最佳實踐）
- Meta 標籤分析
- 結構化資料檢查
- robots.txt / sitemap.xml 存在性
- AI 生成改善建議

---

## 技術選型

| 技術                              | 選擇理由                                          |
| --------------------------------- | ------------------------------------------------- |
| **Google PageSpeed Insights API** | 免費（每日 25,000 次）、官方資料、包含 Lighthouse |
| **同步 API 處理**                 | 總執行時間 20-50 秒，遠低於 Vercel 300 秒限制     |
| **WebsiteHealthService**          | 不需 Agent 架構，Service 模式更適合確定性操作     |
| **DeepSeek AI**                   | 現有整合、成本低、支援 JSON mode                  |

---

## 已完成的檔案

### 新增檔案

```
src/
├── app/
│   ├── api/websites/[websiteId]/health-check/
│   │   ├── route.ts                    # POST 觸發檢查 / GET 最新結果
│   │   ├── [checkId]/route.ts          # GET 取得指定結果
│   │   └── history/route.ts            # GET 歷史記錄
│   └── (dashboard)/dashboard/websites/[websiteId]/health-check/
│       └── page.tsx                    # 主頁面
├── components/
│   ├── ui/accordion.tsx                # 新增 UI 元件
│   └── health-check/
│       ├── index.ts                    # 匯出
│       ├── score-card.tsx              # 分數卡片
│       ├── core-web-vitals-display.tsx # CWV 顯示
│       ├── meta-analysis-display.tsx   # Meta 分析
│       ├── recommendations-list.tsx    # AI 建議列表
│       ├── health-check-trigger-button.tsx
│       └── health-check-results.tsx    # 結果主元件
├── lib/services/
│   └── website-health-service.ts       # 核心服務
└── types/
    └── health-check.ts                 # 型別定義

supabase/migrations/
└── 20251224100000_website_health_checks.sql
```

---

## 環境變數

```bash
# 新增到 .env.local 和 Vercel/GitHub Secrets
GOOGLE_PAGESPEED_API_KEY=<從 Google Cloud Console 取得>
```

**取得方式：**

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立專案或選擇現有專案
3. 啟用 PageSpeed Insights API
4. 建立 API Key

---

## 待辦事項

- [x] 建立資料庫 Migration
- [x] 建立 TypeScript 型別定義
- [x] 實作 WebsiteHealthService
- [x] 建立 API 路由
- [x] 建立前端頁面和元件
- [x] 建置測試通過
- [ ] 執行資料庫 Migration（需要在 Supabase Dashboard 執行）
- [ ] 設定 GOOGLE_PAGESPEED_API_KEY 環境變數
- [ ] 實際功能測試

---

## Phase 2 擴展預留

- 整站爬蟲功能
- 斷鏈檢測
- 內部連結分析
- GitHub Actions 背景處理

---

## 參考資料

- [Google PageSpeed Insights API](https://developers.google.com/speed/docs/insights/v5/get-started)
- [Core Web Vitals](https://web.dev/vitals/)
- [Lighthouse Scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)
