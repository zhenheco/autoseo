/**
 * Writing Style Presets
 * 定義各風格的 Writing Rules、Anti-Patterns、Golden Paragraph 和 Fallback 策略
 */
import type { WritingStylePreset, MaterialsProfile } from "@/types/agents";

interface PresetDefinition {
  id: WritingStylePreset;
  writingRules: string;
  antiPatterns: string;
  styleIdentity: string;
  goldenParagraph: string;
  introductionStrategy: {
    withMaterials: string;
    withoutMaterials: string;
  };
  conclusionStyle: string;
  structureGuidance: string;
  styleConsistencyCheck: string;
}

const PRESET_DEFINITIONS: Record<string, PresetDefinition> = {
  zhihuViral: {
    id: "zhihuViral",
    writingRules: `## Writing Rules
1. **Story-First**: 每個 H2 用具體場景或真實故事切入，不要用定義或概念開頭
2. **Short Paragraphs**: 每段最多 80 字 / 4 句，製造閱讀節奏感
3. **Contrast & Tension**: 先說常見誤區，再揭示正確做法（先抑後揚）
4. **Direct Address**: 用「你」直接對話讀者
5. **Golden Quotes**: 每個 H2 結尾或轉折處放一句粗體精煉金句
6. **Specific over Abstract**: 用真實故事/案例/數據，不用模糊說法
7. **Emotional Hooks**: 適度使用情感煽動，製造「不看完會後悔」的感覺`,
    antiPatterns: `## Anti-Patterns (NEVER do these)
- NEVER start a section with a dictionary definition or abstract concept
- NEVER use "根據研究顯示..." as the opening — use a personal scenario instead
- NEVER write paragraphs longer than 4 sentences
- NEVER use formal academic connectors like "此外"、"綜上所述" — use "但問題來了"、"你可能會想"
- NEVER present multiple perspectives objectively — take a clear stance`,
    styleIdentity: `## Style Identity
Unlike business editorial: Use everyday people's stories, NOT celebrity cases
Unlike deep analysis: Use emotional hooks, NOT data-led openings
Unlike SEO content: Use conversational "你" address, NOT formal third-person`,
    goldenParagraph: `<example_paragraph>
你有沒有想過，為什麼你每天加班到凌晨，績效卻始終是 B？

不是你不夠努力。是你根本搞錯了方向。

我之前帶過一個團隊，裡面有個工程師，每天第一個到、最後一個走。但他的 code review 通過率只有 40%。後來我跟他聊了一次，發現他花了 80% 的時間在「修 bug」，而不是「設計架構」。

**真正拉開差距的，從來不是工時，而是你把時間花在哪裡。**
</example_paragraph>

Match this style: short paragraphs, direct address with "你", contrast structure (misconception → truth), bold golden quote at the end.`,
    introductionStrategy: {
      withMaterials: `用 MaterialsProfile 中的真實故事開場
結構：場景設定（2-3 句）→ 問題揭示 → 「這篇文章會告訴你...」`,
      withoutMaterials: `用讀者可辨識的具體情境開場
技巧庫：
1. Constructed Scenarios: 「想像你是一個剛入行的 PM，老闆突然要你...」
2. Common Experience: 描述與主題相關的普遍挫折或突破
3. Reader Projection: 「你可能正在想...」「你一定也遇過這種情況」
⚠️ 禁止捏造具體統計數據、公司名稱或專家引言`,
    },
    conclusionStyle: `結尾風格：情感升華 + 行動鼓勵
（例：「答應我，把這篇看完，然後真正去做。」）`,
    structureGuidance: `- H2 should follow narrative arc: Setup → Conflict → Resolution → Insight
- Each H2 should be self-contained enough to be shared standalone
- FAQ section is OPTIONAL (can omit if it breaks narrative flow)
- Conclusion: emotionally resonant, not just a summary`,
    styleConsistencyCheck: `If the previous section ended with a question, answer it first.`,
  },

  businessMedia: {
    id: "businessMedia",
    writingRules: `## Writing Rules
1. **Insight Opening**: 每個 H2 用反直覺觀點或格言開場
2. **Self-Q&A Flow**: 用「為什麼這麼說？」「這代表什麼？」推進論述
3. **Celebrity Cases**: 優先使用名人/企業案例，帶具體數字（年份、金額、排名）
4. **Bold Key Sentences**: 每段核心觀點用粗體標記
5. **Opinionated Stance**: 明確表達立場（「我認為...」「真正的關鍵在於...」）
6. **Structured Arguments**: 觀點 → 案例佐證 → 延伸啟示（三段式）
7. **Bullet Summaries**: 每個 H2 開頭或結尾提供重點摘要`,
    antiPatterns: `## Anti-Patterns (NEVER do these)
- NEVER start without a provocative claim or quote
- NEVER present information without an opinionated stance
- NEVER use passive voice for key arguments
- NEVER omit specific numbers (year, amount, ranking) when citing cases
- NEVER use emotional exclamations — maintain authoritative confidence`,
    styleIdentity: `## Style Identity
Unlike storytelling: Use celebrity/enterprise cases, NOT everyday scenarios
Unlike deep analysis: Lead with opinions, NOT neutral multi-perspective analysis
Unlike SEO content: Use "我認為" first-person authority, NOT generic "experts say"`,
    goldenParagraph: `<example_paragraph>
認為現在錢難賺，是因為你活在過去的成功裡。

為什麼這麼說？你看雷軍，在金山磨了 16 年，42 歲才創辦小米。很多人只看到小米上市那天的風光，卻忽略了他在金山時期經歷的數次瀕臨倒閉。

**但真正讓雷軍逆轉的，不是運氣，而是他花了 16 年想明白一件事：順勢而為。**

小米用了不到 10 年，做到全球第三、歐洲第二。這不是偶然。
</example_paragraph>

Match this style: provocative opening, self-Q&A flow, celebrity case with specific numbers, bold key insight.`,
    introductionStrategy: {
      withMaterials: `用 MaterialsProfile 中的金句或反直覺觀點開場
附加：開頭放 3 點精華摘要（模仿商週的摘要區塊）`,
      withoutMaterials: `技巧庫：
1. Industry Logic: 從第一原理推導洞察
2. Pattern Recognition: 「這個現象背後的邏輯是...」
3. Thought Experiments: 「如果把這個策略推到極致...」
⚠️ 禁止捏造具體營收數字、市占數據或具名案例`,
    },
    conclusionStyle: `結尾風格：觀點總結 + 格言收尾
（例：「底層邏輯決定了你的天花板。」）`,
    structureGuidance: `- Structure: Summary → Insight 1 → Insight 2 → Insight 3 → Conclusion
- Each H2 follows: Claim → Evidence → Implication (三段式)
- 3-point summary at article opening
- FAQ section is OPTIONAL`,
    styleConsistencyCheck: `If the previous section ended with a case, build on the insight.`,
  },

  deepAnalysis: {
    id: "deepAnalysis",
    writingRules: `## Writing Rules
1. **Data-Led Opening**: 每個 H2 用具體統計數據或研究發現開場
2. **Multi-Perspective**: 每個議題呈現 2-3 種不同觀點，再給出分析結論
3. **Source Attribution**: 所有數據標明來源：「根據 [來源]（[年份]）」
4. **Comparison Tables**: 適時使用表格對比方案/工具/方法的優劣
5. **Logical Flow**: 段落間用邏輯連接詞（「然而」「更關鍵的是」「換個角度看」）
6. **Expert Quotes**: 引用專家觀點作為論據支撐
7. **Depth over Breadth**: 每個 H2 深入 1-2 個重點，不淺嚐輒止`,
    antiPatterns: `## Anti-Patterns (NEVER do these)
- NEVER cite data without source attribution
- NEVER present only one perspective on a debatable topic
- NEVER use emotional language or exclamation marks
- NEVER make claims without evidence
- NEVER use "你" casual address — maintain professional third-person`,
    styleIdentity: `## Style Identity
Unlike storytelling: Use data and evidence, NOT personal scenarios
Unlike business editorial: Present multiple perspectives, NOT single opinionated stance
Unlike SEO content: Go deep into 1-2 points per section, NOT broad coverage`,
    goldenParagraph: `<example_paragraph>
根據 Gartner 2025 年報告，78% 的企業已將 AI 整合進至少一個核心業務流程，較 2023 年的 34% 成長超過一倍。

然而，McKinsey 的調查卻揭示了另一面：僅有 12% 的企業認為其 AI 部署達到了預期的投資回報。這意味著大多數企業仍處於「有部署、無成效」的階段。

從技術成熟度來看，這個落差主要來自三個面向：數據品質不足、組織能力斷層、以及 ROI 衡量標準的缺失。以下將逐一分析。
</example_paragraph>

Match this style: data-led opening with source, contrasting perspective, analytical framework setup.`,
    introductionStrategy: {
      withMaterials: `用 MaterialsProfile 中的統計數據開場
結構：數據 → 趨勢解讀 → 本文分析框架`,
      withoutMaterials: `技巧庫：
1. Framework Analysis: 套用 SWOT、波特五力等經典框架
2. Logical Deduction: 從公認事實推導論點
3. Comparative Reasoning: 與類似產業/歷史先例對比
明確標示：「雖然目前缺乏具體數據，但從產業趨勢可以推論...」`,
    },
    conclusionStyle: `結尾風格：分析總結 + 未來展望`,
    structureGuidance: `- Structure: Current State → Analysis → Comparison → Outlook
- At least one H2 should include a comparison table
- FAQ section is RECOMMENDED
- Conclusion: analysis summary + future trends`,
    styleConsistencyCheck: `If the previous section ended with data, reference it for continuity.`,
  },
};

