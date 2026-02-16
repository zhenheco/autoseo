# Writing Style Presets + Material Extractor 設計文件

> 日期：2026-02-16
> 狀態：待實作
> 版本：v2（經 3 位專家 agent 深度審查後修訂）
> 目標：讓文章生成支援多種寫作風格，並透過強化 Perplexity + WebFetch 補充抓取真實素材提升內容品質

---

## 1. 問題描述

### 現狀

目前文章生成系統產出的內容偏向 **SEO 工具文**風格：

- Answer-First（每段直接回答問題）
- 平鋪直敘、資訊密集
- 缺乏故事性、情感共鳴和具體案例
- Perplexity 研究只返回摘要，不包含原文中的真實故事、人物經歷、具體數據

### 目標風格參考

- **知乎高贊回答**：個人故事開場、口語化、先抑後揚、情感金句、短段落
- **商週專欄文章**：格言開場、自問自答推進、名人案例驅動、觀點導向

### 核心差距

| 層面             | 現狀                        | 目標               |
| ---------------- | --------------------------- | ------------------ |
| 怎麼寫（風格）   | 固定 SEO 工具文             | 可選的風格 preset  |
| 用什麼寫（素材） | Perplexity 摘要（缺乏細節） | 真實故事/數據/案例 |

---

## 2. 整體架構

### 新增兩個核心能力

**A. Writing Style Presets** — 控制「怎麼寫」

- 在 Brand Voice 設定中擴充 writing_style，新增 3 個風格 preset
- 每個 preset **完全替換**（非追加）各 Agent 的 Writing Rules
- 現有 SEO 工具文規則提取為隱含的 `default` preset

**B. Material Extractor** — 控制「用什麼素材寫」

- **Phase 0**：先強化 Perplexity prompt，要求返回具體人名、數字、案例經過
- **Phase 1**：只在 Perplexity 素材不足時，從 citation URLs 用 WebFetch 補充抓取
- AI 萃取結構化素材（故事、數據、金句、案例、專家）
- 素材以「角色化研究筆記」方式注入 Writing Agents

### 資料流（v2 修訂）

```
Phase 1: ResearchAgent（強化 Perplexity prompt，要求具體素材）
  → citations URLs + deepResearch（含具體故事/數據）
       ↓
Phase 2: Strategy + MaterialExtractor（平行執行）
  ├── StrategyAgent（依賴 Research）
  └── MaterialExtractor（依賴 Research.externalReferences）
       ├── 先評估 Perplexity 素材是否充足
       ├── 不足時：WebFetch 補充（用 Readability 提取正文）
       ├── AI 萃取結構化 MaterialsProfile
       └── 存入 job metadata（支援 resume）
       ↓
Phase 2.5: CompetitorAnalysis（與上方平行或串行）
       ↓
Phase 2.6: ContentPlanAgent（接收 preset + MaterialsProfile）
  └── 規劃文章結構（依 preset 調整）+ tag-based 素材分配
       ↓
Phase 3: Writing Agents（接收 preset rules + 章節素材子集）
  ├── IntroductionAgent（preset 開場策略 + Golden Paragraph）
  ├── SectionAgent × N（preset Writing Rules + Anti-Patterns + 素材）
  └── ConclusionAgent（preset 結尾風格）
```

### 觸發條件

MaterialExtractor 和 preset 為獨立開關：

```typescript
// 新 preset 自動啟用素材萃取
const shouldExtractMaterials = [
  "zhihuViral",
  "businessMedia",
  "deepAnalysis",
].includes(brandVoice.writing_style);

// 未來可擴展為獨立 UI 開關，讓原有 style 用戶也能啟用
```

---

## 3. Writing Style Presets 設計

### 3.1 Preset 清單

| Preset ID       | 內部名稱   | 核心特徵                                                                |
| --------------- | ---------- | ----------------------------------------------------------------------- |
| `default`       | （現有）   | Answer-First、統計引用、實體保留、自然關鍵字（現有 SEO 工具文規則）     |
| `zhihuViral`    | 故事敘事風 | 個人故事開場、口語化、先抑後揚、情感金句、短段落（2-4句）、用「你」對話 |
| `businessMedia` | 商業觀點風 | 格言/金句開場、自問自答推進、名人案例驅動、觀點導向、加粗重點句         |
| `deepAnalysis`  | 深度分析風 | 數據密集、多角度分析、嚴謹引用、結構層次分明、表格對比                  |

### 3.2 多語系 UI 命名（v2 修訂）

