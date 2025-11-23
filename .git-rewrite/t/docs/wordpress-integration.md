# WordPress REST API 整合指南

本文檔說明如何在 Auto Pilot SEO 中整合 WordPress REST API，實現文章自動發布功能。

## 目錄

- [功能概述](#功能概述)
- [認證方式](#認證方式)
- [環境配置](#環境配置)
- [使用方式](#使用方式)
- [測試指南](#測試指南)
- [故障排除](#故障排除)

---

## 功能概述

WordPress REST API 整合提供以下功能：

### ✅ 自動發布文章

- 一鍵生成並發布文章到 WordPress
- 自動處理 HTML 格式轉換
- 支援草稿和發布兩種模式

### ✅ 圖片管理

- 自動上傳圖片到 WordPress Media Library
- 設定 featured image（精選圖片）
- 圖片 alt text 和 caption 自動設定

### ✅ 分類和標籤

- 自動創建或使用現有分類
- 自動創建或使用現有標籤
- 智能匹配現有 taxonomy

### ✅ SEO 優化

- 支援 Yoast SEO 外掛
- 自動設定 Meta Title 和 Meta Description
- 設定 Focus Keyword
- OpenGraph 和 Twitter Card 支援

---

## 認證方式

WordPress REST API 支援三種認證方式，按推薦順序排列：

### 1. JWT 認證（最推薦）⭐

**特點：**

- 最安全的認證方式
- Token 有效期可控
- 支援 Token 刷新

**安裝步驟：**

1. 在 WordPress 安裝 [JWT Authentication for WP REST API](https://wordpress.org/plugins/jwt-authentication-for-wp-rest-api/) 外掛

2. 在 `wp-config.php` 添加：

```php
define('JWT_AUTH_SECRET_KEY', 'your-secret-key-here');
define('JWT_AUTH_CORS_ENABLE', true);
```

3. 使用 API 獲取 Token：

```typescript
const response = await fetch(
  "https://your-site.com/wp-json/jwt-auth/v1/token",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "your-username",
      password: "your-password",
    }),
  },
);

const { token } = await response.json();
```

4. 在環境變數中設定：

```env
WORDPRESS_JWT_TOKEN=your-jwt-token-here
```

### 2. Application Password（推薦）✅

**特點：**

- 簡單易用
- 不需要安裝外掛
- WordPress 5.6+ 內建支援

**設定步驟：**

1. 登入 WordPress 後台
2. 前往「使用者」→「個人資料」
3. 捲動到「應用程式密碼」區塊
4. 輸入名稱（例如：Auto Pilot SEO）
5. 點擊「新增應用程式密碼」
6. 複製生成的密碼（格式：xxxx xxxx xxxx xxxx）

7. 在環境變數中設定：

```env
WORDPRESS_URL=https://your-site.com
WORDPRESS_USERNAME=your-username
WORDPRESS_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

### 3. OAuth 2.0（進階）

**特點：**

- 企業級認證
- 適合多用戶場景
- 需要額外配置

**安裝步驟：**

1. 在 WordPress 安裝 OAuth 外掛（如 [WP OAuth Server](https://wordpress.org/plugins/oauth2-provider/)）
2. 創建 OAuth 應用並獲取 Client ID 和 Client Secret
3. 實作 OAuth 流程獲取 Access Token

---

## 環境配置

### 1. 基本配置

在 `.env` 或 `.env.local` 中添加：

```env
# WordPress 網站 URL
WORDPRESS_URL=https://your-wordpress-site.com

# 使用 Application Password 認證（推薦）
WORDPRESS_USERNAME=your-username
WORDPRESS_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# 或使用 JWT 認證
# WORDPRESS_JWT_TOKEN=your-jwt-token-here
```

### 2. 資料庫配置

在 `website_configs` 表中配置 WordPress 連接資訊：

```sql
UPDATE website_configs
SET
  wordpress_url = 'https://your-site.com',
  wordpress_username = 'your-username',
  wordpress_password = 'xxxx-xxxx-xxxx-xxxx', -- Application Password
  status = 'active'
WHERE id = 'your-website-id';
```

### 3. Workflow 配置

在 `workflow_settings` 表中啟用自動發布：

```sql
UPDATE workflow_settings
SET
  auto_publish = true -- 設為 false 則只創建草稿
WHERE website_id = 'your-website-id';
```

---

## 使用方式

### 方式一：透過 Orchestrator 自動發布

Orchestrator 會在文章生成完成後自動發布到 WordPress：

```typescript
import { ParallelOrchestrator } from "@/lib/agents/orchestrator";

const orchestrator = new ParallelOrchestrator();

const result = await orchestrator.execute({
  articleJobId: "job-id",
  companyId: "company-id",
  websiteId: "website-id",
  keyword: "AI 內容生成",
  region: "zh-TW",
});

if (result.wordpress) {
  console.log("文章已發布！");
  console.log("文章 ID:", result.wordpress.postId);
  console.log("文章連結:", result.wordpress.postUrl);
}
```

### 方式二：直接使用 WordPress Client

```typescript
import { WordPressClient } from "@/lib/wordpress/client";

const client = new WordPressClient({
  url: process.env.WORDPRESS_URL!,
  username: process.env.WORDPRESS_USERNAME!,
  applicationPassword: process.env.WORDPRESS_APP_PASSWORD!,
});

// 發布完整文章
const result = await client.publishArticle(
  {
    title: "文章標題",
    content: "<p>文章內容 HTML</p>",
    excerpt: "文章摘要",
    slug: "article-slug",
    featuredImageUrl: "https://example.com/image.jpg",
    categories: ["技術", "AI"],
    tags: ["機器學習", "自動化"],
    seoTitle: "SEO 標題",
    seoDescription: "SEO 描述",
    focusKeyword: "AI 內容",
  },
  "publish",
); // 或 'draft'
```

### 方式三：使用 PublishAgent

```typescript
import { PublishAgent } from "@/lib/agents/publish-agent";

const publishAgent = new PublishAgent(aiConfig, context);

const result = await publishAgent.execute({
  title: "文章標題",
  content: "<p>文章內容</p>",
  excerpt: "摘要",
  wordpressConfig: {
    url: process.env.WORDPRESS_URL!,
    username: process.env.WORDPRESS_USERNAME!,
    applicationPassword: process.env.WORDPRESS_APP_PASSWORD!,
  },
  publishStatus: "publish", // 或 'draft'
});
```

---

## 測試指南

### 測試 1：基本 API 連接測試

```bash
npm run test:wordpress
# 或
./scripts/load-env.sh npx tsx scripts/test-wordpress-publish.ts
```

**測試內容：**

- WordPress REST API 認證
- 獲取現有分類和標籤
- 創建草稿文章
- 驗證 HTML 格式

**預期結果：**

```
✅ WordPress REST API 發布測試

✓ 環境變數檢查通過
✓ 找到 5 個分類
✓ 找到 10 個標籤
✓ 分類 IDs: 1, 2, 3
✓ 標籤 IDs: 5, 6, 7
✓ 文章創建成功！
  - 文章 ID: 123
  - 文章連結: https://your-site.com/?p=123
  - 狀態: draft

請前往 WordPress 查看草稿文章：
https://your-site.com/?p=123
```

### 測試 2：完整工作流測試

```bash
./scripts/load-env.sh npx tsx scripts/test-full-workflow-with-wordpress.ts
```

**測試內容：**

- 完整的 8 階段文章生成流程
- 包含 WordPress 自動發布
- 品質檢查驗證
- 執行時間統計

**預期結果：**

```
=== 完整工作流測試（含 WordPress 發布）===

✓ 環境變數檢查通過
✓ 測試公司: Test Company (xxx-xxx)
✓ 使用現有網站: My WordPress Site
✓ 文章任務 ID: xxx-xxx
✓ Orchestrator 已初始化

執行完整文章生成流程...
  1. 研究分析 (Research) ✓
  2. 策略規劃 (Strategy) ✓
  3. 內容撰寫 (Writing) + 圖片生成 (Image) ✓
  4. SEO 元數據 (Meta) ✓
  5. HTML 優化 (HTML) ✓
  6. 品質檢查 (Quality) ✓
  7. 分類標籤 (Category) ✓
  8. WordPress 發布 (Publish) ✓

✅ 文章生成成功！

執行結果:
  - 總執行時間: 45.23s
  - 品質分數: 85/100

WordPress 發布結果:
  ✓ 文章 ID: 456
  ✓ 文章連結: https://your-site.com/ai-content-generation/
  ✓ 狀態: publish

請前往 WordPress 查看文章顯示效果
```

### 驗證清單

前往 WordPress 檢查以下項目：

- [ ] **標題顯示**：H1, H2, H3 層級是否正確
- [ ] **段落格式**：段落間距是否適當
- [ ] **列表格式**：有序和無序列表是否正確
- [ ] **表格顯示**：表格是否響應式
- [ ] **圖片顯示**：
  - [ ] 精選圖片是否正確
  - [ ] 內文圖片是否正確顯示
  - [ ] 圖片是否有 alt text
  - [ ] 圖片是否 lazy loading
- [ ] **連結功能**：
  - [ ] 內部連結是否有效
  - [ ] 外部連結是否開新視窗
- [ ] **SEO 設定**（如使用 Yoast SEO）：
  - [ ] Focus Keyword 是否設定
  - [ ] Meta Title 是否正確
  - [ ] Meta Description 是否正確
- [ ] **分類標籤**：是否正確設定

---

## 故障排除

### 問題 1：認證失敗

**錯誤訊息：**

```
WordPress API 錯誤: 401 - Unauthorized
```

**解決方法：**

1. 檢查 Application Password 是否正確（包含所有破折號）
2. 確認使用者名稱正確（不是顯示名稱）
3. 確認 WordPress 版本 ≥ 5.6（支援 Application Password）
4. 檢查 WordPress 是否啟用 REST API

**驗證 REST API：**

```bash
curl https://your-site.com/wp-json/wp/v2/posts
```

### 問題 2：CORS 錯誤

**錯誤訊息：**

```
Access to fetch blocked by CORS policy
```

**解決方法：**

在 WordPress 的 `functions.php` 或外掛中添加：

```php
add_action('rest_api_init', function() {
  remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
  add_filter('rest_pre_serve_request', function($value) {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    return $value;
  });
}, 15);
```

### 問題 3：SSL 憑證錯誤

**錯誤訊息：**

```
self signed certificate in certificate chain
```

**解決方法（開發環境）：**

```typescript
// 僅在開發環境使用
if (process.env.NODE_ENV === "development") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}
```

**生產環境建議：**

- 使用有效的 SSL 憑證（Let's Encrypt）
- 不要停用 SSL 驗證

### 問題 4：圖片上傳失敗

**錯誤訊息：**

```
上傳媒體失敗: 413 - Request Entity Too Large
```

**解決方法：**

1. 增加 WordPress 上傳限制：

在 `wp-config.php` 添加：

```php
@ini_set('upload_max_size', '64M');
@ini_set('post_max_size', '64M');
@ini_set('max_execution_time', '300');
```

2. 修改 `.htaccess`：

```apache
php_value upload_max_filesize 64M
php_value post_max_size 64M
php_value max_execution_time 300
```

### 問題 5：HTML 被過濾

**現象：**

- 某些 HTML 標籤被移除
- 樣式屬性消失

**解決方法：**

確保 WordPress 允許這些 HTML：

```php
// 在 functions.php 中添加
add_filter('wp_kses_allowed_html', function($tags, $context) {
  if ($context === 'post') {
    $tags['table'] = array('class' => true, 'style' => true);
    $tags['img'] = array(
      'src' => true,
      'alt' => true,
      'class' => true,
      'style' => true,
      'loading' => true
    );
  }
  return $tags;
}, 10, 2);
```

### 問題 6：分類或標籤創建失敗

**錯誤訊息：**

```
創建分類失敗: 403 - Forbidden
```

**解決方法：**

1. 檢查使用者權限：
   - 需要 `edit_posts` 權限
   - 需要 `manage_categories` 權限（創建分類）
   - 需要 `manage_post_tags` 權限（創建標籤）

2. 確認 Application Password 的使用者角色：
   - 建議使用「管理員」或「編輯者」角色
   - 「作者」角色無法創建分類和標籤

---

## 效能優化建議

### 1. 圖片優化

在上傳前壓縮圖片：

```typescript
import sharp from "sharp";

async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  return await sharp(buffer)
    .resize(1200, 800, { fit: "inside" })
    .jpeg({ quality: 80 })
    .toBuffer();
}
```

### 2. 批量操作

批量創建分類和標籤時使用 `ensureTaxonomies()`：

```typescript
const { categoryIds, tagIds } = await client.ensureTaxonomies(
  ["分類1", "分類2", "分類3"],
  ["標籤1", "標籤2", "標籤3"],
);
```

### 3. 快取機制

快取 WordPress 分類和標籤列表：

```typescript
let cachedCategories: Category[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 分鐘

async function getCategories(): Promise<Category[]> {
  if (cachedCategories && Date.now() - cacheTime < CACHE_DURATION) {
    return cachedCategories;
  }

  cachedCategories = await client.getCategories();
  cacheTime = Date.now();
  return cachedCategories;
}
```

### 4. 錯誤重試

實作自動重試機制：

```typescript
async function publishWithRetry(
  data: PublishData,
  maxRetries = 3,
): Promise<WordPressPost> {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.publishArticle(data);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  throw lastError;
}
```

---

## 安全性最佳實踐

### 1. 環境變數保護

- ✅ 使用 `.env.local` 儲存敏感資訊
- ✅ 將 `.env.local` 加入 `.gitignore`
- ❌ 不要將密碼硬編碼在程式碼中
- ❌ 不要將 `.env.local` 提交到 Git

### 2. 密碼管理

- ✅ 使用 Application Password 而非實際密碼
- ✅ 定期更換 Application Password
- ✅ 為每個應用建立獨立的 Application Password
- ❌ 不要共用 Application Password

### 3. API 限流

實作 rate limiting：

```typescript
import pQueue from "p-queue";

const queue = new pQueue({
  interval: 1000, // 1 秒
  intervalCap: 10, // 最多 10 個請求
});

await queue.add(() => client.createPost(data));
```

### 4. 輸入驗證

在發布前驗證內容：

```typescript
function sanitizeHTML(html: string): string {
  // 移除危險的標籤和屬性
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["h1", "h2", "h3", "p", "ul", "ol", "li", "img", "table"],
    ALLOWED_ATTR: ["href", "src", "alt", "class", "id"],
  });
}
```

---

## 相關資源

### WordPress 文檔

- [WordPress REST API 官方文檔](https://developer.wordpress.org/rest-api/)
- [Application Passwords 指南](https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/)
- [JWT Authentication 外掛](https://wordpress.org/plugins/jwt-authentication-for-wp-rest-api/)

### 本專案文檔

- [CHANGELOG.md](../CHANGELOG.md) - 更新日誌
- [ROADMAP.md](../ROADMAP.md) - 開發路線圖
- [測試指南](../docs/testing-guide.md) - 測試流程說明

### 測試腳本

- `scripts/test-wordpress-publish.ts` - WordPress API 基本測試
- `scripts/test-full-workflow-with-wordpress.ts` - 完整工作流測試

---

## 支援與回饋

如遇到問題或有改進建議，請：

1. 查看本文檔的[故障排除](#故障排除)章節
2. 檢查 [GitHub Issues](https://github.com/your-repo/issues)
3. 查看 WordPress REST API 日誌
4. 聯繫開發團隊

---

**最後更新：2025-01-28**
