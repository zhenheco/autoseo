# Writing Style Presets + Material Extractor 設計文件

> 日期：2026-02-16
> 狀態：待實作
> 目標：讓文章生成支援多種寫作風格，並透過 WebFetch 抓取真實素材提升內容品質

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

| 層面             | 現狀                        | 目標                           |
| ---------------- | --------------------------- | ------------------------------ |
| 怎麼寫（風格）   | 固定 SEO 工具文             | 可選的風格 preset              |
| 用什麼寫（素材） | Perplexity 摘要（缺乏細節） | 抓取原文中的真實故事/數據/案例 |

---

## 2. 整體架構

### 新增兩個核心能力

**A. Writing Style Presets** — 控制「怎麼寫」

- 在 Brand Voice 設定中擴充 writing_style，新增 3 個風格 preset
- 每個 preset 覆寫 Writing Agent、Introduction Agent、Section Agent 的 Writing Rules

**B. Material Extractor** — 控制「用什麼素材寫」

- 從 Perplexity citations 的 URL 抓取原文內容
- AI 萃取結構化素材（故事、數據、金句、案例、專家）
- 素材注入 ContentPlan 和 Writing Agents

### 資料流

```
ResearchAgent（Perplexity）
  → citations URLs + deepResearch 摘要
       ↓
MaterialExtractor（新增，Phase 2.5，與 CompetitorAnalysis 平行）
  1. 從 citations 篩選最多 5 個 URL（優先 blog/tutorial/news）
  2. 平行 WebFetch 抓取每篇前 3000 字
  3. 一次 AI 呼叫萃取結構化素材
  4. 輸出 MaterialsProfile
       ↓
ContentPlanAgent（接收 MaterialsProfile，規劃素材分配到各章節）
       ↓
IntroductionAgent / SectionAgent / ConclusionAgent
  - 接收對應章節的素材子集
  - 根據 preset 的 Writing Rules 使用素材
```

### 觸發條件

- 選了 3 個新 preset 之一 → 自動啟用 MaterialExtractor
- 選原有 4 個 style → 行為不變（向下相容）

```typescript
const shouldExtractMaterials = [
  "zhihuViral",
  "businessMedia",
  "deepAnalysis",
].includes(brandVoice.writing_style);
```

---

## 3. Writing Style Presets 設計

### 3.1 Preset 清單

| Preset ID       | 內部名稱   | 核心特徵                                                                |
| --------------- | ---------- | ----------------------------------------------------------------------- |
| `zhihuViral`    | 故事敘事風 | 個人故事開場、口語化、先抑後揚、情感金句、短段落（2-4句）、用「你」對話 |
| `businessMedia` | 商業觀點風 | 格言/金句開場、自問自答推進、名人案例驅動、觀點導向、加粗重點句         |
| `deepAnalysis`  | 深度分析風 | 數據密集、多角度分析、嚴謹引用、結構層次分明、表格對比                  |

### 3.2 多語系 UI 命名

| Preset        | zh-TW      | en-US              | ja-JP                | ko-KR         | de-DE              | es-ES                 | fr-FR               |
| ------------- | ---------- | ------------------ | -------------------- | ------------- | ------------------ | --------------------- | ------------------- |
| zhihuViral    | 故事敘事風 | Storytelling       | ストーリーテリング型 | 스토리텔링    | Storytelling       | Narrativo             | Narratif            |
| businessMedia | 商業觀點風 | Business Editorial | ビジネスコラム型     | 비즈니스 칼럼 | Business-Editorial | Editorial de negocios | Editorial business  |
| deepAnalysis  | 深度分析風 | Deep Analysis      | 深掘り分析型         | 심층 분석     | Tiefenanalyse      | Analisis profundo     | Analyse approfondie |

每個選項附帶灰色描述文字（同步翻譯 7 語系）。

### 3.3 Preset 與現有 BrandVoice 的優先級

選了新 preset 時的優先級規則：

```
writing_style preset > tone_of_voice（preset 自帶語氣定義）
target_audience      → 仍然生效（影響用詞深度）
brand_integration    → 仍然生效（品牌提及次數）
voice_examples       → 仍然生效（good/bad examples）
```

UI 上在選了新 preset 時顯示提示：「選擇風格模板後，語調設定將由模板決定」

### 3.4 Preset Prompt 定義

#### `zhihuViral`（故事敘事風）

**Introduction Agent:**

```
開場方式：用一個具體場景或親身經歷切入
（例：「我曾經花了三個月研究 XX，踩了無數坑，最後發現...」）
無素材 fallback：描述讀者可能遇到的具體場景
```

**Section Agent Writing Rules:**