| Preset        | zh-TW      | en-US                    | ja-JP            | ko-KR         | de-DE              | es-ES                 | fr-FR               |
| ------------- | ---------- | ------------------------ | ---------------- | ------------- | ------------------ | --------------------- | ------------------- |
| zhihuViral    | 故事敘事風 | Conversational Narrative | 共感ナラティブ型 | 스토리텔링    | Erzahlerisch       | Narrativo             | Narratif            |
| businessMedia | 商業觀點風 | Business Editorial       | ビジネスコラム型 | 비즈니스 칼럼 | Business-Editorial | Editorial de negocios | Editorial business  |
| deepAnalysis  | 深度分析風 | Deep Analysis            | 深掘り分析型     | 심층 분석     | Tiefenanalyse      | Analisis profundo     | Analyse approfondie |

每個選項附帶描述文字（同步翻譯 7 語系）：

- 故事敘事風：「個人場景開場、短段落、口語化、金句收尾 — 如社群爆文」
- 商業觀點風：「觀點導向、名人案例、自問自答、摘要開頭 — 如商業專欄」
- 深度分析風：「數據驅動、多角度分析、專家引用、表格對比 — 如研究報告」

### 3.3 Preset 與現有 BrandVoice 的優先級

選了新 preset 時的優先級規則：

```
writing_style preset > tone_of_voice（preset 自帶語氣定義，tone_of_voice 被忽略）
target_audience      → 仍然生效（影響用詞深度）
brand_integration    → 仍然生效（品牌提及次數）
voice_examples       → 仍然生效（good/bad examples）
```

UI 上在選了新 preset 時顯示提示：「選擇風格模板後，語調設定將由模板決定」

### 3.4 Preset 區隔維度（v2 新增）

明確定義每個 preset 的核心差異，避免風格趨同：

| 維度     | zhihuViral           | businessMedia          | deepAnalysis             |
| -------- | -------------------- | ---------------------- | ------------------------ |
| 開場     | 個人/讀者場景        | 反直覺觀點/格言        | 統計數據/研究發現        |
| 案例類型 | 小人物/讀者可共鳴    | 名人/企業/大品牌       | 多方對比/學術            |
| 語氣     | 口語、「你」         | 觀點鮮明、「我認為」   | 嚴謹、第三人稱           |
| 段落節奏 | 極短（2-4句，≤80字） | 中等（觀點→案例→啟示） | 較長（論證充分，≤150字） |
| 情感元素 | 高（煽動、共鳴）     | 中（自信、說服）       | 低（客觀、理性）         |
| 格式特色 | 無表格、無摘要       | 加粗重點句、摘要       | 表格對比、引用           |
| 文章結構 | 起承轉合敘事弧       | 摘要→觀點→觀點→結論    | 現狀→分析→對比→展望      |

### 3.5 Preset Prompt 定義（v2 完整版：Rules + Anti-Patterns + Golden Paragraph + Fallback）

#### `zhihuViral`（故事敘事風）

**Introduction Agent — Opening Strategy:**

```
有素材時：用 MaterialsProfile 中的真實故事開場
  結構：場景設定（2-3 句）→ 問題揭示 → 「這篇文章會告訴你...」

無素材時：用讀者可辨識的具體情境開場
  技巧庫：
  1. Constructed Scenarios: 「想像你是一個剛入行的 PM，老闆突然要你...」
  2. Common Experience: 描述與主題相關的普遍挫折或突破
  3. Reader Projection: 「你可能正在想...」「你一定也遇過這種情況」
  ⚠️ 禁止捏造具體統計數據、公司名稱或專家引言
```

**Section Agent Writing Rules（完全替換 default rules）:**

```
## Writing Rules
1. **Story-First**: 每個 H2 用具體場景或真實故事切入，不要用定義或概念開頭
2. **Short Paragraphs**: 每段最多 80 字 / 4 句，製造閱讀節奏感
3. **Contrast & Tension**: 先說常見誤區，再揭示正確做法（先抑後揚）
4. **Direct Address**: 用「你」直接對話讀者
5. **Golden Quotes**: 每個 H2 結尾或轉折處放一句粗體精煉金句
6. **Specific over Abstract**: 用真實故事/案例/數據，不用模糊說法
7. **Emotional Hooks**: 適度使用情感煽動，製造「不看完會後悔」的感覺

## Anti-Patterns (NEVER do these)
- NEVER start a section with a dictionary definition or abstract concept
- NEVER use "根據研究顯示..." as the opening — use a personal scenario instead
- NEVER write paragraphs longer than 4 sentences
- NEVER use formal academic connectors like "此外"、"綜上所述" — use "但問題來了"、"你可能會想"
- NEVER present multiple perspectives objectively — take a clear stance

## Style Identity
Unlike business editorial: Use everyday people's stories, NOT celebrity cases
Unlike deep analysis: Use emotional hooks, NOT data-led openings
Unlike SEO content: Use conversational "你" address, NOT formal third-person
```

