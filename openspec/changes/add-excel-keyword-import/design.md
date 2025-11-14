# 設計文件：Excel 自動化文章批次匯入系統

## 核心架構決策

### 1. 平台無關發佈架構

**決策**: 使用「網域 + slug」模式，而非 WordPress 特定 URL

**理由**:
- 支援未來擴展到其他 CMS 平台（Ghost、自訂系統等）
- 內部連結可使用相對或絕對路徑，不依賴特定平台
- 發佈前可預覽完整 URL
- URL 格式統一且 SEO 友善

**架構設計**:
```typescript
interface WebsiteConfig {
  id: string;
  name: string;
  base_url: string;              // https://blog.example.com
  slug_prefix: string;            // /articles/ 或空字串
  url_strategy: 'relative' | 'absolute';  // 內部連結策略
  default_slug_strategy: 'auto' | 'pinyin' | 'english' | 'custom';
}

// URL 組裝範例
function assembleURL(config: WebsiteConfig, slug: string): string {
  return `${config.base_url}${config.slug_prefix}${slug}`;
}
// 結果：https://blog.example.com/articles/nextjs-tutorial-guide
```

**替代方案**:
- ❌ WordPress 特定 URL：無法擴展到其他平台
- ❌ 完整 URL 儲存：無法處理網域變更，難以維護

### 2. URL Slug 智慧生成系統

**決策**: 多策略 slug 生成，支援中文拼音轉換和 SEO 優化

**生成策略**:
```typescript
enum SlugStrategy {
  AUTO = 'auto',        // 自動判斷（中文用拼音，英文直接處理）
  PINYIN = 'pinyin',    // 中文轉拼音
  ENGLISH = 'english',  // AI 提取英文關鍵字
  CUSTOM = 'custom'     // 使用者自訂
}

// 核心生成邏輯
function generateSlug(text: string, strategy: SlugStrategy): string {
  switch (strategy) {
    case 'auto':
      const hasChinese = /[\u4e00-\u9fa5]/.test(text);
      return hasChinese
        ? SlugStrategy.PINYIN(text)
        : SlugStrategy.ENGLISH(text);

    case 'pinyin':
      const pinyinText = pinyin(text, {
        toneType: 'none',
        type: 'array'
      }).join('-');
      return slugify(pinyinText, { lower: true, strict: true });

    case 'english':
      // AI 提取英文關鍵字（後備方案：使用原文）
      return await extractEnglishKeywords(text);

    case 'custom':
      return slugify(text, { lower: true, strict: true });
  }
}
```

**SEO 優化規則**（基於 2025 最佳實踐）:
- 長度控制在 3-60 字元
- 僅使用小寫字母、數字、連字符
- 避免停用詞（the、a、an 等）
- 包含主要關鍵字
- 可讀性優先於簡短

**唯一性保證**:
```sql
-- 資料庫約束
CONSTRAINT unique_website_slug UNIQUE (website_id, slug)

-- 應用層檢查
CREATE INDEX idx_article_jobs_website_slug
ON article_jobs(website_id, slug);
```

**衝突處理**:
```typescript
async function ensureUniqueSlug(
  websiteId: string,
  baseSlug: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (await slugExists(websiteId, slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
```

### 3. 自動化標題生成流程

**決策**: 每個關鍵字僅生成 1 個最佳標題，無需使用者選擇

**流程**:
```
1. 使用者上傳 Excel → 前端解析（關鍵字、網站、類型、時間、slug）
2. 前端發送發佈計畫到 /api/articles/import-batch
3. 後端檢查 token 餘額（預估總成本）
4. 批次生成標題（每個關鍵字 1 個標題）
5. 判斷文章類型（若 Excel 未填）
6. 生成或驗證 slug（確保唯一性）
7. 計算排程時間（固定間隔或指定時間）
8. 批次插入 article_jobs 表
9. 回傳建立結果和排程預覽
```