```
1. Story-First: 每個 H2 用一個具體場景或真實故事切入
2. Short Paragraphs: 每段最多 2-4 句，製造閱讀節奏感
3. Contrast & Tension: 先說常見誤區，再揭示正確做法（先抑後揚）
4. Direct Address: 用「你」直接對話讀者
5. Golden Quotes: 每個 H2 結尾或轉折處放一句精煉金句
6. Specific over Abstract: 用真實故事/案例/數據，不用模糊說法
7. Emotional Hooks: 適度使用情感煽動，製造「不看完會後悔」的感覺
```

**Conclusion Agent:**

```
結尾風格：情感升華 + 行動鼓勵
（例：「答應我，把這篇看完，然後真正去做。」）
```

#### `businessMedia`（商業觀點風）

**Introduction Agent:**

```
開場方式：用一個反直覺的觀點或格言
（例：「認為現在錢難賺，是因為你活在過去的成功裡。」）
附加：開頭放 3 點精華摘要（模仿商週的摘要區塊）
無素材 fallback：用一個與主題相關的反常識觀點開場
```

**Section Agent Writing Rules:**

```
1. Insight Opening: 每個 H2 用反直覺觀點或格言開場
2. Self-Q&A Flow: 用「為什麼這麼說？」「這代表什麼？」推進論述
3. Celebrity Cases: 優先使用名人/企業案例，帶具體數字（年份、金額、排名）
4. Bold Key Sentences: 每段核心觀點用粗體標記
5. Opinionated Stance: 明確表達立場（「我認為...」「真正的關鍵在於...」）
6. Structured Arguments: 觀點 → 案例佐證 → 延伸啟示（三段式）
7. Bullet Summaries: 每個 H2 開頭或結尾提供重點摘要
```

**Conclusion Agent:**

```
結尾風格：觀點總結 + 格言收尾
（例：「底層邏輯決定了你的天花板。」）
```

#### `deepAnalysis`（深度分析風）

**Introduction Agent:**

```
開場方式：用一個具體統計數據或研究發現
（例：「根據 2025 年 Gartner 報告，78% 的企業已經...」）
無素材 fallback：用行業公認的趨勢或現象開場
```

**Section Agent Writing Rules:**

```
1. Data-Led Opening: 每個 H2 用具體統計數據或研究發現開場
2. Multi-Perspective: 每個議題呈現 2-3 種不同觀點，再給出分析結論
3. Source Attribution: 所有數據標明來源：「根據 [來源]（[年份]）」
4. Comparison Tables: 適時使用表格對比方案/工具/方法的優劣
5. Logical Flow: 段落間用邏輯連接詞（「然而」「更關鍵的是」「換個角度看」）
6. Expert Quotes: 引用專家觀點作為論據支撐
7. Depth over Breadth: 每個 H2 深入 1-2 個重點，不淺嚐輒止
```

**Conclusion Agent:**

```
結尾風格：分析總結 + 未來展望
```

---

## 4. Material Extractor 設計

### 4.1 URL 篩選邏輯

從 ResearchAgent 的 `externalReferences[]` 中篩選，優先順序：

```
1. blog / tutorial / industry → 最可能有故事和案例
2. news → 有時效性數據
3. official_docs / research → 有權威數據
4. wikipedia → 跳過（Perplexity 摘要已涵蓋）
5. service → 跳過（產品頁，素材價值低）
```

最多選 5 個 URL。

### 4.2 WebFetch 實作

在 GitHub Actions 環境中運行（`scripts/process-jobs.ts`），需要：

- 新增 `src/lib/utils/web-fetcher.ts` 工具函數
- 使用 `node-fetch` + HTML-to-text 轉換（如 `html-to-text` 套件）
- 每篇截取前 3000 字
- 平行抓取，設定單篇超時 10 秒
- 跳過內容 < 200 字的結果

```typescript
// src/lib/utils/web-fetcher.ts
export async function fetchArticleContent(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "..." },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    const text = htmlToText(html, { wordwrap: false });
    if (text.length < 200) return null;
    return text.substring(0, 3000);
  } catch {
    return null;
  }
}
```

### 4.3 MaterialsProfile 型別定義

