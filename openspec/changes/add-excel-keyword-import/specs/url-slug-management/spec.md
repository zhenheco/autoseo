# URL Slug 智慧管理系統

**Capability**: `url-slug-management`
**Version**: 1.0.0
**Status**: 提案中

## 概述

實作平台無關的 URL Slug 管理系統，支援自動生成 SEO 友善的 slug、中文拼音轉換、唯一性保證，並使用「網域 + slug」模式組裝URL，確保跨平台相容性和內部連結可預測性。

---

## ADDED Requirements

### Requirement: SEO 友善的 Slug 自動生成

系統 MUST 根據文章標題或關鍵字自動生成符合 SEO 最佳實踐的 slug。

**SEO 最佳實踐（2025）**:
- ✅ 使用小寫字母
- ✅ 用連字號（-）分隔單字，不用底線
- ✅ 保持簡短（3-6 個有意義的單字，最長 60 字元）
- ✅ 包含主要關鍵字一次
- ✅ 避免日期、ID、停用詞（的、是、在等）
- ✅ 避免特殊字元和空格

#### Scenario: 從英文標題生成 slug

**Given** 文章標題為「5 Best Next.js Tutorial Tips」
**When** 系統生成 slug
**Then** 系統提取關鍵字「next-js-tutorial-tips」
**And** 系統移除停用詞「best」（可選）
**And** 系統轉換為小寫「nextjs-tutorial-tips」
**And** 系統控制長度在 60 字元內

#### Scenario: 從中文標題生成 slug（拼音模式）

**Given** 文章標題為「5個 Next.js 教學技巧讓你快速上手」
**And** Slug 策略設定為「拼音」
**When** 系統生成 slug
**Then** 系統提取中文關鍵字「Next.js 教學技巧」
**And** 系統將中文轉為拼音「nextjs-jiaoxue-jiqiao」
**And** 系統移除停用詞「你」、「讓」
**And** 最終 slug 為「nextjs-jiaoxue-jiqiao」

#### Scenario: 從中文標題生成 slug（英文模式）

**Given** 文章標題為「React 和 Vue 框架比較」
**And** Slug 策略設定為「英文」
**When** 系統使用 AI 提取英文關鍵字
**Then** AI 建議 slug 為「react-vs-vue-comparison」
**And** 系統驗證格式正確
**And** 系統儲存該 slug

#### Scenario: 控制 Slug 長度

**Given** 生成的 slug 為「5-ge-zuiyou-de-nextjs-jiaoxue-jiqiao-rang-ni-kuaisu-shangshang」（65 字元）
**When** 系統檢查長度超過 60 字元
**Then** 系統智慧截斷至「5-ge-zuiyou-de-nextjs-jiaoxue-jiqiao-rang-ni」（60 字元）
**And** 系統確保不在單字中間截斷（保留完整單字）

---

### Requirement: 中文拼音轉換

系統 MUST 提供準確的中文拼音轉換功能，處理多音字和常見詞彙。

**技術選型**:
- 使用 `pinyin-pro` 套件（處理多音字）
- 建立常用詞彙對照表（優化準確率）

#### Scenario: 正確處理多音字

**Given** 關鍵字包含「重慶」
**When** 系統轉換為拼音
**Then** 系統正確識別為「chongqing」而非「zhongqing」
**And** 系統使用詞彙對照表優先匹配

#### Scenario: 處理專業術語

**Given** 關鍵字包含「數據庫」
**When** 系統轉換為拼音
**Then** 系統轉換為「shujuku」
**And** 系統可選使用英文替代「database」（若配置）

#### Scenario: 處理特殊字元

**Given** 關鍵字為「C++ 編程教學」
**When** 系統生成 slug
**Then** 系統保留「cpp」並轉換「編程教學」為「biancheng-jiaoxue」
**And** 最終 slug 為「cpp-biancheng-jiaoxue」

---

### Requirement: Slug 唯一性保證

系統 MUST 確保同一網站內的 slug 絕對唯一，避免 URL 衝突。

**唯一性策略**:
1. 資料庫層級：`UNIQUE (website_id, slug)` 約束
2. 應用層級：插入前檢查 + 自動調整
3. 衝突解決：遞增數字後綴

#### Scenario: Slug 不衝突直接使用

**Given** 網站 A 的 slug「nextjs-tutorial」不存在
**When** 系統檢查唯一性
**Then** 系統直接使用該 slug
**And** 系統在資料庫中插入記錄

#### Scenario: Slug 衝突自動調整

**Given** 網站 A 已存在 slug「nextjs-tutorial」
**And** 新文章嘗試使用相同 slug
**When** 系統檢查唯一性
**Then** 系統偵測到衝突
**And** 系統生成新 slug「nextjs-tutorial-2」
**And** 系統再次檢查唯一性
**And** 若仍衝突則繼續遞增「nextjs-tutorial-3」

#### Scenario: 跨網站 Slug 隔離

**Given** 網站 A 已有 slug「nextjs-tutorial」
**And** 網站 B 嘗試使用相同 slug
**When** 系統檢查唯一性
**Then** 系統允許使用（不同 website_id）
**And** 兩個網站可以有相同的 slug