**理由**:
- 減少使用者操作步驟（更自動化）
- 降低 token 成本（1 個標題 vs 5 個標題）
- AI 可根據文章類型生成最適合的標題
- 簡化 UI/UX 流程

**標題生成策略**:
```typescript
async function generateTitle(
  keyword: string,
  articleType?: string
): Promise<string> {
  // 若文章類型未指定，先判斷類型
  const type = articleType || await determineArticleType(keyword);

  // 根據類型生成標題
  const prompts = {
    '教學': `為「${keyword}」生成一個教學類標題，包含數字步驟`,
    '排行榜': `為「${keyword}」生成一個排行榜標題，包含年份和數量`,
    '比較': `為「${keyword}」生成一個比較類標題，使用 vs 格式`,
    '資訊型': `為「${keyword}」生成一個資訊型標題，全面且吸引人`
  };

  return await callAI(prompts[type]);
}
```

### 4. 文章類型智慧判斷

**決策**: 混合模式 - Excel 優先，未填則 AI 判斷

**判斷邏輯**:
```typescript
async function determineArticleType(
  keyword: string,
  excelType?: string
): Promise<ArticleType> {
  // 1. 若 Excel 已填，直接使用
  if (excelType && isValidArticleType(excelType)) {
    return excelType;
  }

  // 2. 使用 AI 分析關鍵字
  const prompt = `
    分析關鍵字「${keyword}」，判斷最適合的文章類型：
    - 教學：包含「如何」、「教學」、步驟性內容
    - 排行榜：包含「最好」、「推薦」、「排名」
    - 比較：包含「vs」、「比較」、「差異」
    - 資訊型：一般資訊、概念解釋

    僅回傳類型名稱。
  `;

  return await callAI(prompt);
}

type ArticleType = '教學' | '排行榜' | '比較' | '資訊型';
```

**整合到生成策略**:
```typescript
// strategy-agent.ts 修改
const strategyPrompts = {
  '教學': `
    撰寫詳細的步驟教學文章，包含：
    - 循序漸進的步驟
    - 每個步驟的截圖或範例
    - 常見問題和解決方案
  `,
  '排行榜': `
    撰寫排行榜格式文章，包含：
    - 10 個項目的排名
    - 每個項目的評分和優缺點
    - 比較表格
  `,
  '比較': `
    撰寫深入的功能比較文章，包含：
    - 並列比較表格
    - 優缺點分析
    - 使用情境建議
  `,
  '資訊型': `
    提供全面的資訊概覽，包含：
    - 完整的背景知識
    - 相關統計數據
    - 實用建議
  `
};
```

### 5. 排程發佈系統

**決策**: 支援兩種模式 - 指定時間和固定間隔

**排程計算**:
```typescript
interface ScheduleConfig {
  mode: 'specific' | 'interval';
  intervalHours?: number;    // 固定間隔（小時）
  startTime?: Date;          // 起始時間
}

function calculateSchedules(
  plans: PublishPlan[],
  config: ScheduleConfig
): Map<string, Date> {
  const schedules = new Map<string, Date>();

  plans.forEach((plan, index) => {
    if (plan.publishTime) {
      // Excel 指定時間優先
      schedules.set(plan.id, new Date(plan.publishTime));
    } else if (config.mode === 'interval') {
      // 計算固定間隔時間
      const baseTime = config.startTime || new Date();
      const offset = index * config.intervalHours! * 60 * 60 * 1000;
      schedules.set(plan.id, new Date(baseTime.getTime() + offset));
    }
  });

  return schedules;
}
```

**時間衝突處理**:
```typescript
function resolveTimeConflicts(
  schedules: Map<string, Date>
): Map<string, Date> {
  const timeMap = new Map<number, string[]>();

  // 檢測衝突
  schedules.forEach((time, id) => {
    const timestamp = time.getTime();
    if (!timeMap.has(timestamp)) {
      timeMap.set(timestamp, []);
    }
    timeMap.get(timestamp)!.push(id);
  });

  // 解決衝突（延後 30 分鐘）
  timeMap.forEach((ids, timestamp) => {
    if (ids.length > 1) {
      ids.slice(1).forEach((id, index) => {
        const newTime = new Date(timestamp + (index + 1) * 30 * 60 * 1000);
        schedules.set(id, newTime);
      });
    }
  });

  return schedules;
}
```