```typescript
export interface MaterialsProfile {
  /** 人物故事（含具體經歷、時間線、轉折點） */
  stories: Array<{
    subject: string; // "雷軍"
    narrative: string; // "金山磨了16年，42歲二次創業創辦小米..."
    source: string; // 來源 URL
  }>;

  /** 具體統計數據（含來源歸屬） */
  statistics: Array<{
    fact: string; // "小米全球市占第三、歐洲第二"
    source: string;
  }>;

  /** 可引用的金句或觀點 */
  quotes: Array<{
    text: string; // "人的一生，都在為認知埋單"
    speaker: string; // "張琦"
    source: string;
  }>;

  /** 真實案例（成功/失敗） */
  cases: Array<{
    title: string; // "某餐飲連鎖盲目擴張"
    description: string; // 案例摘要 100-150 字
    outcome: "success" | "failure" | "mixed";
    source: string;
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
    extractionModel: string;
  };
}
```

### 4.4 AI 萃取 Prompt

```
你是一位內容研究專家。以下是 {N} 篇與「{keyword}」相關的文章內容。
請從中提取可用於寫作的真實素材。

## 規則
1. 只提取有具體細節的內容（人名、數字、年份、事件）
2. 提取事實和數據點，不要複製原文句子
3. 每個素材標記來源 URL
4. 金句需保留原文措辭（這是引用，非抄襲）
5. 案例需包含具體經過和結果

## 文章內容
### 文章 1（來源：{url1}）
{content1}

### 文章 2（來源：{url2}）
{content2}
...

請輸出 JSON 格式的 MaterialsProfile。
```

### 4.5 容錯設計

| 情況                       | 處理方式                                                        |
| -------------------------- | --------------------------------------------------------------- |
| WebFetch 全部失敗（5/5）   | MaterialsProfile 為空，Writing Agent 使用無素材 fallback prompt |
| 部分失敗（如只成功 2 篇）  | 用成功的篇數萃取                                                |
| AI 萃取 JSON 解析失敗      | 返回空 MaterialsProfile，pipeline 繼續                          |
| 抓到的內容太短（< 200 字） | 跳過該篇                                                        |
| 萃取結果某類素材為空       | 該類素材不注入 prompt，不影響其他類型                           |

### 4.6 反抄襲機制

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
```

---

## 5. Materials → Section 分配機制

### ContentPlanOutput 擴充

在 ContentPlanOutput 的每個 mainSection 加入素材分配：

```typescript
// ContentPlanOutput.detailedOutline.mainSections[i]
{
  h2Title: string;
  // ... 現有欄位
  suggestedMaterials?: {
    storyIndices: number[];      // 建議使用 stories[0], stories[2]
    statisticIndices: number[];
    caseIndices: number[];
    quoteIndices: number[];
  };
}
```

### Orchestrator 傳遞邏輯

呼叫每個 SectionAgent 時，根據 ContentPlan 的 indices 從 MaterialsProfile 中取出對應素材：

```typescript
const sectionMaterials = {
  stories:
    plan.suggestedMaterials?.storyIndices
      ?.map((i) => materials.stories[i])
      .filter(Boolean) || [],
  statistics:
    plan.suggestedMaterials?.statisticIndices
      ?.map((i) => materials.statistics[i])
      .filter(Boolean) || [],
  // ...
};
```

避免多個 section 重複引用同一個案例。

---

## 6. UI 變更

### BrandVoiceForm.tsx

在 Writing Style `<Select>` 中新增 3 個選項：

```tsx
<SelectItem value="zhihuViral">
  {t("styles.zhihuViral")}
</SelectItem>
<SelectItem value="businessMedia">
  {t("styles.businessMedia")}
</SelectItem>
<SelectItem value="deepAnalysis">
  {t("styles.deepAnalysis")}
