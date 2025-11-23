# Auto Pilot SEO Platform 架構重新設計

## 設計目標

將大部分 N8N workflow 邏輯移至 Platform，讓用戶可在前端設定所有參數，N8N 成為可選的高級功能。

## 核心配置結構（需存入資料庫）

### 1. Website Config（網站配置）

```typescript
interface WebsiteConfig {
  id: string;
  company_id: string;
  site_url: string;
  site_name: string;
  language: "zh-TW" | "zh-CN" | "en" | "ja";

  // WordPress 整合
  wp_username?: string;
  wp_app_password?: string;
  wp_enabled: boolean;
}
```

### 2. Brand Voice（品牌聲音）

```typescript
interface BrandVoice {
  id: string;
  website_id: string;

  tone_of_voice: string; // "Friendly and professional"
  target_audience: string; // "年輕專業人士"
  keywords: string[]; // 品牌必用詞彙

  sentence_style?: string; // "Mix of short and long sentences"
  interactivity?: string; // "Use engaging questions"

  created_at: timestamp;
  updated_at: timestamp;
}
```

### 3. Workflow Settings（工作流設定）

```typescript
interface WorkflowSettings {
  id: string;
  website_id: string;

  // SERP 分析
  serp_analysis_enabled: boolean;
  competitor_count: number; // 1-10

  // 內容生成
  content_length_min: number; // 1500
  content_length_max: number; // 2500
  keyword_density_min: number; // 1.5
  keyword_density_max: number; // 2.5

  // 品質控制
  quality_threshold: number; // 0-100, 80 為預設
  auto_publish: boolean; // 自動發布或存為草稿

  // AI 模型選擇
  serp_model: "perplexity-sonar" | "gpt-4";
  content_model: "gpt-4" | "gpt-4-turbo" | "claude-3-opus";
  meta_model: "gpt-3.5-turbo" | "gpt-4";
}
```

### 4. Keyword Management（關鍵字管理）

```typescript
interface Keyword {
  id: string;
  website_id: string;

  keyword: string; // 主要關鍵字
  region?: string; // 目標地區
  search_volume?: number;
  difficulty?: number;

  status: "active" | "used" | "archived";
  priority: number; // 1-5

  created_at: timestamp;
  last_used_at?: timestamp;
}
```

## Platform SEO 服務架構

### Service Layer

```
src/services/seo/
├── serpAnalysisService.ts     // SERP 分析（Perplexity/SerpAPI）
├── contentStrategyService.ts  // 內容策略規劃（GPT-4）
├── contentGenerationService.ts // 文章撰寫（GPT-4）
├── qualityCheckService.ts     // 品質檢查
├── metaGenerationService.ts   // SEO 元數據生成
└── wordpressService.ts        // WordPress 發布
```

### API Routes

```
src/app/api/seo/
├── generate/route.ts          // 主要生成 API
├── analyze-serp/route.ts      // SERP 分析
├── quality-check/route.ts     // 品質檢查
└── publish/route.ts           // 發布到 WordPress
```

### Server Actions

```
src/app/actions/seo/
├── generateArticle.ts         // 文章生成主流程
├── analyzeKeyword.ts          // 關鍵字分析
└── publishArticle.ts          // 發布文章
```

## 資料庫 Schema 更新

### 新增 Tables

#### brand_voices

| Column          | Type      | Description           |
| --------------- | --------- | --------------------- |
| id              | uuid      | Primary key           |
| website_id      | uuid      | FK to website_configs |
| tone_of_voice   | text      | 語調                  |
| target_audience | text      | 目標受眾              |
| keywords        | text[]    | 品牌詞彙              |
| sentence_style  | text      | 句式風格              |
| interactivity   | text      | 互動性                |
| created_at      | timestamp |                       |
| updated_at      | timestamp |                       |

#### workflow_settings

| Column                | Type      | Description           |
| --------------------- | --------- | --------------------- |
| id                    | uuid      | Primary key           |
| website_id            | uuid      | FK to website_configs |
| serp_analysis_enabled | boolean   |                       |
| competitor_count      | int       |                       |
| content_length_min    | int       |                       |
| content_length_max    | int       |                       |
| keyword_density_min   | decimal   |                       |
| keyword_density_max   | decimal   |                       |
| quality_threshold     | int       |                       |
| auto_publish          | boolean   |                       |
| serp_model            | text      |                       |
| content_model         | text      |                       |
| meta_model            | text      |                       |
| created_at            | timestamp |                       |
| updated_at            | timestamp |                       |

#### keywords

| Column        | Type      | Description           |
| ------------- | --------- | --------------------- |
| id            | uuid      | Primary key           |
| website_id    | uuid      | FK to website_configs |
| keyword       | text      | 關鍵字                |
| region        | text      | 地區                  |
| search_volume | int       |                       |
| difficulty    | int       |                       |
| status        | text      |                       |
| priority      | int       |                       |
| created_at    | timestamp |                       |
| last_used_at  | timestamp |                       |