const NARRATIVE_PRESETS = new Set([
  "zhihuViral",
  "businessMedia",
  "deepAnalysis",
]);

export function shouldExtractMaterials(writingStyle?: string): boolean {
  return NARRATIVE_PRESETS.has(writingStyle || "");
}

export function getPresetDefinition(
  presetId: string,
): PresetDefinition | undefined {
  return PRESET_DEFINITIONS[presetId];
}

/**
 * 取得 Writing Rules（完全替換模式）
 * 新 preset 時返回 preset 專用 rules，否則返回 default rules
 */
export function getWritingRules(presetId?: string): string {
  const preset = presetId ? PRESET_DEFINITIONS[presetId] : undefined;
  if (!preset) {
    // Default SEO rules
    return `## Writing Rules
1. **Specific over generic**: Real products, numbers, case studies — not abstract descriptions
2. **Answer-First**: Each H2 starts with a 40-80 word direct answer
3. **Statistics with Attribution**: "According to [Source] ([Year]), [stat]"
4. **Preserve Entities**: Real brand/tool names, never generic terms
5. **Natural keywords**: Once per paragraph, then synonyms — never force or repeat

## Voice Quality Check
- Write like explaining to a knowledgeable friend, not a thesis
- No filler: if you've made the point, move on
- No vague claims without evidence ("很有用", "Experts believe...")
- Cite specific sources or state facts directly`;
  }

  return `${preset.writingRules}

${preset.antiPatterns}

${preset.styleIdentity}`;
}