</SelectItem>
```

每個選項帶描述文字：

- 故事敘事風：「故事開場、短段落、口語化、金句收尾」
- 商業觀點風：「觀點導向、名人案例、自問自答、摘要開頭」
- 深度分析風：「數據驅動、多角度分析、專家引用、表格對比」

### ExternalWebsiteBrandVoiceForm.tsx

同步新增相同選項。

### 語系檔案（7 個）

新增翻譯 key：

- `websites.brandVoice.styles.zhihuViral`
- `websites.brandVoice.styles.zhihuViralDesc`
- `websites.brandVoice.styles.businessMedia`
- `websites.brandVoice.styles.businessMediaDesc`
- `websites.brandVoice.styles.deepAnalysis`
- `websites.brandVoice.styles.deepAnalysisDesc`
- `websites.brandVoice.presetOverrideHint`（preset 覆寫語調的提示文字）

---

## 7. 實作步驟

### Phase 1: MaterialExtractor（素材萃取）

| 步驟 | 檔案                                         | 說明                                                         |
| ---- | -------------------------------------------- | ------------------------------------------------------------ |
| 1-1  | `src/lib/utils/web-fetcher.ts`               | 新建：WebFetch + HTML-to-text 工具函數                       |
| 1-2  | `src/types/agents.ts`                        | 新增 MaterialsProfile interface                              |
| 1-3  | `src/lib/agents/material-extractor-agent.ts` | 新建：URL 篩選 + WebFetch + AI 萃取                          |
| 1-4  | `src/lib/agents/orchestrator.ts`             | Phase 2.5 加入 MaterialExtractor，與 CompetitorAnalysis 平行 |

### Phase 2: Writing Presets（風格切換）

| 步驟 | 檔案                                   | 說明                                               |
| ---- | -------------------------------------- | -------------------------------------------------- |
| 2-1  | `src/lib/agents/writing-presets.ts`    | 新建：3 個 preset 的 Writing Rules + fallback 定義 |
| 2-2  | `src/lib/agents/writing-agent.ts`      | 根據 preset 切換 Writing Rules + 注入素材          |
| 2-3  | `src/lib/agents/introduction-agent.ts` | 根據 preset 切換開場策略                           |
| 2-4  | `src/lib/agents/section-agent.ts`      | 根據 preset 切換段落規則 + 注入章節素材            |
| 2-5  | `src/lib/agents/conclusion-agent.ts`   | 根據 preset 切換結尾風格                           |
| 2-6  | `src/lib/agents/content-plan-agent.ts` | 根據 preset + 素材規劃結構 + 分配素材到章節        |
| 2-7  | `src/lib/agents/prompt-utils.ts`       | 新增 preset 相關的 prompt 建構函數                 |

### Phase 3: UI + 語系

| 步驟 | 檔案                                | 說明                                   |
| ---- | ----------------------------------- | -------------------------------------- |
| 3-1  | `BrandVoiceForm.tsx`                | 新增 3 個選項 + 描述文字 + preset 提示 |
| 3-2  | `ExternalWebsiteBrandVoiceForm.tsx` | 同步新增                               |
| 3-3  | `src/messages/zh-TW.json`           | 新增翻譯 key                           |
| 3-4  | `src/messages/en-US.json`           | 新增翻譯 key                           |
| 3-5  | `src/messages/ja-JP.json`           | 新增翻譯 key                           |
| 3-6  | `src/messages/ko-KR.json`           | 新增翻譯 key                           |
| 3-7  | `src/messages/de-DE.json`           | 新增翻譯 key                           |
| 3-8  | `src/messages/es-ES.json`           | 新增翻譯 key                           |
| 3-9  | `src/messages/fr-FR.json`           | 新增翻譯 key                           |
| 3-10 | `actions.ts`                        | 確保新 writing_style 值正確存入資料庫  |

### Phase 4: 串接驗證

| 步驟 | 說明                                                                    |
| ---- | ----------------------------------------------------------------------- |
| 4-1  | `pipeline-helpers.ts` — 確保 writing_style 和 MaterialsProfile 正確傳遞 |
| 4-2  | 端對端測試 — 用一個關鍵字分別跑 3 個 preset，驗證風格差異和素材引用     |

---

## 8. 預估影響

| 項目             | 數值                                                                    |
| ---------------- | ----------------------------------------------------------------------- |
| 新增檔案         | 3 個（web-fetcher.ts、material-extractor-agent.ts、writing-presets.ts） |
| 修改檔案         | ~14 個（agents + UI + 語系 + types）                                    |
| 每篇文章增加成本 | ~$0.01-0.03（MaterialExtractor 的 AI 呼叫，用 deepseek-chat）           |
| 每篇文章增加時間 | ~8-12 秒（WebFetch + 萃取，與 CompetitorAnalysis 平行執行）             |
| 向下相容         | 完全相容，選原有 4 個 style 時行為不變                                  |

---

## 9. 風險與緩解

| 風險                            | 影響                  | 緩解方式                                                  |
| ------------------------------- | --------------------- | --------------------------------------------------------- |
| WebFetch 全部失敗               | 無真實素材可用        | Preset prompt 有無素材 fallback（用情境描述代替真實故事） |
| 抄襲風險                        | 法律/SEO 重複內容懲罰 | 萃取和寫作雙重反抄襲指令                                  |
| Preset 與 tone_of_voice 衝突    | 用戶困惑              | 明確優先級：preset > tone_of_voice，UI 加提示             |
| 素材分配不均                    | 多個章節引用同一案例  | ContentPlan 分配 indices，orchestrator 按 indices 傳遞    |
| 增加 pipeline 延遲              | 用戶等待時間增加      | 與 CompetitorAnalysis 平行執行，實際增加 ~0 秒            |
| GitHub Actions 中 WebFetch 失敗 | 網路限制              | 設定超時 + graceful fallback                              |