**Golden Paragraph（注入 Introduction + 第一個 Section）:**

```
<example_paragraph>
你有沒有想過，為什麼你每天加班到凌晨，績效卻始終是 B？

不是你不夠努力。是你根本搞錯了方向。

我之前帶過一個團隊，裡面有個工程師，每天第一個到、最後一個走。但他的 code review 通過率只有 40%。後來我跟他聊了一次，發現他花了 80% 的時間在「修 bug」，而不是「設計架構」。

**真正拉開差距的，從來不是工時，而是你把時間花在哪裡。**
</example_paragraph>

Match this style: short paragraphs, direct address with "你", contrast structure (misconception → truth), bold golden quote at the end.
```

**Conclusion Agent:**

```
結尾風格：情感升華 + 行動鼓勵
（例：「答應我，把這篇看完，然後真正去做。」）
```

---

#### `businessMedia`（商業觀點風）

**Introduction Agent — Opening Strategy:**

```
有素材時：用 MaterialsProfile 中的金句或反直覺觀點開場
  附加：開頭放 3 點精華摘要（模仿商週的摘要區塊）

無素材時：
  技巧庫：
  1. Industry Logic: 從第一原理推導洞察
  2. Pattern Recognition: 「這個現象背後的邏輯是...」
  3. Thought Experiments: 「如果把這個策略推到極致...」
  ⚠️ 禁止捏造具體營收數字、市占數據或具名案例
```

**Section Agent Writing Rules（完全替換 default rules）:**

```
## Writing Rules
1. **Insight Opening**: 每個 H2 用反直覺觀點或格言開場
2. **Self-Q&A Flow**: 用「為什麼這麼說？」「這代表什麼？」推進論述
3. **Celebrity Cases**: 優先使用名人/企業案例，帶具體數字（年份、金額、排名）
4. **Bold Key Sentences**: 每段核心觀點用粗體標記
5. **Opinionated Stance**: 明確表達立場（「我認為...」「真正的關鍵在於...」）
6. **Structured Arguments**: 觀點 → 案例佐證 → 延伸啟示（三段式）
7. **Bullet Summaries**: 每個 H2 開頭或結尾提供重點摘要

## Anti-Patterns (NEVER do these)
- NEVER start without a provocative claim or quote
- NEVER present information without an opinionated stance
- NEVER use passive voice for key arguments
- NEVER omit specific numbers (year, amount, ranking) when citing cases
- NEVER use emotional exclamations — maintain authoritative confidence

## Style Identity
Unlike storytelling: Use celebrity/enterprise cases, NOT everyday scenarios
Unlike deep analysis: Lead with opinions, NOT neutral multi-perspective analysis
Unlike SEO content: Use "我認為" first-person authority, NOT generic "experts say"
```

**Golden Paragraph:**

```
<example_paragraph>
認為現在錢難賺，是因為你活在過去的成功裡。

為什麼這麼說？你看雷軍，在金山磨了 16 年，42 歲才創辦小米。很多人只看到小米上市那天的風光，卻忽略了他在金山時期經歷的數次瀕臨倒閉。

**但真正讓雷軍逆轉的，不是運氣，而是他花了 16 年想明白一件事：順勢而為。**

小米用了不到 10 年，做到全球第三、歐洲第二。這不是偶然。
</example_paragraph>

Match this style: provocative opening, self-Q&A flow, celebrity case with specific numbers, bold key insight.
```

**Conclusion Agent:**

```
結尾風格：觀點總結 + 格言收尾
（例：「底層邏輯決定了你的天花板。」）
```

---

#### `deepAnalysis`（深度分析風）

**Introduction Agent — Opening Strategy:**

```
有素材時：用 MaterialsProfile 中的統計數據開場
  結構：數據 → 趨勢解讀 → 本文分析框架

無素材時：
  技巧庫：
  1. Framework Analysis: 套用 SWOT、波特五力等經典框架
  2. Logical Deduction: 從公認事實推導論點
  3. Comparative Reasoning: 與類似產業/歷史先例對比
  明確標示：「雖然目前缺乏具體數據，但從產業趨勢可以推論...」
```

**Section Agent Writing Rules（完全替換 default rules）:**