/**
 * 取得 Section Agent 的風格銜接指令
 */
export function getStyleConsistencyCheck(presetId?: string): string {
  const preset = presetId ? PRESET_DEFINITIONS[presetId] : undefined;
  if (!preset) return "";

  return `## Style Consistency Check
Before writing, review the previous section summary above.
Maintain the SAME narrative voice and energy level.
${preset.styleConsistencyCheck}`;
}

/**
 * 取得 Introduction Agent 的開場策略
 */
export function getIntroductionStrategy(
  presetId?: string,
  hasMaterials?: boolean,
): string {
  const preset = presetId ? PRESET_DEFINITIONS[presetId] : undefined;
  if (!preset) return "";

  const strategy = hasMaterials
    ? preset.introductionStrategy.withMaterials
    : preset.introductionStrategy.withoutMaterials;

  return `## Opening Strategy (${preset.id})
${strategy}

## Golden Paragraph (match this style)
${preset.goldenParagraph}`;
}

/**
 * 取得 Conclusion Agent 的結尾風格
 */
export function getConclusionStyle(presetId?: string): string {
  const preset = presetId ? PRESET_DEFINITIONS[presetId] : undefined;
  if (!preset) return "";
  return `## Conclusion Style\n${preset.conclusionStyle}`;
}

/**
 * 取得 ContentPlan 的結構指導
 */
export function getStructureGuidance(presetId?: string): string {
  const preset = presetId ? PRESET_DEFINITIONS[presetId] : undefined;
  if (!preset) return "";
  return `## Article Structure Guidance (writing style: ${presetId})
${preset.structureGuidance}`;
}

