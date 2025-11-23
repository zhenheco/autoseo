# 修復多 Agent 架構的文章儲存和錯誤追蹤

> **完整實作指南** - 工程師可獨立完成

---

## 📋 快速開始

### 問題概述

當前多 Agent 文章生成架構存在以下問題：

1. ✅ **已確認**：文章生成完成但未儲存到資料庫
2. ✅ **已確認**：`ContentAssemblerAgent` 輸出格式缺少 3 個欄位
3. ✅ **已確認**：錯誤訊息缺失或不完整

### 解決方案

1. **Output Adapter**：轉換格式，補充缺失的欄位
2. **Error Tracker**：強化錯誤追蹤，寫入資料庫
3. **State Management**：完善狀態保存和恢復
4. **Monitoring**：GitHub Actions 定期監控

---

## 🚀 實作步驟

### Phase 1: 核心架構（Day 1-2）

#### Step 1.1: 建立 Output Adapter

**建立檔案**：`src/lib/agents/output-adapter.ts`

```typescript
/**
 * Multi-Agent Output Adapter
 * 將 ContentAssembler 輸出轉換為 WritingAgent 標準格式
 */

import type {
  ContentAssemblerOutput,
  StrategyAgentOutput,
  WritingAgentOutput,
} from "@/types/agents";

export interface AdapterInput {
  assemblerOutput: ContentAssemblerOutput;
  strategyOutput: StrategyAgentOutput;
  focusKeyword: string;
}

interface ReadabilityMetrics {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  gunningFogIndex: number;
}

interface KeywordUsage {
  count: number;
  density: number;
  positions?: number[];
}

interface InternalLink {
  url: string;
  title: string;
  anchor: string;
}

export class MultiAgentOutputAdapter {
  adapt(input: AdapterInput): WritingAgentOutput {
    const { assemblerOutput, strategyOutput, focusKeyword } = input;

    // 補充缺失的欄位
    const readability = this.calculateReadability(assemblerOutput.markdown);
    const keywordUsage = this.analyzeKeywordUsage(
      assemblerOutput.markdown,
      focusKeyword,
    );
    const internalLinks = this.extractInternalLinks(assemblerOutput.html);

    return {
      markdown: assemblerOutput.markdown,
      html: assemblerOutput.html,
      statistics: {
        ...assemblerOutput.statistics,
        readingTime: this.calculateReadingTime(
          assemblerOutput.statistics.totalWords,
        ),
        sentenceCount: this.countSentences(assemblerOutput.markdown),
        wordCount: assemblerOutput.statistics.totalWords,
        paragraphCount: assemblerOutput.statistics.totalParagraphs,
      },
      readability,
      keywordUsage,
      internalLinks,
      executionInfo: assemblerOutput.executionInfo,
    };
  }

  private calculateReadability(markdown: string): ReadabilityMetrics {
    // 移除 Markdown 語法
    const plainText = markdown
      .replace(/!\[.*?\]\(.*?\)/g, "") // 移除圖片
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // 移除連結，保留文字
      .replace(/[#*`_~]/g, "") // 移除格式符號
      .trim();

    const sentences = this.getSentences(plainText);
    const words = this.getWords(plainText);
    const syllables = this.countSyllables(words);

    // Flesch Reading Ease: 206.835 - 1.015(words/sentences) - 84.6(syllables/words)
    const fleschReadingEase = Math.max(
      0,
      Math.min(
        100,
        206.835 -
          1.015 * (words.length / Math.max(sentences.length, 1)) -
          84.6 * (syllables / Math.max(words.length, 1)),
      ),
    );

    // Flesch-Kincaid Grade Level: 0.39(words/sentences) + 11.8(syllables/words) - 15.59
    const fleschKincaidGrade = Math.max(
      0,
      0.39 * (words.length / Math.max(sentences.length, 1)) +
        11.8 * (syllables / Math.max(words.length, 1)) -
        15.59,
    );

    // Gunning Fog Index: 0.4 * ((words/sentences) + 100 * (complex_words/words))
    const complexWords = words.filter(
      (word) => this.syllableCount(word) > 2,
    ).length;
    const gunningFogIndex = Math.max(
      0,
      0.4 *
        (words.length / Math.max(sentences.length, 1) +
          100 * (complexWords / Math.max(words.length, 1))),
    );

    return {
      fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
      fleschKincaidGrade: Math.round(fleschKincaidGrade * 10) / 10,
      gunningFogIndex: Math.round(gunningFogIndex * 10) / 10,
    };
  }

  private getSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  private getWords(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0 && /[a-z]/.test(w));
  }

  private countSyllables(words: string[]): number {
    return words.reduce((total, word) => total + this.syllableCount(word), 0);
  }

  private syllableCount(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;

    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
    word = word.replace(/^y/, "");

    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
  }

  private analyzeKeywordUsage(markdown: string, keyword: string): KeywordUsage {
    const lowerText = markdown.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();

    // 計算出現次數
    const regex = new RegExp(`\\b${lowerKeyword}\\b`, "gi");
    const matches = lowerText.match(regex);
    const count = matches ? matches.length : 0;

    // 計算密度
    const words = this.getWords(markdown);
    const density = words.length > 0 ? (count / words.length) * 100 : 0;

    return {
      count,
      density: Math.round(density * 100) / 100,
    };
  }

  private extractInternalLinks(html: string): InternalLink[] {
    const links: InternalLink[] = [];
    const regex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi;

    let match;
    while ((match = regex.exec(html)) !== null) {
      const url = match[1];
      const anchor = match[2].replace(/<[^>]+>/g, "").trim();

      // 只保留內部連結（相對路徑或同域名）
      if (url.startsWith("/") || url.startsWith("#") || !url.includes("://")) {
        links.push({
          url,
          title: anchor,
          anchor,
        });
      }
    }

    return links;
  }

  private calculateReadingTime(wordCount: number): number {
    // 假設閱讀速度：每分鐘 200 字
    return Math.ceil(wordCount / 200);
  }

  private countSentences(markdown: string): number {
    const plainText = markdown.replace(/[#*`_~]/g, "").trim();
    return this.getSentences(plainText).length;
  }
}
```

**檢查清單**：

- [ ] 檔案建立完成
- [ ] 所有方法都實作
- [ ] TypeScript 無錯誤

---

#### Step 1.2: 更新型別定義

**修改檔案**：`src/types/agents.ts`

在檔案末尾加入：

```typescript
// Output Adapter 相關型別
export interface AdapterInput {
  assemblerOutput: ContentAssemblerOutput;
  strategyOutput: StrategyAgentOutput;
  focusKeyword: string;
}

export interface ReadabilityMetrics {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  gunningFogIndex: number;
}

export interface KeywordUsage {
  count: number;
  density: number;
  positions?: number[];
}

export interface InternalLink {
  url: string;
  title: string;
  anchor: string;
}
```

**檢查清單**：

- [ ] 型別定義已加入
- [ ] TypeScript 無錯誤

---

#### Step 1.3: 整合到 Orchestrator

**修改檔案**：`src/lib/agents/orchestrator.ts`

**位置 1**：頂部 import（約 Line 1-20）

```typescript
// 加入這一行
import { MultiAgentOutputAdapter } from "./output-adapter";
```

**位置 2**：`executeContentGeneration` 方法結尾（約 Line 200-210）

找到這段程式碼：

```typescript
const assemblerOutput = await contentAssembler.execute({
  title,
  introduction,
  sections,
  conclusion,
  qa,
});

return assemblerOutput; // ← 修改這裡
```

改為：

```typescript
const assemblerOutput = await contentAssembler.execute({
  title,
  introduction,
  sections,
  conclusion,
  qa,
});

// 新增：格式轉換
try {
  const adapter = new MultiAgentOutputAdapter();
  const writingOutput = adapter.adapt({
    assemblerOutput,
    strategyOutput,
    focusKeyword: input.focusKeyphrase || strategyOutput.selectedTitle,
  });

  console.log("[Orchestrator] ✅ Output adapter successfully converted format");
  return writingOutput;
} catch (adapterError) {
  console.error("[Orchestrator] ❌ Output adapter failed:", adapterError);
  // Fallback: 拋出錯誤，讓上層處理
  throw adapterError;
}
```

**檢查清單**：

- [ ] import 已加入
- [ ] 格式轉換邏輯已加入
- [ ] TypeScript 無錯誤
- [ ] `npm run build` 成功

---

#### Step 1.4: ArticleStorage 驗證強化

**修改檔案**：`src/lib/services/article-storage.ts`

**位置 1**：建立 ValidationError 類別（檔案開頭）

```typescript
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
```

**位置 2**：修改 `saveArticle` 方法（約 Line 32）

```typescript
async saveArticle(params: SaveArticleParams): Promise<SavedArticle> {
  const { articleJobId, result, websiteId, companyId, userId } = params;

  // 新增：驗證必要欄位
  this.validateInput(result);

  // 原有的儲存邏輯...
  if (!result.writing || !result.meta) {
    throw new Error('文章內容或 Metadata 不完整');
  }

  // ... 其餘不變
}
```

**位置 3**：加入驗證方法（類別結尾）

```typescript
private validateInput(result: ArticleGenerationResult): void {
  // 檢查必要欄位存在
  if (!result.writing) {
    throw new ValidationError('Missing required field: result.writing');
  }

  if (!result.meta) {
    throw new ValidationError('Missing required field: result.meta');
  }

  // 檢查 writing 子欄位
  const requiredFields = [
    'markdown',
    'html',
    'statistics',
    'readability',
    'keywordUsage',
    'internalLinks',
  ];

  for (const field of requiredFields) {
    if (!result.writing[field]) {
      throw new ValidationError(`Missing required field: result.writing.${field}`);
    }
  }

  // 檢查資料類型
  this.validateTypes(result);

  // 檢查數值範圍
  this.validateRanges(result);
}

private validateTypes(result: ArticleGenerationResult): void {
  const { writing } = result;

  if (typeof writing.statistics.wordCount !== 'number') {
    throw new ValidationError('Invalid type for wordCount: expected number');
  }

  if (typeof writing.readability.fleschReadingEase !== 'number') {
    throw new ValidationError('Invalid type for fleschReadingEase: expected number');
  }

  if (typeof writing.readability.fleschKincaidGrade !== 'number') {
    throw new ValidationError('Invalid type for fleschKincaidGrade: expected number');
  }

  if (typeof writing.readability.gunningFogIndex !== 'number') {
    throw new ValidationError('Invalid type for gunningFogIndex: expected number');
  }

  if (typeof writing.keywordUsage.density !== 'number') {
    throw new ValidationError('Invalid type for keywordUsage.density: expected number');
  }

  if (typeof writing.keywordUsage.count !== 'number') {
    throw new ValidationError('Invalid type for keywordUsage.count: expected number');
  }

  if (!Array.isArray(writing.internalLinks)) {
    throw new ValidationError('Invalid type for internalLinks: expected array');
  }
}

private validateRanges(result: ArticleGenerationResult): void {
  const { writing } = result;

  // wordCount 範圍檢查
  if (writing.statistics.wordCount <= 0 || writing.statistics.wordCount > 100000) {
    throw new ValidationError(
      `Value out of range for wordCount: ${writing.statistics.wordCount} (expected 1-100000)`
    );
  }

  // fleschReadingEase 範圍檢查
  if (
    writing.readability.fleschReadingEase < 0 ||
    writing.readability.fleschReadingEase > 100
  ) {
    throw new ValidationError(
      `Value out of range for fleschReadingEase: ${writing.readability.fleschReadingEase} (expected 0-100)`
    );
  }

  // density 範圍檢查
  if (writing.keywordUsage.density < 0 || writing.keywordUsage.density > 100) {
    throw new ValidationError(
      `Value out of range for density: ${writing.keywordUsage.density} (expected 0-100)`
    );
  }
}
```

**檢查清單**：

- [ ] ValidationError 類別已加入
- [ ] validateInput 方法已加入
- [ ] validateTypes 方法已加入
- [ ] validateRanges 方法已加入
- [ ] TypeScript 無錯誤
- [ ] `npm run build` 成功

---

**Phase 1 測試**：

```bash
# 1. 建置檢查
npm run build

# 2. 類型檢查
npm run typecheck

# 3. Lint 檢查
npm run lint

# 4. 觸發一次文章生成（透過 UI 或 API）
# 5. 檢查 generated_articles 是否有新記錄
# 6. 檢查所有欄位是否都有值
```

---

### Phase 2: 錯誤追蹤（Day 3）

#### Step 2.1: 強化 Error Tracker

**修改檔案**：`src/lib/agents/error-tracker.ts`

找到 `constructor` 並修改：

```typescript
constructor(
  private articleJobId: string,
  private supabase: SupabaseClient  // 新增這個參數
) {
  this.errors = [];
}
```

在類別中加入新方法：

```typescript
async trackError(error: TrackedError): Promise<void> {
  // 原有的記憶體追蹤
  this.errors.push(error);

  // 新增：寫入資料庫
  await this.saveToDatabase(error);
}

private async saveToDatabase(error: TrackedError): Promise<void> {
  try {
    // 1. 讀取現有的 metadata
    const { data: job } = await this.supabase
      .from('article_generation_jobs')
      .select('metadata')
      .eq('id', this.articleJobId)
      .single();

    const metadata = (job?.metadata as Record<string, any>) || {};
    const existingErrors = metadata.errors || [];

    // 2. 新增錯誤（只保留最新 10 個）
    const updatedErrors = [
      ...existingErrors,
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        agent: error.agent,
        phase: error.phase,
        message: error.error,
        context: error.context,
      },
    ].slice(-10);

    // 3. 更新 metadata
    await this.supabase
      .from('article_generation_jobs')
      .update({
        metadata: {
          ...metadata,
          errors: updatedErrors,
          lastError: {
            timestamp: new Date().toISOString(),
            message: error.error,
          },
        },
      })
      .eq('id', this.articleJobId);

    console.log(`[ErrorTracker] ✅ Error saved to database: ${error.agent}`);
  } catch (dbError) {
    console.error('[ErrorTracker] ❌ Failed to save error to database:', dbError);
  }
}

