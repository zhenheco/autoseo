# Design Document: Fix Article UI Issues

## Architecture Overview

本次修復涉及三個主要系統組件的調整：
1. 文章生成工作流程（Workflow）
2. Token 餘額管理系統（Billing）
3. 文章內容渲染管道（Content Pipeline）

## Design Decisions

### 1. 關鍵字與標題分離設計（基於 2024 AI 內容生成 UX 最佳實踐）

#### 現有問題分析
目前系統將關鍵字直接當作標題處理，導致概念混淆。根據截圖分析，用戶輸入「5個跡象顯示AI程式設計師即將取代人類」作為關鍵字，但系統又基於此生成新標題，造成重複。

#### 業界標準工作流程（2024）

根據領先 AI 寫作平台（Jasper、Copy.ai、Clearscope）的 UX 模式：

```
三階段內容生成流程：
[主題探索] → [標題優化] → [內容生成]
     ↓            ↓            ↓
Topic/Keywords  Title Variants  Full Article
  (概念輸入)    (多選項建議)    (最終輸出)
```

#### 增強型解決方案架構

```typescript
interface ContentGenerationFlow {
  // 第一階段：主題定義
  topic: {
    keywords: string[];      // SEO 關鍵字群組
    intent: string;          // 搜尋意圖（資訊型/商業型/導航型）
    angle: string;          // 內容角度/獨特觀點
  };

  // 第二階段：標題生成
  titleGeneration: {
    aiSuggestions: Title[]; // AI 生成的 5-10 個標題
    customInput: boolean;   // 允許自訂標題
    scoring: {             // 標題評分（可選）
      seo: number;         // SEO 優化分數
      engagement: number;  // 預估點擊率
    };
  };

  // 第三階段：批次處理
  batchQueue: {
    items: QueueItem[];
    estimatedTokens: number;
    priority: 'immediate' | 'scheduled';
  };
}
```

#### UX 優化策略（基於 2024 研究）

1. **明確的階段指示器**
   - 視覺化步驟進度（1/3、2/3、3/3）
   - 麵包屑導航顯示當前位置
   - 允許返回修改前一步

2. **智能提示系統**
   ```typescript
   const topicHints = {
     placeholder: "輸入主題方向或 SEO 關鍵字群組",
     examples: ["AI 技術趨勢", "程式設計未來", "職場自動化"],
     tooltip: "系統將基於您的主題生成多個標題選項"
   };
   ```

3. **標題變體生成**
   - 提供 5-10 個不同角度的標題
   - 顯示每個標題的預估效果（點擊率、SEO 分數）
   - 支援 A/B 測試（生成多個版本）

#### 實作策略
- 重新設計 UI 流程為明確的三步驟精靈
- 在 metadata 中保存完整的生成歷程
- 實施標題去重演算法（相似度 < 0.7）
- 加入 AI 解釋功能（為何推薦此標題）

### 2. Token 餘額即時更新機制（2024 架構）

#### 現有問題分析
- 餘額組件使用 SWR 輪詢（5秒間隔）
- 文章生成完成後沒有觸發餘額更新
- 位置不當，影響使用流程

#### 混合式即時更新架構（推薦方案）

根據 2024 年的研究，結合 SWR 的可擴展性和 WebSocket 的即時性：

```
混合更新模式：
[文章生成] → [樂觀更新] → [WebSocket 推送] → [SWR 驗證] → [UI 同步]
     ↓            ↓              ↓                ↓            ↓
立即扣除預估  UI 立即反映    伺服器確認      背景驗證    最終一致
```

#### 實作策略（三層架構）