/**
 * 構建角色化素材注入區塊
 */
export function buildMaterialsInjection(
  keyword: string,
  materials?: Partial<MaterialsProfile>,
): string {
  if (!materials) return "";

  const header = [
    `## Your Research Notes (from your recent investigation on "${keyword}")`,
    `Use these materials naturally — weave them into your narrative as if you discovered them yourself.`,
    `You don't need to use all of them; pick the ones that best support this section's argument.`,
    `⚠️ 禁止捏造素材中沒有的統計數據、公司名稱或專家引言。`,
  ];

  const contentSections: string[] = [];

  if (materials.stories && materials.stories.length > 0) {
    contentSections.push("\n### Stories You Found");
    for (const s of materials.stories) {
      contentSections.push(
        `- ${s.subject}的故事：${s.narrative}（來源：${s.source}）`,
      );
    }
  }

  if (materials.statistics && materials.statistics.length > 0) {
    contentSections.push("\n### Data Points You Collected");
    for (const s of materials.statistics) {
      const yearStr = s.year ? `${s.year}，` : "";
      contentSections.push(`- ${s.fact}（${yearStr}來源：${s.source}）`);
    }
  }

  if (materials.quotes && materials.quotes.length > 0) {
    contentSections.push("\n### Quotes Worth Citing");
    for (const q of materials.quotes) {
      contentSections.push(
        `- 「${q.text}」—— ${q.speaker}（來源：${q.source}）`,
      );
    }
  }

  if (materials.cases && materials.cases.length > 0) {
    contentSections.push("\n### Case Studies");
    for (const c of materials.cases) {
      contentSections.push(
        `- ${c.title}：${c.description}（${c.outcome}，來源：${c.source}）`,
      );
    }
  }

  if (contentSections.length === 0) return "";
  return [...header, ...contentSections].join("\n");
}

/**
 * Tag-based 素材匹配
 */
export function matchMaterials(
  section: { h2Title: string; materialQuery?: string },
  materials: MaterialsProfile,
): Partial<MaterialsProfile> {
  const query = (section.materialQuery || section.h2Title).toLowerCase();

  return {
    stories: materials.stories
      .filter((s) =>
        s.relevantTopics.some(
          (t) =>
            query.includes(t.toLowerCase()) ||
            section.h2Title.toLowerCase().includes(t.toLowerCase()),
        ),
      )
      .slice(0, 2),
    statistics: materials.statistics
      .filter(
        (s) =>
          s.fact.toLowerCase().includes(query.substring(0, 10)) ||
          query.includes(s.fact.substring(0, 10).toLowerCase()),
      )
      .slice(0, 3),
    quotes: materials.quotes
      .filter((q) =>
        q.relevantTopics.some((t) => query.includes(t.toLowerCase())),
      )
      .slice(0, 1),
    cases: materials.cases
      .filter((c) =>
        c.relevantTopics.some((t) => query.includes(t.toLowerCase())),
      )
      .slice(0, 1),
  };
}

/**
 * Round-robin fallback 分配素材
 */
export function distributeByRoundRobin(
  materials: MaterialsProfile,
  sectionCount: number,
): Partial<MaterialsProfile>[] {
  const result: Partial<MaterialsProfile>[] = Array.from(
    { length: sectionCount },
    () => ({
      stories: [],
      statistics: [],
      quotes: [],
      cases: [],
    }),
  );

  const allItems = [
    ...materials.stories.map((s) => ({ type: "stories" as const, item: s })),
    ...materials.statistics.map((s) => ({
      type: "statistics" as const,
      item: s,
    })),
    ...materials.quotes.map((q) => ({ type: "quotes" as const, item: q })),
    ...materials.cases.map((c) => ({ type: "cases" as const, item: c })),
  ];

  allItems.forEach((entry, i) => {
    const sectionIdx = i % sectionCount;
    const target = result[sectionIdx];
    if (entry.type === "stories")
      (target.stories as typeof materials.stories).push(entry.item);
    else if (entry.type === "statistics")
      (target.statistics as typeof materials.statistics).push(entry.item);
    else if (entry.type === "quotes")
      (target.quotes as typeof materials.quotes).push(entry.item);
    else if (entry.type === "cases")
      (target.cases as typeof materials.cases).push(entry.item);
  });

  return result;
}