```
## Writing Rules
1. **Data-Led Opening**: 每個 H2 用具體統計數據或研究發現開場
2. **Multi-Perspective**: 每個議題呈現 2-3 種不同觀點，再給出分析結論
3. **Source Attribution**: 所有數據標明來源：「根據 [來源]（[年份]）」
4. **Comparison Tables**: 適時使用表格對比方案/工具/方法的優劣
5. **Logical Flow**: 段落間用邏輯連接詞（「然而」「更關鍵的是」「換個角度看」）
6. **Expert Quotes**: 引用專家觀點作為論據支撐
7. **Depth over Breadth**: 每個 H2 深入 1-2 個重點，不淺嚐輒止

## Anti-Patterns (NEVER do these)
- NEVER cite data without source attribution
- NEVER present only one perspective on a debatable topic
- NEVER use emotional language or exclamation marks
- NEVER make claims without evidence
- NEVER use "你" casual address — maintain professional third-person

## Style Identity
Unlike storytelling: Use data and evidence, NOT personal scenarios
Unlike business editorial: Present multiple perspectives, NOT single opinionated stance
Unlike SEO content: Go deep into 1-2 points per section, NOT broad coverage
```

**Golden Paragraph:**

```
<example_paragraph>
根據 Gartner 2025 年報告，78% 的企業已將 AI 整合進至少一個核心業務流程，較 2023 年的 34% 成長超過一倍。

然而，McKinsey 的調查卻揭示了另一面：僅有 12% 的企業認為其 AI 部署達到了預期的投資回報。這意味著大多數企業仍處於「有部署、無成效」的階段。

從技術成熟度來看，這個落差主要來自三個面向：數據品質不足、組織能力斷層、以及 ROI 衡量標準的缺失。以下將逐一分析。
</example_paragraph>

Match this style: data-led opening with source, contrasting perspective, analytical framework setup.
```

**Conclusion Agent:**

```
結尾風格：分析總結 + 未來展望
```

### 3.6 SectionAgent 風格銜接機制（v2 新增）

逐段生成的最大風險是「風格斷裂」。每個 SectionAgent 呼叫加入：

```
## Style Consistency Check
Before writing, review the previous section summary above.
Maintain the SAME narrative voice and energy level.
For zhihuViral: If the previous section ended with a question, answer it first.
For businessMedia: If the previous section ended with a case, build on the insight.
For deepAnalysis: If the previous section ended with data, reference it for continuity.
```

### 3.7 ContentPlanAgent 結構感知（v2 新增）

不同 preset 需要不同的文章結構。ContentPlanAgent prompt 注入結構指導：

```
## Article Structure Guidance (based on writing style: ${presetId})

zhihuViral:
- H2 should follow narrative arc: Setup → Conflict → Resolution → Insight
- Each H2 should be self-contained enough to be shared standalone
- FAQ section is OPTIONAL (can omit if it breaks narrative flow)
- Conclusion: emotionally resonant, not just a summary

businessMedia:
- Structure: Summary → Insight 1 → Insight 2 → Insight 3 → Conclusion
- Each H2 follows: Claim → Evidence → Implication (三段式)
- 3-point summary at article opening
- FAQ section is OPTIONAL

deepAnalysis:
- Structure: Current State → Analysis → Comparison → Outlook
- At least one H2 should include a comparison table
- FAQ section is RECOMMENDED
- Conclusion: analysis summary + future trends
```

---

## 4. Material Extractor 設計（v2 修訂）

### 4.0 Phase 0：強化 Perplexity Prompt（零成本，優先執行）

**問題**：Perplexity 底層已讀過 citation 原文，但目前 prompt 只要求摘要。

**修訂**：在 ResearchAgent 的 Perplexity query 末尾加入素材需求：

```
5. **Real Stories & Cases** (CRITICAL):
   - Include specific person names, company names, and their detailed experiences
   - Include exact numbers: revenue, growth %, years, rankings
   - Include direct quotes from industry leaders or experts
   - Include specific failure/success case studies with concrete outcomes
   - Do NOT summarize — provide the actual details and timelines
```

**效果**：預估 50%+ 的情況下 Perplexity 返回的素材已足夠豐富，不需要 WebFetch。

### 4.1 素材充足性判斷

MaterialExtractor 先評估 Perplexity 返回的 deepResearch 中是否已有足夠素材：

```typescript
function needsWebFetch(deepResearch: DeepResearchResult): boolean {
  const content = [
    deepResearch.trends?.content || "",
    deepResearch.userQuestions?.content || "",
    deepResearch.authorityData?.content || "",
  ].join(" ");

  // 計算素材指標
  const hasPersonNames =
    /[A-Z][a-z]+|[\u4e00-\u9fa5]{2,4}(?:的|是|在|說|表示)/.test(content);
  const hasNumbers = (content.match(/\d+[%％萬億年月]/g) || []).length >= 3;
  const hasQuotes = /「[^」]+」|"[^"]+"/.test(content);

  // 如果已有人名 + 數字 + 引言，素材可能已足夠
  return !(hasPersonNames && hasNumbers && hasQuotes);
}
```

### 4.2 URL 篩選邏輯（v2 修訂）

從 ResearchAgent 的 `externalReferences[]` 中篩選：