generateSummary(): string {
  if (this.errors.length === 0) {
    return 'No errors occurred';
  }

  const summary = [`Total errors: ${this.errors.length}`, '', 'Error breakdown:'];

  // 按 agent 分組
  const groupedByAgent = this.errors.reduce((acc, error) => {
    if (!acc[error.agent]) {
      acc[error.agent] = [];
    }
    acc[error.agent].push(error);
    return acc;
  }, {} as Record<string, TrackedError[]>);

  for (const [agent, errors] of Object.entries(groupedByAgent)) {
    summary.push(`- ${agent}: ${errors.length} error(s)`);
    errors.forEach(err => {
      summary.push(`  - ${err.error}`);
    });
  }

  return summary.join('\n');
}
```

**檢查清單**：

- [ ] constructor 參數已更新
- [ ] saveToDatabase 方法已加入
- [ ] generateSummary 方法已加入
- [ ] TypeScript 無錯誤

---

#### Step 2.2: 更新 Orchestrator 錯誤追蹤

**修改檔案**：`src/lib/agents/orchestrator.ts`

找到建立 ErrorTracker 的地方（約 Line 100-150），確保傳入 `supabase`：

```typescript
this.errorTracker = new ErrorTracker(
  input.articleJobId,
  this.supabase, // 確保有這個參數
);
```

找到所有 Agent 執行的地方，加入錯誤追蹤。例如 IntroductionAgent：

```typescript
// Introduction Agent 執行
try {
  const introduction = await introAgent.execute(...);
  await this.updateJobStatus('introduction_completed', { introduction });
} catch (error) {
  await this.errorTracker.trackError({
    agent: 'IntroductionAgent',
    phase: 'content_generation',
    error: error instanceof Error ? error.message : String(error),
    context: {
      retryCount: this.retryCount || 0,
      focusKeyphrase: input.focusKeyphrase,
    },
  });
  throw error;
}
```

對所有 Agent 都加入類似的錯誤追蹤：

- IntroductionAgent
- SectionAgent (每個 section)
- ConclusionAgent
- QAAgent
- ContentAssemblerAgent

最後，在最終失敗處理加入摘要：

```typescript
} catch (finalError) {
  console.error('[Orchestrator] ❌ Final failure:', finalError);

  const errorSummary = this.errorTracker.generateSummary();

  await this.supabase
    .from('article_generation_jobs')
    .update({
      status: 'failed',
      error_message: errorSummary,
    })
    .eq('id', this.articleJobId);

  throw finalError;
}
```

**檢查清單**：

- [ ] ErrorTracker 建構時傳入 supabase
- [ ] 所有 Agent 執行都有錯誤追蹤
- [ ] 最終失敗時生成摘要
- [ ] TypeScript 無錯誤

---

### Phase 3: 監控系統（Day 4）

#### Step 3.1: 建立監控 API Endpoint

**建立檔案**：`src/app/api/cron/monitor-article-jobs/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    // 1. 驗證請求來源
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (token !== process.env.CRON_API_SECRET) {
      console.log("[Monitor] ❌ Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Monitor] ✅ Request authorized");

    // 2. 連接資料庫
    const supabase = await createClient();

    // 3. 查詢所有 processing jobs
    const { data: jobs, error } = await supabase
      .from("article_generation_jobs")
      .select("*")
      .eq("status", "processing");

    if (error) {
      console.error("[Monitor] ❌ Database query failed:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!jobs || jobs.length === 0) {
      console.log("[Monitor] ℹ️ No processing jobs found");
      return NextResponse.json({ processed: 0 });
    }

    console.log(`[Monitor] 📊 Found ${jobs.length} processing jobs`);

    const results = {
      processed: 0,
      timeout: 0,
      stuck: 0,
      retried: 0,
    };

    // 4. 檢查每個 job
    for (const job of jobs) {
      const createdAt = new Date(job.created_at);
      const updatedAt = new Date(job.updated_at);
      const now = new Date();

      const totalDuration = (now.getTime() - createdAt.getTime()) / 1000 / 60; // 分鐘
      const phaseDuration = (now.getTime() - updatedAt.getTime()) / 1000 / 60; // 分鐘

      // 檢查超時（> 30 分鐘）
      if (totalDuration > 30) {
        console.log(
          `[Monitor] ⏰ Job ${job.id} timeout (${totalDuration.toFixed(1)}min)`,
        );

        const metadata = (job.metadata as Record<string, any>) || {};
        const retryCount = metadata.retry_count || 0;

        if (retryCount < 1) {
          // 第一次失敗：重試
          await supabase
            .from("article_generation_jobs")
            .update({
              status: "failed",
              error_message: `Timeout after ${totalDuration.toFixed(1)} minutes`,
              metadata: {
                ...metadata,
                retry_count: retryCount + 1,
                retry_reason: "timeout",
              },
            })
            .eq("id", job.id);

          results.retried++;
          console.log(`[Monitor] 🔄 Marked for retry: ${job.id}`);
        } else {
          // 第二次失敗：永久失敗
          await supabase
            .from("article_generation_jobs")
            .update({
              status: "failed",
              error_message: `Permanent failure after ${retryCount + 1} attempts`,
            })
            .eq("id", job.id);

          console.log(`[Monitor] ❌ Permanent failure: ${job.id}`);
        }

        results.timeout++;
        results.processed++;
        continue;
      }

      // 檢查卡住（> 10 分鐘沒更新）
      if (phaseDuration > 10) {
        console.log(
          `[Monitor] ⚠️ Job ${job.id} stuck at ${job.current_phase} (${phaseDuration.toFixed(1)}min)`,
        );

        // TODO: 實作從該階段恢復的邏輯
        // await resumeFromPhase(job);

        results.stuck++;
        results.processed++;
        continue;
      }
    }

    console.log(`[Monitor] ✅ Monitoring complete:`, results);

    return NextResponse.json(results);
  } catch (error) {
    console.error("[Monitor] ❌ Monitoring failed:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
```

**檢查清單**：

- [ ] 檔案建立完成
- [ ] 驗證邏輯已實作
- [ ] 超時檢測已實作
- [ ] TypeScript 無錯誤

---

#### Step 3.2: 建立 GitHub Actions Workflow

**建立檔案**：`.github/workflows/monitor-article-jobs.yml`

```yaml
name: Monitor Article Jobs

on:
  schedule:
    - cron: "*/5 * * * *" # 每 5 分鐘執行一次
  workflow_dispatch: # 允許手動觸發

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - name: Call Monitoring API
        run: |
          echo "🚀 Calling monitoring API..."

          response=$(curl -s -w "\n%{http_code}" -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_API_SECRET }}" \
            -H "Content-Type: application/json" \
            "${{ secrets.APP_URL }}/api/cron/monitor-article-jobs")

          http_code=$(echo "$response" | tail -n1)
          body=$(echo "$response" | sed '$d')

          echo "📊 HTTP Status: $http_code"
          echo "📄 Response: $body"

          if [ "$http_code" != "200" ]; then
            echo "❌ Monitoring failed"
            exit 1
          fi

          echo "✅ Monitoring completed successfully"
```

**檢查清單**：

- [ ] 檔案建立完成
- [ ] Cron schedule 正確（每 5 分鐘）
- [ ] workflow_dispatch 已設定

---

#### Step 3.3: 設定環境變數

**本地環境**（`.env.local`）：

```bash
# 生成隨機 secret
CRON_API_SECRET=$(openssl rand -hex 32)

# 加入到 .env.local
echo "CRON_API_SECRET=$CRON_API_SECRET" >> .env.local
```

**GitHub Secrets**：

1. 前往 GitHub repository
2. Settings → Secrets and variables → Actions
3. 新增 secrets：
   - `CRON_API_SECRET`：與 `.env.local` 相同的值
   - `APP_URL`：你的應用程式 URL（例如：`https://your-app.vercel.app`）

**Vercel 環境變數**：

```bash
# 使用 Vercel CLI 設定
vercel env add CRON_API_SECRET production
# 貼上與 .env.local 相同的值
```

**檢查清單**：

- [ ] 本地 `.env.local` 已設定 `CRON_API_SECRET`
- [ ] GitHub Secrets 已設定 `CRON_API_SECRET` 和 `APP_URL`
- [ ] Vercel 環境變數已設定 `CRON_API_SECRET`

---

### Phase 4: 測試驗證（Day 5）

#### Test 1: 端到端測試

```bash
# 1. 建置檢查
npm run build

# 2. 觸發一次文章生成
# 透過 UI 或 API 觸發

# 3. 等待完成，檢查資料庫
psql $DATABASE_URL << EOF
SELECT
  id,
  status,
  current_phase,
  error_message,
  (metadata->>'errors') as has_errors
FROM article_generation_jobs
ORDER BY created_at DESC
LIMIT 5;

SELECT id, title, word_count, flesch_reading_ease, keyword_density
FROM generated_articles
ORDER BY created_at DESC
LIMIT 1;
EOF
```

**驗證項目**：

- [ ] 文章成功儲存到 `generated_articles`
- [ ] 所有欄位都有值（無 null）
- [ ] `flesch_reading_ease` 在 0-100 範圍內
- [ ] `keyword_density` > 0

---

#### Test 2: 手動觸發監控

```bash
# 手動呼叫監控 API
curl -X POST \
  -H "Authorization: Bearer $CRON_API_SECRET" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/cron/monitor-article-jobs
```

**預期輸出**：

```json
{
  "processed": 0,
  "timeout": 0,
  "stuck": 0,
  "retried": 0
}
```

**檢查清單**：

- [ ] API 回傳 200 狀態碼
- [ ] 未授權請求回傳 401
- [ ] 回傳格式正確

---

#### Test 3: GitHub Actions 測試

1. 前往 GitHub repository
2. Actions → Monitor Article Jobs
3. 點擊 "Run workflow"
4. 查看執行日誌

**檢查清單**：

- [ ] Workflow 成功執行
- [ ] API 呼叫成功（HTTP 200）
- [ ] 日誌清晰完整

---

### Phase 5: 部署（Day 6）

#### Deployment Checklist

**部署前檢查**：

- [ ] `npm run build` 成功
- [ ] `npm run typecheck` 無錯誤
- [ ] `npm run lint` 無錯誤
- [ ] 所有測試通過

**Commit 和 Push**：

```bash
git add .
git commit -m "實作: 修復多 Agent 架構的文章儲存和錯誤追蹤

- 新增 MultiAgentOutputAdapter 轉換格式
- 強化 ErrorTracker 資料庫寫入
- 實作 GitHub Actions 監控
- 完善輸入驗證

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

**等待 Vercel 部署**：

```bash
# 等待 90 秒
sleep 90

# 檢查部署狀態
vercel ls | head -8
```

**驗證部署**：

```bash
# 1. 測試首頁
curl -I https://your-app.vercel.app

# 2. 測試監控 API（應該回傳 401）
curl -I https://your-app.vercel.app/api/cron/monitor-article-jobs

# 3. 測試授權請求
curl -X POST \
  -H "Authorization: Bearer $CRON_API_SECRET" \
  https://your-app.vercel.app/api/cron/monitor-article-jobs
```

---

## 📊 最終驗收

在標記為完成前，確認：

- [ ] ✅ 文章儲存成功率 = 100%
- [ ] ✅ 所有欄位都有值（無 null）
- [ ] ✅ 錯誤都記錄到 metadata.errors
- [ ] ✅ GitHub Actions 每 5 分鐘執行
- [ ] ✅ 監控 API 正常運作
- [ ] ✅ Production 部署成功

---

## 🆘 常見問題

### Q1: TypeScript 錯誤 "Property 'readability' does not exist"

**解決方案**：確認型別定義已更新到 `src/types/agents.ts`

### Q2: 文章儲存時出現 ValidationError

**解決方案**：檢查 Output Adapter 是否正確執行，查看 console.log

### Q3: GitHub Actions 回傳 401

**解決方案**：檢查 GitHub Secrets 是否正確設定

### Q4: 監控 API 沒有處理任何 jobs

**解決方案**：正常現象，代表沒有 processing 的 jobs

---

## 📞 需要協助？

如有任何問題，請查看：

- OpenSpec 提案：`openspec/changes/fix-multi-agent-storage-and-errors/proposal.md`
- 設計文件：`openspec/changes/fix-multi-agent-storage-and-errors/design.md`
- 詳細任務：`openspec/changes/fix-multi-agent-storage-and-errors/tasks.md`

祝實作順利！🚀