**Cron Job 執行器**:
```typescript
// /api/cron/process-scheduled-articles/route.ts
export async function GET(request: NextRequest) {
  // 1. 取得到期任務
  const dueJobs = await db
    .from('article_jobs')
    .select('*')
    .lte('scheduled_publish_at', new Date().toISOString())
    .eq('status', 'pending')
    .limit(10);

  // 2. 並發處理（最多 5 個）
  const results = await processBatchWithLimit(
    dueJobs,
    async (job) => {
      await generateAndPublishArticle(job);
    },
    5
  );

  return NextResponse.json({ processed: results.length });
}
```

### 6. 內部連結自動化

**決策**: 文章生成時預先插入相關文章連結

**連結生成策略**:
```typescript
async function generateInternalLinks(
  articleSlug: string,
  websiteId: string,
  content: string
): Promise<string> {
  // 1. 從資料庫取得同網站已發佈文章
  const publishedArticles = await db
    .from('article_jobs')
    .select('slug, title, keywords')
    .eq('website_id', websiteId)
    .eq('status', 'published')
    .limit(50);

  // 2. 使用 AI 分析相關性
  const relatedArticles = await findRelatedArticles(
    content,
    publishedArticles
  );

  // 3. 插入內部連結（3-5 個）
  let updatedContent = content;
  const linksToAdd = relatedArticles.slice(0, 5);

  linksToAdd.forEach((article) => {
    const linkHTML = `<a href="${article.slug}" rel="internal">${article.title}</a>`;
    updatedContent = insertLinkIntoContent(updatedContent, linkHTML);
  });

  return updatedContent;
}

// 相對路徑 vs 絕對路徑
function formatInternalLink(
  targetSlug: string,
  currentSlug: string,
  strategy: 'relative' | 'absolute',
  baseUrl: string
): string {
  if (strategy === 'relative') {
    return `/${targetSlug}`;  // 相對於網站根目錄
  } else {
    return `${baseUrl}/${targetSlug}`;  // 完整 URL
  }
}
```

### 7. 資料庫設計

**article_jobs 表擴充**:
```sql
ALTER TABLE article_jobs
ADD COLUMN slug TEXT NOT NULL DEFAULT '',
ADD COLUMN article_type TEXT CHECK (
  article_type IN ('教學', '排行榜', '比較', '資訊型')
),
ADD COLUMN scheduled_publish_at TIMESTAMPTZ,
ADD COLUMN published_url TEXT,
ADD COLUMN slug_strategy TEXT DEFAULT 'auto' CHECK (
  slug_strategy IN ('auto', 'pinyin', 'english', 'custom')
),
ADD CONSTRAINT unique_website_slug UNIQUE (website_id, slug);
```

**website_configs 表擴充**:
```sql
ALTER TABLE website_configs
ADD COLUMN base_url TEXT NOT NULL DEFAULT '',
ADD COLUMN slug_prefix TEXT DEFAULT '',
ADD COLUMN url_strategy TEXT DEFAULT 'relative' CHECK (
  url_strategy IN ('relative', 'absolute')
),
ADD COLUMN default_slug_strategy TEXT DEFAULT 'auto' CHECK (
  default_slug_strategy IN ('auto', 'pinyin', 'english', 'custom')
);
```

**索引優化**:
```sql
CREATE INDEX idx_article_jobs_website_slug
ON article_jobs(website_id, slug);

CREATE INDEX idx_published_articles
ON article_jobs(website_id, slug)
WHERE status = 'published';

CREATE INDEX idx_scheduled_jobs
ON article_jobs(scheduled_publish_at)
WHERE status = 'pending';
```

### 8. 檔案處理策略

**決策**: 在前端解析 Excel 檔案（支援多欄位）