```typescript
const BLOCKED_DOMAINS = [
  // 付費牆
  "businessweekly.com.tw",
  "cw.com.tw",
  "wsj.com",
  "ft.com",
  // 反爬蟲
  "medium.com",
  "reddit.com",
  "quora.com",
  // SPA（fetch 抓不到內容）
  "twitter.com",
  "x.com",
  "facebook.com",
];

function scoreUrl(url: string, targetLanguage: string, type: string): number {
  let score = 0;
  const domain = new URL(url).hostname;

  // 類型加分
  if (["blog", "tutorial", "industry"].includes(type)) score += 2;
  if (type === "news") score += 1;
  if (["wikipedia", "service"].includes(type)) score -= 5;

  // 語系匹配加分
  if (
    targetLanguage === "zh-TW" &&
    (domain.endsWith(".tw") || domain.includes("zh"))
  )
    score += 2;
  if (targetLanguage === "ja-JP" && domain.endsWith(".jp")) score += 2;

  // 黑名單
  if (BLOCKED_DOMAINS.some((d) => domain.includes(d))) score -= 10;

  return score;
}
```

依分數排序，取前 **3-5 個** URL（v2：控制總量以優化 token 消耗）。

### 4.3 WebFetch 實作（v2：改用 Readability）

```typescript
// src/lib/utils/web-fetcher.ts
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

export async function fetchArticleContent(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const html = await response.text();

    // 用 Readability 提取正文（排除 nav/footer/sidebar 雜訊）
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || article.textContent.length < 200) return null;
    return article.textContent.substring(0, 4000); // 純正文可以多給一些
  } catch {
    return null;
  }
}
```

**新增 dependencies**：`@mozilla/readability`、`jsdom`

**控制總 token 量**：限制所有文章合計不超過 8000 字（~12K tokens），品質優於量多但參差不齊。

```typescript
const MAX_TOTAL_CHARS = 8000;
let totalChars = 0;
const selectedContents: { url: string; content: string }[] = [];

for (const item of fetchedContents) {
  if (totalChars + item.content.length > MAX_TOTAL_CHARS) break;
  selectedContents.push(item);
  totalChars += item.content.length;
}
```

### 4.4 MaterialsProfile 型別定義（v2 修訂：加入時效性和相關主題）

```typescript
export interface MaterialsProfile {
  /** 人物故事（含具體經歷、時間線、轉折點） */
  stories: Array<{
    subject: string; // "雷軍"
    narrative: string; // "金山磨了16年，42歲二次創業創辦小米..."
    source: string; // 來源 URL
    relevantTopics: string[]; // ["創業", "手機市場", "品牌策略"]
  }>;

  /** 具體統計數據（含來源歸屬和時效性） */
  statistics: Array<{
    fact: string; // "小米全球市占第三、歐洲第二"
    source: string;
    year?: number; // 數據年份（如果可辨識）
    confidence: "verified" | "inferred" | "uncertain";
  }>;

  /** 可引用的金句或觀點 */
  quotes: Array<{
    text: string; // "人的一生，都在為認知埋單"
    speaker: string; // "張琦"
    source: string;
    relevantTopics: string[];
  }>;

  /** 真實案例（成功/失敗） */
  cases: Array<{
    title: string; // "某餐飲連鎖盲目擴張"
    description: string; // 案例摘要 100-150 字
    outcome: "success" | "failure" | "mixed";
    source: string;
    timeframe?: string; // "2024年Q3" 或 "2020-2023"
    relevantTopics: string[];
  }>;

  /** 關鍵人物/專家簡介 */
  experts: Array<{
    name: string;
    title: string; // "商業教育家"
    relevance: string; // 與文章主題的關聯
  }>;

  /** 萃取元資訊 */
  meta: {
    fetchedUrls: number; // 成功抓取的 URL 數
    totalUrls: number; // 嘗試抓取的 URL 數
    perplexitySufficient: boolean; // Perplexity 素材是否已足夠
    extractionModel: string;
  };
}
```

### 4.5 AI 萃取 Prompt（v2 修訂）

```
你是一位內容研究專家。以下是與「{keyword}」相關的研究資料。
請從中提取可用於寫作的真實素材。

## 規則
1. 只提取有具體細節的內容（人名、數字、年份、事件）
2. 提取事實和數據點，不要複製原文句子
3. 每個素材標記來源
4. 金句需保留原文措辭（這是引用，非抄襲）
5. 案例需包含具體經過和結果
6. 對每個統計數據，標明年份（如果原文有提及）
7. 對每個素材，標記 relevantTopics（2-3 個關鍵主題詞）
8. 如果無法確定數據年份，標記 confidence 為 'uncertain'

## 研究資料
{content}

請輸出 JSON 格式的 MaterialsProfile。
```