---

### Requirement: 自訂 Slug 支援

系統 MUST 支援使用者從 Excel 或介面手動輸入自訂 slug。

#### Scenario: 從 Excel 讀取自訂 Slug

**Given** Excel 包含自訂 slug 欄位
**And** 某行的 slug 為「my-custom-article-url」
**When** 系統解析 Excel
**Then** 系統驗證 slug 格式正確（小寫、連字號、無特殊字元）
**And** 系統檢查唯一性
**And** 若通過驗證則使用該 slug

#### Scenario: 自訂 Slug 格式錯誤

**Given** 使用者輸入 slug「My Article URL!」
**When** 系統驗證格式
**Then** 系統偵測到錯誤（大寫、空格、特殊字元）
**And** 系統顯示錯誤訊息「Slug 必須為小寫，使用連字號分隔，不含特殊字元」
**And** 系統提供修正建議「my-article-url」

#### Scenario: 自訂 Slug 衝突

**Given** 使用者輸入 slug「nextjs-tutorial」
**And** 該 slug 已存在於同網站
**When** 系統檢查唯一性
**Then** 系統顯示警告「此 slug 已被使用」
**And** 系統提供替代建議「nextjs-tutorial-2」
**And** 使用者可選擇接受建議或輸入新 slug

---

### Requirement: URL 組裝與預覽

系統 MUST 使用「base_url + slug」模式組裝完整 URL，並在發佈前提供預覽。

**URL 格式**:
```
{base_url}/{slug_prefix}{slug}
```

範例：
- `https://blog.example.com/nextjs-tutorial`
- `https://blog.example.com/posts/nextjs-tutorial`（有前綴）

#### Scenario: 組裝基本 URL

**Given** 網站基礎 URL 為「https://blog.example.com」
**And** Slug 為「nextjs-tutorial」
**And** 無 slug 前綴
**When** 系統組裝 URL
**Then** 完整 URL 為「https://blog.example.com/nextjs-tutorial」
**And** 系統儲存到 `published_url` 欄位

#### Scenario: 組裝帶前綴的 URL

**Given** 網站基礎 URL 為「https://example.com」
**And** Slug 前綴為「/blog/」
**And** Slug 為「nextjs-tutorial」
**When** 系統組裝 URL
**Then** 完整 URL 為「https://example.com/blog/nextjs-tutorial」

#### Scenario: 發佈前預覽 URL

**Given** 使用者在發佈計畫列表頁面
**When** 系統顯示列表
**Then** 每一行顯示「預覽 URL」欄位
**And** 預覽 URL 為組裝後的完整 URL
**And** URL 以可點擊連結顯示（開啟新視窗）
**And** 點擊後顯示提示「文章尚未發佈」

---

### Requirement: 平台發佈適配

系統 MUST 在發佈到不同平台時使用預定義的 slug，並驗證實際 URL。

#### Scenario: WordPress 發佈使用預定義 Slug

**Given** 文章 slug 為「nextjs-tutorial」
**And** 發佈目標為 WordPress
**When** 系統呼叫 WordPress API
**Then** 系統傳遞 slug 參數：`{ slug: 'nextjs-tutorial' }`
**And** WordPress 使用該 slug 建立文章
**And** WordPress 回傳的 URL 應為「https://blog.example.com/nextjs-tutorial」

#### Scenario: 發佈後 URL 驗證

**Given** 預期 URL 為「https://blog.example.com/nextjs-tutorial」
**And** WordPress 發佈後回傳 URL「https://blog.example.com/nextjs-tutorial/」（多了斜線）
**When** 系統驗證 URL
**Then** 系統正規化 URL（移除末尾斜線）
**And** 系統確認兩者一致
**And** 系統儲存正規化的 URL

#### Scenario: URL 不一致處理

**Given** 預期 URL 為「https://blog.example.com/nextjs-tutorial」
**And** WordPress 因 slug 衝突自動調整為「nextjs-tutorial-2」
**And** 回傳 URL 為「https://blog.example.com/nextjs-tutorial-2」
**When** 系統偵測到不一致
**Then** 系統記錄警告日誌
**And** 系統更新資料庫的 slug 為「nextjs-tutorial-2」
**And** 系統更新 published_url 為實際 URL
**And** 系統通知使用者「URL 已自動調整」

---

### Requirement: Slug 批次處理與效能優化

系統 MUST 高效處理大量 slug 生成和唯一性檢查。

#### Scenario: 批次生成 500 個 Slug

**Given** 使用者匯入 500 個計畫
**When** 系統批次生成 slug
**Then** 系統使用批次查詢取得所有現有 slug（一次 DB 查詢）
**And** 系統在記憶體中建立 slug Set
**And** 系統並行處理 slug 生成（Worker threads）
**And** 系統在 10 秒內完成所有 slug 生成

#### Scenario: 快取拼音轉換結果