**理由**:
- 減少伺服器負載和儲存成本
- 提升使用者回饋速度（即時預覽）
- 避免處理檔案上傳的安全問題
- 支援複雜的多欄位格式驗證

### 9. 資料流設計

```typescript
// 前端狀態管理（簡化後）
interface ImportState {
  step: 'upload' | 'preview' | 'schedule' | 'confirm';
  publishPlans: PublishPlan[];
  scheduleConfig: ScheduleConfig;
  validation: ValidationResult;
}

interface PublishPlan {
  id: string;
  keyword: string;
  websiteName: string;
  websiteId?: string;        // 驗證後填入
  articleType?: string;
  publishTime?: string;
  customSlug?: string;
  generatedTitle?: string;   // 後端生成
  generatedSlug?: string;    // 後端生成
  previewUrl?: string;       // 完整 URL 預覽
  status: 'valid' | 'warning' | 'error';
}

// API Request/Response
interface ImportBatchRequest {
  plans: PublishPlan[];
  scheduleConfig: ScheduleConfig;
}

interface ImportBatchResponse {
  created: number;
  failed: number;
  results: {
    planId: string;
    jobId?: string;
    title: string;
    slug: string;
    scheduledAt: string;
    previewUrl: string;
    error?: string;
  }[];
  totalCost: number;
}
```

### 10. UI/UX 設計（更新後）

**簡化流程**:
1. **上傳步驟**: 拖放或選擇 Excel 檔案
2. **預覽與編輯**: 顯示發佈計畫列表，允許編輯/刪除/網站驗證
3. **排程設定**: 設定固定間隔或保留 Excel 時間
4. **確認執行**: 顯示預覽（標題、URL、排程）和預估成本

**元件結構**:
```
ImportPage
├─ ExcelUploadZone (步驟 1)
├─ PublishPlanTable (步驟 2)
│  ├─ WebsiteValidationIndicator
│  ├─ EditDialog
│  └─ BatchActions
├─ ScheduleSettings (步驟 3)
│  └─ SchedulePreview
└─ ConfirmSection (步驟 4)
   ├─ SummaryCards
   └─ CostEstimator
```

## 技術實作細節

### Excel 多欄位解析

```typescript
// @/lib/utils/excel-parser.ts
import * as XLSX from 'xlsx';

interface ExcelRow {
  keyword: string;
  website: string;
  type?: string;
  publishTime?: string;
  slug?: string;
}

function parseMultiColumnExcel(file: File): Promise<ExcelRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: unknown[][] = XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
        defval: ''
      });

      // 檢測標題列（第一列包含「關鍵字」或「網站」）
      const firstRow = jsonData[0] as string[];
      const hasHeader = firstRow.some(cell =>
        typeof cell === 'string' &&
        (cell.includes('關鍵字') || cell.includes('網站'))
      );

      const dataRows = hasHeader ? jsonData.slice(1) : jsonData;

      // 解析資料列
      const rows: ExcelRow[] = dataRows
        .filter(row => row.length > 0 && row[0]) // 過濾空白列
        .map((row) => ({
          keyword: String(row[0] || '').trim(),
          website: String(row[1] || '').trim(),
          type: row[2] ? String(row[2]).trim() : undefined,
          publishTime: row[3] ? String(row[3]).trim() : undefined,
          slug: row[4] ? String(row[4]).trim() : undefined
        }))
        .filter(row => row.keyword && row.website); // 必填欄位驗證

      resolve(rows.slice(0, 500)); // 限制最多 500 個
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
```

### 網站名稱智慧對應