### 4.6 素材注入方式（v2：角色化嵌入）

不使用平面列表，改用「研究筆記」角色化方式注入各 Agent：

```
## Your Research Notes (from your recent investigation)
You've been researching "${keyword}" and gathered these materials:

### Stories You Found
- 雷軍的故事：金山磨了16年，42歲二次創業創辦小米...（來源：{url}）

### Data Points You Collected
- 小米全球市占第三、歐洲第二（2024，來源：{url}）

### Quotes Worth Citing
- 「人的一生，都在為認知埋單」—— 張琦（來源：{url}）

Use these materials naturally — weave them into your narrative as if you discovered them yourself.
You don't need to use all of them; pick the ones that best support each section's argument.
```

### 4.7 容錯設計（v2 修訂）

| 情況                       | 處理方式                                                          |
| -------------------------- | ----------------------------------------------------------------- |
| Perplexity 素材已充足      | 跳過 WebFetch，只做結構化萃取（從 deepResearch 文字中提取）       |
| WebFetch 全部失敗          | 使用 Perplexity 摘要素材 + preset 的無素材 fallback prompt        |
| WebFetch 部分失敗          | 用成功的篇數萃取                                                  |
| AI 萃取 JSON 解析失敗      | 返回空 MaterialsProfile，pipeline 繼續                            |
| 抓到的內容太短（< 200 字） | 跳過該篇                                                          |
| 萃取結果某類素材為空       | 該類素材不注入 prompt，不影響其他類型                             |
| MaterialExtractor 整體失敗 | 記錄 warning，pipeline 繼續（soft failure），使用 fallback prompt |

### 4.8 反抄襲機制

在兩個環節加入防護：

**萃取時（MaterialExtractor prompt）：**

```
提取事實和數據點，不要複製原文句子。
金句可保留原文（屬於引用），但敘述性內容必須摘要化。
```

**寫作時（Writing Agent prompt）：**

```
根據以下素材改寫，用自己的語言重新敘述。
保留核心事實（人名、數字、事件），但不要照抄原文措辭。
金句引用時標明出處。
⚠️ 禁止捏造素材中沒有的統計數據、公司名稱或專家引言。
```

---

## 5. Materials → Section 分配機制（v2：tag-based 取代 index-based）

### ContentPlanOutput 擴充

改用 keyword-based 匹配，避免 index 錯位和 AI 輸出不精確的問題：

```typescript
// ContentPlanOutput.detailedOutline.mainSections[i]
{
  h2Title: string;
  // ... 現有欄位
  materialQuery?: string;  // "創業故事" 或 "市場數據" — ContentPlan 描述需要的素材類型
}
```

### Orchestrator 匹配邏輯

用 `relevantTopics` 做語義匹配分配：

```typescript
function matchMaterials(
  section: { h2Title: string; materialQuery?: string },
  materials: MaterialsProfile,
): Partial<MaterialsProfile> {
  const query = (section.materialQuery || section.h2Title).toLowerCase();

  return {
    stories: materials.stories
      .filter((s) =>
        s.relevantTopics.some(
          (t) => query.includes(t) || section.h2Title.includes(t),
        ),
      )
      .slice(0, 2),
    statistics: materials.statistics
      .filter(
        (s) =>
          s.fact.toLowerCase().includes(query) ||
          query.includes(s.fact.substring(0, 10)),
      )
      .slice(0, 3),
    quotes: materials.quotes
      .filter((q) => q.relevantTopics.some((t) => query.includes(t)))
      .slice(0, 1),
    cases: materials.cases
      .filter((c) => c.relevantTopics.some((t) => query.includes(t)))
      .slice(0, 1),
  };
}
```

如果匹配結果為空，fallback 為 round-robin 循環分配（每個 section 按順序分配 1-2 個素材）。

### 去重機制

已分配給前面 section 的素材，在後續 section 的匹配中降低優先級（但不完全排除，因為某些核心素材可能需要跨段引用）。

---

## 6. 型別系統修正（v2 新增）

### 問題

現有 `BrandVoice.writing_style` 在 `types/agents.ts` 定義為物件型別，但 UI 和 DB 實際存字串。`pipeline-helpers.ts` 的 `getBrandVoice()` 混合處理。不修正會導致新 preset 值在 pipeline 中被錯誤解析。

### 修訂

```typescript
// types/agents.ts
export interface BrandVoice {
  // ... 現有欄位
  writing_style?: string; // "professionalFormal" | "zhihuViral" | "businessMedia" | "deepAnalysis"

  // 移除原有的 writing_style 物件定義，改為：
  writing_style_config?: {
    sentence_style:
      | "short_punchy"
      | "conversational"
      | "academic"
      | "storytelling"
      | "mixed";
    interactivity_level: "low" | "medium" | "high";
    use_questions: boolean;
    examples_preference: "minimal" | "moderate" | "extensive";
  };
  // ...
}
```