### 更新 website_configs

新增欄位：

- `wp_username` text
- `wp_app_password` text (encrypted)
- `wp_enabled` boolean
- `language` text

## 前端頁面架構

### 1. 網站設定頁面

```
/dashboard/[companyId]/websites/[websiteId]/settings
├── 基本資訊 (site_url, site_name, language)
├── WordPress 整合 (username, app_password)
└── API 金鑰
```

### 2. 品牌聲音設定

```
/dashboard/[companyId]/websites/[websiteId]/brand-voice
├── 語調設定
├── 目標受眾
├── 品牌詞彙管理
├── 句式風格
└── 互動性設定
```

### 3. 工作流設定

```
/dashboard/[companyId]/websites/[websiteId]/workflow
├── SERP 分析設定
├── 內容長度和密度
├── 品質門檻
├── 自動發布選項
└── AI 模型選擇
```

### 4. 關鍵字管理

```
/dashboard/[companyId]/websites/[websiteId]/keywords
├── 關鍵字列表（表格）
├── 新增關鍵字（批次導入）
├── 優先級設定
└── 使用狀態追蹤
```

## 執行流程（Platform 原生）

### 文章生成流程

```typescript
async function generateArticle(articleJobId: string) {
  // 1. 載入配置
  const config = await loadConfigurations(articleJobId);

  // 2. SERP 分析（可選）
  let serpData = null;
  if (config.workflow.serp_analysis_enabled) {
    serpData = await serpAnalysisService.analyze(
      config.keyword,
      config.region,
      config.workflow.serp_model,
    );
    await updateJobStage(articleJobId, "serp_analysis", serpData);
  }

  // 3. 內容策略規劃
  const contentPlan = await contentStrategyService.plan({
    keyword: config.keyword,
    serpData,
    brandVoice: config.brandVoice,
    model: config.workflow.content_model,
  });
  await updateJobStage(articleJobId, "content_plan", contentPlan);

  // 4. 獲取舊文章（內部連結用）
  const previousArticles = await getPreviousArticles(config.website_id);

  // 5. 文章撰寫
  const article = await contentGenerationService.generate({
    contentPlan,
    previousArticles,
    brandVoice: config.brandVoice,
    model: config.workflow.content_model,
  });
  await updateJobStage(articleJobId, "content_generation", article);

  // 6. 生成 SEO 元數據
  const meta = await metaGenerationService.generate({
    content: article.markdown,
    keyword: config.keyword,
    model: config.workflow.meta_model,
  });

  // 7. 品質檢查
  const qualityReport = await qualityCheckService.check({
    content: article.html,
    keyword: config.keyword,
    settings: config.workflow,
  });
  await updateJobStage(articleJobId, "quality_check", qualityReport);

  // 8. 發布（如果通過品質檢查且啟用自動發布）
  if (qualityReport.passed && config.workflow.auto_publish) {
    const wpPost = await wordpressService.publish({
      title: meta.title,
      content: article.html,
      slug: meta.slug,
      excerpt: meta.description,
      websiteConfig: config.website,
    });
    await updateJobStage(articleJobId, "wordpress_publish", wpPost);
  }

  return { success: true, qualityReport };
}
```

## N8N 整合（選用）

保留 N8N 整合作為高級功能：

- 自定義工作流
- 複雜的條件邏輯
- 第三方服務整合（Google Sheets, Airtable 等）
- 定時自動執行

Platform 會檢查：

1. 是否有 N8N webhook URL
2. 用戶是否啟用 N8N 模式
3. 如果啟用，則觸發 N8N；否則使用 Platform 原生服務

## 遷移計劃

### Phase 1: 資料庫 Schema（當前階段）

- [ ] 創建 migration 檔案
- [ ] 新增 brand_voices table
- [ ] 新增 workflow_settings table
- [ ] 新增 keywords table
- [ ] 更新 website_configs table

### Phase 2: 後端服務

- [ ] 實現 SERP 分析服務
- [ ] 實現內容策略服務
- [ ] 實現內容生成服務
- [ ] 實現品質檢查服務
- [ ] 實現 WordPress 發布服務

### Phase 3: API Routes

- [ ] 實現 /api/seo/generate
- [ ] 實現配置相關 CRUD APIs

### Phase 4: 前端頁面

- [ ] 品牌聲音設定頁面
- [ ] 工作流設定頁面
- [ ] 關鍵字管理頁面
- [ ] 文章生成進度 UI

### Phase 5: 整合測試

- [ ] 端到端測試
- [ ] 與 N8N 的相容性測試