```typescript
// @/lib/utils/website-matcher.ts
import Fuse from 'fuse.js';

interface WebsiteMatch {
  websiteId: string;
  confidence: 'exact' | 'fuzzy' | 'none';
  suggestion?: string;
}

async function matchWebsiteName(
  inputName: string,
  companyId: string
): Promise<WebsiteMatch> {
  // 取得公司的所有網站
  const websites = await db
    .from('website_configs')
    .select('id, name')
    .eq('company_id', companyId);

  // 1. 精確匹配
  const exactMatch = websites.find(w =>
    w.name.toLowerCase() === inputName.toLowerCase()
  );
  if (exactMatch) {
    return {
      websiteId: exactMatch.id,
      confidence: 'exact'
    };
  }

  // 2. 模糊匹配（使用 Fuse.js）
  const fuse = new Fuse(websites, {
    keys: ['name'],
    threshold: 0.3
  });
  const fuzzyResults = fuse.search(inputName);

  if (fuzzyResults.length > 0) {
    return {
      websiteId: fuzzyResults[0].item.id,
      confidence: 'fuzzy',
      suggestion: fuzzyResults[0].item.name
    };
  }

  // 3. 無匹配
  return {
    websiteId: '',
    confidence: 'none'
  };
}
```

### 批次匯入 API

```typescript
// /app/api/articles/import-batch/route.ts
export async function POST(request: NextRequest) {
  const { plans, scheduleConfig } = await request.json();

  // 1. 驗證使用者和公司
  const { user, companyId } = await authenticateRequest(request);

  // 2. 預估總成本
  const estimatedCost = plans.length * 500; // 標題+類型判斷+slug
  const balance = await billingService.getCurrentBalance(companyId);
  if (balance.total < estimatedCost) {
    return NextResponse.json(
      { error: 'Insufficient balance' },
      { status: 402 }
    );
  }

  // 3. 批次處理（並發限制 5）
  const results = await processBatchWithLimit(
    plans,
    async (plan: PublishPlan) => {
      try {
        // 3.1 生成標題
        const title = await generateTitle(plan.keyword, plan.articleType);

        // 3.2 判斷文章類型（若未填）
        const articleType = plan.articleType ||
          await determineArticleType(plan.keyword);

        // 3.3 生成 slug
        const slug = plan.customSlug ||
          await generateAndEnsureUniqueSlug(
            plan.keyword,
            plan.websiteId!,
            'auto'
          );

        // 3.4 組裝 URL 預覽
        const website = await getWebsiteConfig(plan.websiteId!);
        const previewUrl = `${website.base_url}${website.slug_prefix}${slug}`;

        // 3.5 計算排程時間
        const scheduledAt = calculateScheduleTime(plan, scheduleConfig);

        // 3.6 建立任務
        const job = await db
          .from('article_jobs')
          .insert({
            company_id: companyId,
            website_id: plan.websiteId,
            keywords: plan.keyword,
            slug,
            article_type: articleType,
            scheduled_publish_at: scheduledAt,
            status: 'pending',
            metadata: {
              importSource: 'excel',
              title,
              original_keyword: plan.keyword
            }
          })
          .select()
          .single();

        return {
          planId: plan.id,
          jobId: job.id,
          title,
          slug,
          scheduledAt,
          previewUrl
        };
      } catch (error) {
        return {
          planId: plan.id,
          error: error.message
        };
      }
    },
    5
  );

  // 4. 統計結果
  const created = results.filter(r => !r.error).length;
  const failed = results.filter(r => r.error).length;

  return NextResponse.json({
    created,
    failed,
    results,
    totalCost: estimatedCost
  });
}
```

### Slug 生成與唯一性保證