**Given** 系統需要轉換常用詞彙「教學」為拼音
**When** 首次轉換
**Then** 系統執行拼音轉換並快取結果
**And** 後續相同詞彙直接從快取取得
**And** 快取命中率達到 60% 以上

---

## MODIFIED Requirements

### 整合內部連結系統

本功能擴展內部連結使用 slug 而非完整 URL。

**內部連結格式**:
```html
<!-- 相對路徑（推薦） -->
<a href="/nextjs-tutorial">Next.js 教學指南</a>

<!-- 絕對路徑（可選） -->
<a href="https://blog.example.com/nextjs-tutorial">Next.js 教學指南</a>
```

**配置選項** (`website_configs.url_strategy`):
- `relative`: 使用相對路徑（預設，更靈活）
- `absolute`: 使用絕對路徑（SEO 專家建議）

---

## 技術規格

### 資料庫 Schema

```sql
-- article_jobs 表
ALTER TABLE article_jobs ADD COLUMN
  slug TEXT NOT NULL,
  slug_strategy TEXT DEFAULT 'auto' CHECK (slug_strategy IN ('auto', 'pinyin', 'english', 'custom')),
  published_url TEXT,
  CONSTRAINT unique_website_slug UNIQUE (website_id, slug);

-- website_configs 表
ALTER TABLE website_configs ADD COLUMN
  base_url TEXT NOT NULL DEFAULT '',
  slug_prefix TEXT DEFAULT '',
  url_strategy TEXT DEFAULT 'relative' CHECK (url_strategy IN ('relative', 'absolute')),
  default_slug_strategy TEXT DEFAULT 'auto';

-- 索引
CREATE INDEX idx_article_jobs_website_slug ON article_jobs(website_id, slug);
CREATE INDEX idx_published_articles ON article_jobs(website_id, slug)
  WHERE status = 'published';
```

### API 實作

**新增服務**:
```typescript
// @/lib/services/slug-generator.ts
class SlugGenerator {
  generate(text: string, strategy: SlugStrategy): string
  generateFromPinyin(chineseText: string): string
  generateFromEnglish(text: string): string
  sanitize(slug: string): string
  truncate(slug: string, maxLength: number): string
  ensureUnique(baseSlug: string, websiteId: string): Promise<string>
}

// @/lib/services/url-builder.ts
class URLBuilder {
  buildPublishedUrl(baseUrl: string, slug: string, prefix?: string): string
  buildInternalLink(targetSlug: string, strategy: 'relative' | 'absolute', baseUrl?: string): string
  normalize(url: string): string
}
```

### NPM 套件選擇

```json
{
  "dependencies": {
    "slugify": "^1.6.6",           // Slug 格式化
    "pinyin-pro": "^3.18.3",       // 中文拼音轉換
    "string-similarity": "^4.0.4"  // 字串相似度（唯一性檢查）
  }
}
```

### Slug 生成策略實作

```typescript
const SlugStrategies = {
  auto: (text: string) => {
    const hasChinese = /[\u4e00-\u9fa5]/.test(text);
    return hasChinese
      ? SlugStrategies.pinyin(text)
      : SlugStrategies.english(text);
  },

  pinyin: (text: string) => {
    const pinyinText = pinyin(text, { toneType: 'none' });
    return slugify(pinyinText, { lower: true, strict: true });
  },

  english: (text: string) => {
    return slugify(text, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });
  },

  custom: (text: string) => {
    // 使用者提供，僅驗證格式
    return text;
  }
};
```

---

## 相依性

- **前端**:
  - Excel 解析：`xlsx`
  - 表格顯示：`@tanstack/react-table`
- **後端**:
  - Slug 生成：`slugify`, `pinyin-pro`
  - 資料庫：Supabase PostgreSQL
- **整合**:
  - WordPress API（發佈時傳遞 slug）
  - 內部連結系統（使用 slug 建立連結）

---

## 測試考量

### 單元測試
- [ ] 測試不同語言的 slug 生成（中文、英文、混合）
- [ ] 測試拼音轉換準確性（多音字、常用詞）
- [ ] 測試唯一性衝突解決邏輯
- [ ] 測試 URL 組裝（有無前綴、正規化）
- [ ] 測試 slug 長度控制和截斷

### 整合測試
- [ ] 測試批次 slug 生成效能（500+ 計畫）
- [ ] 測試 WordPress 發佈 slug 傳遞
- [ ] 測試 URL 驗證和自動調整
- [ ] 測試內部連結使用 slug

### 效能測試
- [ ] 批次生成 500 個 slug 在 10 秒內完成
- [ ] 唯一性檢查在 100ms 內完成（單個）
- [ ] 拼音轉換快取命中率 > 60%

---

## 錯誤處理

### Slug 生成失敗
- 使用關鍵字作為後備
- 若仍失敗則使用 UUID 短碼

### Slug 衝突無法解決
- 使用時間戳記後綴
- 記錄錯誤並通知使用者

### URL 不一致
- 自動更新資料庫
- 記錄警告日誌
- 提供手動同步功能

### 拼音轉換錯誤
- 回退到簡單音譯
- 允許使用者手動修正