```typescript
// 1. 樂觀更新層（立即回饋）
const handleGenerateArticle = async () => {
  const estimatedCost = 1500;

  // 立即更新 UI（樂觀更新）
  mutate('/api/billing/balance',
    (current) => ({
      ...current,
      total: current.total - estimatedCost
    }),
    false // 不重新驗證
  );

  // 實際 API 呼叫
  const result = await generateArticle();

  // 觸發背景重新驗證
  mutate('/api/billing/balance');
};

// 2. WebSocket 即時推送層（可選但推薦）
useEffect(() => {
  const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL);

  ws.onmessage = (event) => {
    const { type, balance } = JSON.parse(event.data);
    if (type === 'balance_update') {
      // 更新 SWR 快取
      mutate('/api/billing/balance', balance, false);
    }
  };

  return () => ws.close();
}, []);

// 3. HTTP 輪詢備援層（降級方案）
const { data, error } = useSWR(
  '/api/billing/balance',
  fetcher,
  {
    refreshInterval: 10000, // 降至 10 秒（WebSocket 為主）
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 2000, // 防抖
  }
);
```

#### 效能考量（基於 2024 研究）
- **SWR 優勢**：HTTP 基礎更可擴展，不綁定特定伺服器
- **WebSocket 優勢**：真正即時，延遲 < 100ms
- **混合方案**：兼具兩者優點，WebSocket 斷線時自動降級到輪詢

#### 位置調整方案
```tsx
<div className="dashboard-header">
  <h1>文章管理</h1>
  <TokenBalanceDisplay />  // 移至此處
  <ArticleGenerationButtons />
</div>
```

### 3. Markdown 到 HTML 渲染管道

#### 現有問題分析
根據程式碼檢查，系統在 `article-storage.ts` 中已經處理 markdown 和 html 轉換，但預覽時可能使用了錯誤的欄位。

#### 解決方案架構
```
內容處理管道：
[Markdown] → [HTML 轉換] → [安全淨化] → [儲存] → [渲染]
     ↓            ↓            ↓          ↓         ↓
  原始內容    marked/remark  DOMPurify   DB     dangerouslySetInnerHTML
```

#### 實作策略
1. **生成階段**：確保 `WritingAgent` 同時輸出 markdown 和 html
2. **儲存階段**：驗證 `html_content` 欄位正確儲存
3. **渲染階段**：使用適當的 prose CSS 類別支援

#### HTML 淨化策略（2024 最佳實踐）

根據 2024 年的安全研究，採用多層防禦策略：

```typescript
import DOMPurify from 'isomorphic-dompurify';

// 伺服器端和客戶端通用配置
const sanitizeConfig = {
  ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                 'ul', 'ol', 'li', 'blockquote', 'strong',
                 'em', 'a', 'img', 'code', 'pre', 'mark', 'del',
                 'ins', 'sub', 'sup', 'table', 'thead', 'tbody',
                 'tr', 'td', 'th'],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class',
                 'target', 'rel', 'width', 'height'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload']
};

// 自訂 Hook 模式（推薦）
export function useSecureHTML(content: string) {
  return useMemo(() => {
    if (typeof window !== 'undefined') {
      return DOMPurify.sanitize(content, sanitizeConfig);
    }
    // 伺服器端使用 isomorphic-dompurify
    return DOMPurify.sanitize(content, sanitizeConfig);
  }, [content]);
}
```

**關鍵安全原則**：
- 在 `dangerouslySetInnerHTML` 之前立即淨化（避免中間修改）
- 使用 `isomorphic-dompurify` 支援 SSR
- 實施 Content Security Policy (CSP) 作為額外防護層
- 伺服器端儲存前也要淨化（雙重防護）

## Component Dependencies

### 受影響的組件
1. **前端組件**
   - `/src/app/(dashboard)/dashboard/articles/page.tsx`
   - `/src/components/articles/ArticleGenerationButtons.tsx`
   - `/src/components/billing/TokenBalanceDisplay.tsx`

2. **API 路由**
   - `/api/articles/generate-batch`
   - `/api/billing/balance`
   - `/api/articles`

3. **服務層**
   - `/src/lib/services/article-storage.ts`
   - `/src/lib/billing/token-billing-service.ts`
   - `/src/lib/agents/writing-agent.ts`

## Performance Considerations（2024 Core Web Vitals 標準）