```typescript
// @/lib/services/slug-generator.ts
import { pinyin } from 'pinyin-pro';
import slugify from 'slugify';

async function generateAndEnsureUniqueSlug(
  keyword: string,
  websiteId: string,
  strategy: SlugStrategy = 'auto'
): Promise<string> {
  // 1. 生成基礎 slug
  let baseSlug = '';

  switch (strategy) {
    case 'auto':
      const hasChinese = /[\u4e00-\u9fa5]/.test(keyword);
      baseSlug = hasChinese
        ? generatePinyinSlug(keyword)
        : generateEnglishSlug(keyword);
      break;

    case 'pinyin':
      baseSlug = generatePinyinSlug(keyword);
      break;

    case 'english':
      baseSlug = await generateEnglishSlug(keyword);
      break;

    case 'custom':
      baseSlug = slugify(keyword, { lower: true, strict: true });
      break;
  }

  // 2. 確保唯一性
  return await ensureUniqueSlug(websiteId, baseSlug);
}

function generatePinyinSlug(text: string): string {
  const pinyinText = pinyin(text, {
    toneType: 'none',
    type: 'array'
  }).join('-');

  return slugify(pinyinText, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  }).substring(0, 60); // 限制長度
}

async function generateEnglishSlug(text: string): Promise<string> {
  // 使用 AI 提取英文關鍵字
  const englishKeywords = await extractEnglishKeywords(text);

  return slugify(englishKeywords, {
    lower: true,
    strict: true
  }).substring(0, 60);
}

async function ensureUniqueSlug(
  websiteId: string,
  baseSlug: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const exists = await db
      .from('article_jobs')
      .select('id')
      .eq('website_id', websiteId)
      .eq('slug', slug)
      .single();

    if (!exists) break;

    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
```

### 並發控制

```typescript
// @/lib/utils/batch-processor.ts
async function processBatchWithLimit<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  limit: number
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.allSettled(
      batch.map(processor)
    );

    results.push(...batchResults.map(r =>
      r.status === 'fulfilled' ? r.value : {
        error: r.status === 'rejected' ? r.reason : 'Unknown error'
      }
    ));
  }

  return results;
}
```

## 相依性與套件

### 前端套件
```json
{
  "dependencies": {
    "xlsx": "^0.18.5",           // Excel 解析
    "slugify": "^1.6.6",         // URL slug 生成
    "fuse.js": "^7.0.0",         // 模糊匹配
    "@tanstack/react-table": "^8.x"  // 表格顯示
  }
}
```

### 後端套件
```json
{
  "dependencies": {
    "pinyin-pro": "^3.19.0",     // 中文拼音轉換
    "slugify": "^1.6.6"          // URL slug 生成
  }
}
```

## 安全考量

### 1. 檔案驗證
```typescript
function validateExcelFile(file: File): boolean {
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!validTypes.includes(file.type)) {
    throw new Error('僅支援 .xlsx 和 .xls 格式');
  }

  if (file.size > maxSize) {
    throw new Error('檔案大小超過限制（最大 5MB）');
  }

  return true;
}
```

### 2. 輸入清理與驗證
```typescript
function sanitizeKeyword(keyword: string): string {
  return keyword
    .trim()
    .replace(/[<>]/g, '')  // 移除 HTML 標籤符號
    .substring(0, 200);    // 限制長度
}

function validateArticleType(type: string): boolean {
  const validTypes = ['教學', '排行榜', '比較', '資訊型'];
  return validTypes.includes(type);
}
```

### 3. SQL 注入防護
- 使用 Supabase ORM，自動參數化查詢
- 避免原始 SQL 字串拼接
- 使用 prepared statements

### 4. 速率限制
```typescript
// 使用 Vercel Rate Limiting 或 Redis
import { ratelimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const identifier = request.headers.get('x-forwarded-for') || 'anonymous';
  const { success } = await ratelimit.limit(identifier);

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }

  // 繼續處理...
}
```

## 效能考量

### 1. 前端優化
- **Web Worker**: 使用 Web Worker 解析大型 Excel 避免阻塞 UI
- **虛擬化列表**: 超過 100 個計畫時使用 `react-window` 虛擬化
- **快取**: 使用 React Query 快取網站列表

### 2. 後端優化
```typescript
// 批次資料庫操作
const jobs = plans.map(plan => ({
  company_id: companyId,
  website_id: plan.websiteId,
  keywords: plan.keyword,
  slug: plan.slug,
  status: 'pending'
}));

// 一次插入所有任務（而非逐筆插入）
await db.from('article_jobs').insert(jobs);
```