### pipeline-helpers.ts 修正

`getBrandVoice()` 保留原始 `writing_style` 字串，不再錯誤地解析為 `sentence_style`：

```typescript
return {
  ...defaults,
  writing_style: bv.writing_style, // 保持為字串
  // 新 preset 時，writing_style_config 由 preset 自動生成，不讀 DB
};
```

### defaults.ts 修正

```typescript
export const DEFAULT_BRAND_VOICE: BrandVoice = {
  // ...
  writing_style: "professionalFormal", // 改為字串
  writing_style_config: {
    // 原有的細粒度配置搬到這裡
    sentence_style: "mixed",
    interactivity_level: "medium",
    use_questions: true,
    examples_preference: "moderate",
  },
};
```

---

## 7. Pipeline 整合細節（v2 新增）

### 7.1 MaterialsProfile 存入 job metadata（支援 resume）

```typescript
// orchestrator.ts — MaterialExtractor 完成後
await this.updateJobStatus(input.articleJobId, "processing", {
  ...savedState,
  materials: materialsProfile, // 2-5KB，安全在 100KB metadata 限制內
  current_phase: "materials_completed",
});

// resume 時從 savedState 載入
if (savedState?.materials) {
  materialsProfile = savedState.materials;
}
```

### 7.2 平行執行使用 Promise.allSettled

```typescript
// Phase 2: Strategy + MaterialExtractor 平行
const [strategyResult, materialsResult] = await Promise.allSettled([
  strategyAgent.execute({...}),
  shouldExtractMaterials
    ? materialExtractorAgent.execute({...})
    : Promise.resolve(undefined),
]);

const strategyOutput = strategyResult.status === "fulfilled"
  ? strategyResult.value : undefined;
const materialsProfile = materialsResult.status === "fulfilled"
  ? materialsResult.value : undefined;

if (strategyResult.status === "rejected") {
  throw strategyResult.reason; // Strategy 失敗是 hard failure
}
if (materialsResult.status === "rejected") {
  console.warn("[Orchestrator] Material extraction failed:", materialsResult.reason);
  // Soft failure，繼續 pipeline
}
```

### 7.3 DB Schema

**不需要 migration。** 所有新資料都存在現有 JSONB 欄位中：

- `website_configs.brand_voice.writing_style` — 新增字串值
- `article_jobs.metadata.materials` — MaterialsProfile

---

## 8. UI 變更

### BrandVoiceForm.tsx

在 Writing Style `<Select>` 中新增 3 個選項 + 描述文字：

```tsx
<SelectItem value="zhihuViral">
  <div>
    <span>{t("styles.zhihuViral")}</span>
    <span className="text-xs text-muted-foreground ml-2">
      {t("styles.zhihuViralDesc")}
    </span>
  </div>
</SelectItem>
```

選了新 preset 時顯示提示：

```tsx
{
  ["zhihuViral", "businessMedia", "deepAnalysis"].includes(writingStyle) && (
    <p className="text-xs text-amber-600">{t("presetOverrideHint")}</p>
  );
}
```

### ExternalWebsiteBrandVoiceForm.tsx

同步新增相同選項。

### 語系檔案（7 個）

新增翻譯 key（含描述文字和提示文字）。

---

## 9. 實作步驟（v2 修訂）

### Phase 0: 強化 Perplexity（零成本，最先做）

| 步驟 | 檔案                               | 說明                                              |
| ---- | ---------------------------------- | ------------------------------------------------- |
| 0-1  | `src/lib/agents/research-agent.ts` | Perplexity query 加入 "Real Stories & Cases" 需求 |

### Phase 1: MaterialExtractor（素材萃取）

| 步驟 | 檔案                                         | 說明                                                      |
| ---- | -------------------------------------------- | --------------------------------------------------------- |
| 1-1  | `src/lib/utils/web-fetcher.ts`               | 新建：Readability + JSDOM 正文提取                        |
| 1-2  | `src/types/agents.ts`                        | 新增 MaterialsProfile interface + 修正 writing_style 型別 |
| 1-3  | `src/lib/agents/material-extractor-agent.ts` | 新建：素材充足性判斷 + URL 篩選 + WebFetch + AI 萃取      |
| 1-4  | `src/lib/agents/orchestrator.ts`             | Phase 2 加入 MaterialExtractor 與 Strategy 平行           |
| 1-5  | `src/lib/agents/defaults.ts`                 | 修正 DEFAULT_BRAND_VOICE 型別                             |
| 1-6  | `src/lib/agents/pipeline-helpers.ts`         | 修正 getBrandVoice() 保留 writing_style 字串              |
| 1-7  | `package.json`                               | 新增 @mozilla/readability + jsdom                         |