### 核心效能指標監控

根據 2024 Google Core Web Vitals 要求，必須監控以下指標：

```typescript
// Next.js 內建監控實作
export function reportWebVitals(metric: NextWebVitalsMetric) {
  const vitals = {
    LCP: metric.value,      // Largest Contentful Paint < 2.5s
    INP: metric.value,      // Interaction to Next Paint < 200ms (2024新指標)
    CLS: metric.value,      // Cumulative Layout Shift < 0.1
    FCP: metric.value,      // First Contentful Paint < 1.8s
    TTFB: metric.value      // Time to First Byte < 800ms
  };

  // 發送到分析服務
  if (metric.label === 'web-vital') {
    analytics.track('Web Vitals', vitals);
  }
}
```

### Token 餘額更新優化（效能基準）

```typescript
const performanceTargets = {
  balanceUpdateLatency: 100,    // 餘額更新延遲 < 100ms
  optimisticUIDelay: 0,         // 樂觀更新無延遲
  revalidationInterval: 10000,  // 背景重新驗證間隔
  wsReconnectDelay: 1000,       // WebSocket 重連延遲
  maxRetries: 3                 // 最大重試次數
};
```

**優化策略**：
- 使用 `requestIdleCallback` 處理非關鍵更新
- 實作請求合併（request batching）
- 使用 React 18 的 `startTransition` 處理低優先級更新

### 預覽渲染優化（INP 優化重點）

```typescript
// 虛擬捲動實作（長文章）
import { FixedSizeList } from 'react-window';

// 圖片懶加載配置
const imageOptimization = {
  lazy: true,
  priority: false,
  quality: 75,
  formats: ['webp', 'avif'],
  deviceSizes: [640, 750, 828, 1080, 1200]
};

// HTML 快取策略
const cacheStrategy = {
  staleWhileRevalidate: 60 * 60,      // 1 小時
  maxAge: 24 * 60 * 60,               // 24 小時
  swr: true                           // 啟用 SWR 快取
};
```

### 效能監控工具整合

1. **Vercel Speed Insights**（推薦用於 Vercel 部署）
   - 自動收集 Core Web Vitals
   - 真實用戶監控（RUM）
   - 每月 10,000 事件免費額度

2. **第三方監控**
   - Sentry Performance Monitoring
   - New Relic Browser
   - 自建 OpenTelemetry

### 效能預算（Performance Budget）

```javascript
module.exports = {
  performanceBudget: {
    javascript: 200,      // JS bundle < 200KB
    css: 50,             // CSS < 50KB
    images: 1000,        // 圖片總計 < 1MB
    fonts: 100,          // 字體 < 100KB
    total: 1500          // 總計 < 1.5MB
  }
};
```

## Security Considerations

### XSS 防護
- 所有用戶輸入的 HTML 必須經過 DOMPurify 淨化
- 禁止內嵌 JavaScript
- 限制允許的 HTML 標籤和屬性

### Token 餘額安全
- 服務端驗證餘額扣除
- 防止重複扣款（冪等性）
- 記錄所有 Token 交易

## Migration Strategy

### 資料遷移
1. 檢查現有文章的 `html_content` 欄位
2. 對缺少 HTML 的文章執行批次轉換
3. 確保新舊資料格式相容

### 版本相容
- 保持 API 向後相容
- 使用 feature flags 控制新功能
- 分階段部署

## Testing Requirements

### 單元測試
- Token 餘額計算邏輯
- Markdown 到 HTML 轉換
- 關鍵字/標題分離邏輯

### 整合測試
- 完整的文章生成流程
- Token 扣除和更新
- 預覽渲染

### E2E 測試
- 用戶完整操作流程
- 餘額即時更新
- 預覽效果驗證

## Rollback Plan

如果部署後發現問題：
1. 回滾程式碼至上一版本
2. 清除瀏覽器快取
3. 恢復資料庫 schema（如有變更）
4. 通知受影響用戶