### 3. 資料庫索引
```sql
-- 加速 slug 唯一性檢查
CREATE INDEX CONCURRENTLY idx_article_jobs_website_slug
ON article_jobs(website_id, slug);

-- 加速排程任務查詢
CREATE INDEX CONCURRENTLY idx_scheduled_jobs
ON article_jobs(scheduled_publish_at)
WHERE status = 'pending';
```

### 4. 並發控制
- 限制 AI API 並發數：5
- 限制資料庫查詢並發：10
- 使用佇列系統處理大量任務

## 錯誤處理

### 1. 前端錯誤處理
```typescript
try {
  const rows = await parseMultiColumnExcel(file);
  setPublishPlans(rows);
} catch (error) {
  if (error instanceof Error) {
    toast.error(error.message);
  } else {
    toast.error('無法解析 Excel 檔案，請確認格式正確');
  }
}
```

### 2. 後端錯誤處理
```typescript
// 詳細錯誤日誌
catch (error) {
  console.error('Import batch failed:', {
    error: error.message,
    stack: error.stack,
    planId: plan.id,
    keyword: plan.keyword
  });

  return {
    planId: plan.id,
    error: error.message || 'Unknown error occurred'
  };
}
```

### 3. 重試機制
```typescript
async function generateTitleWithRetry(
  keyword: string,
  maxRetries: number = 3
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await generateTitle(keyword);
    } catch (error) {
      if (i === maxRetries - 1) {
        // 最後一次失敗，使用關鍵字作為標題
        return keyword;
      }
      // 等待後重試
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  return keyword;
}
```

## 測試策略

### 1. 單元測試
```typescript
// Excel 解析測試
describe('parseMultiColumnExcel', () => {
  it('should parse standard format correctly', async () => {
    const mockFile = createMockExcelFile([
      ['關鍵字', '網站', '類型', '時間', 'slug'],
      ['Next.js 教學', '技術部落格', '教學', '2025-11-15 10:00', '']
    ]);

    const result = await parseMultiColumnExcel(mockFile);

    expect(result).toHaveLength(1);
    expect(result[0].keyword).toBe('Next.js 教學');
    expect(result[0].website).toBe('技術部落格');
  });
});

// Slug 生成測試
describe('generateSlug', () => {
  it('should convert Chinese to pinyin', () => {
    const slug = generatePinyinSlug('下一代 JavaScript');
    expect(slug).toBe('xia-yi-dai-javascript');
  });

  it('should ensure slug uniqueness', async () => {
    const slug = await ensureUniqueSlug('website-1', 'test-slug');
    // 模擬衝突情況
    expect(slug).toMatch(/^test-slug(-\d+)?$/);
  });
});
```

### 2. 整合測試
```typescript
describe('POST /api/articles/import-batch', () => {
  it('should create jobs successfully', async () => {
    const response = await fetch('/api/articles/import-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plans: mockPublishPlans,
        scheduleConfig: { mode: 'interval', intervalHours: 2 }
      })
    });

    const data = await response.json();
    expect(data.created).toBe(mockPublishPlans.length);
    expect(data.results).toHaveLength(mockPublishPlans.length);
  });
});
```

### 3. E2E 測試
```typescript
test('complete import workflow', async ({ page }) => {
  // 1. 上傳 Excel
  await page.goto('/dashboard/articles/import');
  await page.setInputFiles('input[type="file"]', 'test.xlsx');

  // 2. 驗證預覽
  await expect(page.locator('table tbody tr')).toHaveCount(10);

  // 3. 設定排程
  await page.fill('input[name="intervalHours"]', '2');

  // 4. 確認執行
  await page.click('button:has-text("開始執行")');

  // 5. 驗證成功訊息
  await expect(page.locator('.toast')).toContainText('成功建立 10 個任務');
});
```

### 4. 效能測試
```typescript
test('should handle 500 plans efficiently', async () => {
  const start = Date.now();
  const largeBatch = createMockPlans(500);

  const response = await importBatch(largeBatch);

  const duration = Date.now() - start;
  expect(duration).toBeLessThan(30000); // 應在 30 秒內完成
  expect(response.created).toBe(500);
});
```