### Phase 2: Writing Presets（風格切換）

| 步驟 | 檔案                                   | 說明                                                                              |
| ---- | -------------------------------------- | --------------------------------------------------------------------------------- |
| 2-1  | `src/lib/agents/writing-presets.ts`    | 新建：4 個 preset 完整定義（Rules + Anti-Patterns + Golden Paragraph + Fallback） |
| 2-2  | `src/lib/agents/writing-agent.ts`      | 完全替換 Writing Rules + 角色化素材注入                                           |
| 2-3  | `src/lib/agents/introduction-agent.ts` | 重構：可替換的 Opening Strategy 區塊                                              |
| 2-4  | `src/lib/agents/section-agent.ts`      | 完全替換 Writing Rules + 風格銜接指令 + 章節素材                                  |
| 2-5  | `src/lib/agents/conclusion-agent.ts`   | 根據 preset 切換結尾風格                                                          |
| 2-6  | `src/lib/agents/content-plan-agent.ts` | 注入 preset 結構指導 + materialQuery 分配                                         |
| 2-7  | `src/lib/agents/prompt-utils.ts`       | 新增 preset 相關的 prompt 建構函數                                                |

### Phase 3: UI + 語系

| 步驟 | 檔案                                | 說明                                   |
| ---- | ----------------------------------- | -------------------------------------- |
| 3-1  | `BrandVoiceForm.tsx`                | 新增 3 個選項 + 描述文字 + preset 提示 |
| 3-2  | `ExternalWebsiteBrandVoiceForm.tsx` | 同步新增                               |
| 3-3  | `src/messages/*.json` × 7           | 新增翻譯 key                           |
| 3-4  | `actions.ts`                        | 確保新 writing_style 值正確存入資料庫  |

### Phase 4: 串接驗證

| 步驟 | 說明                                                                |
| ---- | ------------------------------------------------------------------- |
| 4-1  | 端對端測試 — 用一個關鍵字分別跑 3 個 preset，驗證風格差異和素材引用 |
| 4-2  | 對比測試 — 同一關鍵字跑 default vs zhihuViral，確認風格明顯不同     |

---

## 10. 成本估算（v2 精算）

### DeepSeek Chat 定價

| 項目                       | 價格             |
| -------------------------- | ---------------- |
| Input tokens（cache miss） | $0.27 / M tokens |
| Output tokens              | $1.10 / M tokens |

### 每篇文章增量

| 項目                             | Token 增量       | 成本增量                                  |
| -------------------------------- | ---------------- | ----------------------------------------- |
| Perplexity 強化 prompt           | +700 tokens      | ~$0.001（Perplexity 計費）                |
| MaterialExtractor AI 萃取        | ~12K in + 2K out | ~$0.005（50% 需要 WebFetch 時的加權平均） |
| Writing Agents prompt 膨脹       | ~2900 in         | ~$0.001                                   |
| **總增量**                       |                  | **~$0.005 / 篇**                          |
| **對比現有每篇成本 ~$0.03-0.05** |                  | **增幅 +10~15%**                          |

---

## 11. 風險與緩解（v2 修訂）

| 風險                            | 影響                  | 緩解方式                                                 |
| ------------------------------- | --------------------- | -------------------------------------------------------- |
| Perplexity 素材仍不足           | 需要 WebFetch 補充    | WebFetch 作為補充手段，失敗也有 fallback                 |
| WebFetch 全部失敗               | 無真實素材可用        | 每個 preset 有完整的無素材 fallback 策略（禁止捏造數據） |
| 抄襲風險                        | 法律/SEO 重複內容懲罰 | 萃取和寫作雙重反抄襲指令                                 |
| Preset 與 tone_of_voice 衝突    | 用戶困惑              | 明確優先級 + UI 提示                                     |
| Writing Rules 追加導致指令衝突  | 風格不倫不類          | **完全替換**模式，非追加                                 |
| 風格漂移（長文後段回歸 SEO 風） | 品質不一致            | Anti-Patterns + Golden Paragraph + 風格銜接指令          |
| 三個 preset 風格趨同            | 區隔不明              | 區隔維度表 + Style Identity 對比定義                     |
| 素材分配 index 錯位             | 錯誤引用              | 改用 tag-based 匹配 + round-robin fallback               |
| writing_style 型別衝突          | pipeline 解析錯誤     | 統一為字串，修正 pipeline-helpers.ts                     |
| pipeline 失敗無法 resume        | 浪費重跑成本          | MaterialsProfile 存入 job metadata                       |
| 增加 pipeline 延遲              | 等待時間增加          | MaterialExtractor 與 Strategy 平行，實際增加 ~0 秒       |
