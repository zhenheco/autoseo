import { marked } from "marked";
import type {
  WritingAgentOutput,
  ContentAssemblerOutput,
  StrategyOutput,
  ArticleStatistics,
  ReadabilityMetrics,
  KeywordUsage,
  InternalLink,
  Outline,
} from "@/types/agents";

interface AdapterStrategyInput {
  selectedTitle: string;
  outline: Outline;
  keywords?: string[];
  targetSections?: string[];
  competitorAnalysis?: unknown[];
  contentGaps?: string[];
}

/**
 * Multi-Agent Output Adapter
 * 將 ContentAssemblerAgent 的輸出轉換為 WritingAgent 期望的格式
 */
export class MultiAgentOutputAdapter {
  /**
   * 轉換 ContentAssembler 輸出為 WritingAgent 格式
   */
  async adapt(input: {
    assemblerOutput: ContentAssemblerOutput;
    strategyOutput: AdapterStrategyInput;
    focusKeyword: string;
  }): Promise<WritingAgentOutput> {
    const { assemblerOutput, focusKeyword } = input;

    if (!assemblerOutput) {
      console.error("[OutputAdapter] ❌ assemblerOutput is null/undefined");
      return this.buildEmptyOutput();
    }

    let html = assemblerOutput.html;
    const markdown = assemblerOutput.markdown || "";

    html = await this.resolveAndValidateHTML(html, markdown);

    return {
      markdown,
      html,
      statistics: assemblerOutput.statistics,
      readability: this.calculateReadability(markdown),
      keywordUsage: this.analyzeKeywordUsage(markdown, focusKeyword),
      internalLinks: this.extractInternalLinks(html),
    };
  }

  private async resolveAndValidateHTML(
    html: unknown,
    markdown: string,
  ): Promise<string> {
    if (html && typeof (html as Promise<unknown>).then === "function") {
      console.warn("[OutputAdapter] ⚠️ HTML is a Promise, awaiting...");
      try {
        html = await (html as Promise<unknown>);
        console.log("[OutputAdapter] ✅ Promise resolved successfully");
      } catch (error) {
        console.error("[OutputAdapter] ❌ Promise resolution failed:", error);
        html = null;
      }
    }

    if (html && typeof html === "object" && html !== null) {
      console.warn("[OutputAdapter] ⚠️ HTML is an object, extracting...");
      const obj = html as Record<string, unknown>;
      if (typeof obj.html === "string") {
        html = obj.html;
        console.log("[OutputAdapter] ✅ Extracted html property from object");
      } else if (typeof obj.content === "string") {
        html = obj.content;
        console.log(
          "[OutputAdapter] ✅ Extracted content property from object",
        );
      } else {
        console.error("[OutputAdapter] ❌ Object has no html/content property");
        html = null;
      }
    }

    if (!this.validateHTML(html)) {
      console.warn(
        "[OutputAdapter] ⚠️ HTML validation failed, attempting re-conversion...",
      );

      if (typeof markdown === "string" && markdown.trim().length > 0) {
        try {
          const converted = await marked.parse(markdown);

          if (!this.validateHTML(converted)) {
            console.error("[OutputAdapter] ❌ Re-conversion failed validation");
            return `<div class="content-fallback">${String(converted)}</div>`;
          } else {
            console.log("[OutputAdapter] ✅ Re-conversion successful");
            return converted;
          }
        } catch (error) {
          console.error("[OutputAdapter] ❌ Re-conversion error:", error);
          return `<div class="content-error">${markdown}</div>`;
        }
      } else {
        return '<div class="content-empty"></div>';
      }
    }

    console.log("[OutputAdapter] ✅ HTML validation passed");

    // 🔧 修改：先清理再驗證，而不是檢測到 markdown 就重新轉換
    let cleaned = this.cleanupResidualMarkdown(html as string);

    // 只有當清理後仍然有嚴重 markdown 問題（標題、程式碼區塊）才重新轉換
    if (this.hasSeriousMarkdownIssues(cleaned)) {
      console.warn("[OutputAdapter] ⚠️ 嚴重 markdown 問題，需要重新轉換");
      try {
        cleaned = await marked.parse(cleaned);
        cleaned = this.cleanupResidualMarkdown(cleaned);
      } catch (error) {
        console.error("[OutputAdapter] ❌ Force re-conversion failed:", error);
      }
    }

    return cleaned;
  }

  /**
   * 只檢測嚴重的 markdown 問題（標題、程式碼區塊）
   * 小問題（粗體、斜體）由 cleanupResidualMarkdown 處理即可
   */
  private hasSeriousMarkdownIssues(html: string): boolean {
    const seriousPatterns = [
      /^#{1,6}\s+/m, // 行首標題（嚴重）
      /```[\s\S]*?```/, // 程式碼區塊（嚴重）
    ];
    return seriousPatterns.some((p) => p.test(html));
  }

  /**
   * 檢測 HTML 中是否有任何 markdown 語法（用於最終驗證）
   */
  private hasMarkdownSyntax(html: string): boolean {
    const markdownPatterns = [
      /^#{1,6}\s+/m, // 標題
      /^>\s+/m, // 引用
      /\*\*[^*]+\*\*/, // 粗體
      /\[([^\]]+)\]\([^)]+\)/, // 連結
      /^[-*+]\s+/m, // 無序列表
      /^\d+\.\s+/m, // 有序列表
      /```/, // 程式碼區塊
      /<[^>]*>.*#{1,6}\s/, // HTML 標籤內有 markdown 標題
      /<p>\s*#{1,6}\s/, // <p> 內的 markdown 標題
    ];
    return markdownPatterns.some((pattern) => pattern.test(html));
  }

  private cleanupResidualMarkdown(html: string): string {
    let cleaned = html;

    // Step 1: 清理 JSON 結構殘留（如 { "content": "..." }）
    cleaned = cleaned.replace(/\{\s*"content"\s*:\s*"/g, "");
    cleaned = cleaned.replace(/"\s*\}\s*$/g, "");
    cleaned = cleaned.replace(/\\n/g, "\n");

    // Step 1.5: 處理 HTML 標籤內的 markdown 標題（如 <p>## 標題</p>）
    cleaned = cleaned.replace(
      /<p>\s*(#{1,6})\s+([^<]+)<\/p>/g,
      (_, hashes, text) => {
        const level = hashes.length;
        return `<h${level}>${text.trim()}</h${level}>`;
      },
    );

    // Step 1.6: 處理 blockquote 內的 markdown
    cleaned = cleaned.replace(
      /<blockquote>([\s\S]*?)<\/blockquote>/g,
      (_, inner) => {
        let fixed = inner;
        fixed = fixed.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        fixed = fixed.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
        return `<blockquote>${fixed}</blockquote>`;
      },
    );

    // Step 2: 清理 markdown 標題（更寬鬆的匹配）
    cleaned = cleaned.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
    cleaned = cleaned.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
    cleaned = cleaned.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
    cleaned = cleaned.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
    cleaned = cleaned.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
    cleaned = cleaned.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

    // Step 3: 清理引用區塊 > text -> <blockquote>
    cleaned = cleaned.replace(
      /^>\s*(.+)$/gm,
      "<blockquote><p>$1</p></blockquote>",
    );
    // 合併連續的 blockquote
    cleaned = cleaned.replace(/<\/blockquote>\s*<blockquote>/g, "\n");

    // Step 4: 清理粗體語法 **text** -> <strong>text</strong>
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    // Step 5: 清理斜體語法 *text* -> <em>text</em>
    cleaned = cleaned.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");

    // Step 6: 清理連結語法 [text](url) -> <a href="url">text</a>
    cleaned = cleaned.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2">$1</a>',
    );

    // Step 7: 清理行內程式碼 `code` -> <code>code</code>
    cleaned = cleaned.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Step 8: 清理程式碼區塊 ```language\ncode``` -> <pre><code class="language-xxx">code</code></pre>
    cleaned = cleaned.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const langClass = lang ? ` class="language-${lang}"` : "";
      const escapedCode = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<pre><code${langClass}>${escapedCode.trim()}</code></pre>`;
    });

    // Step 9: 清理無序列表 - item -> <li>item</li>
    cleaned = cleaned.replace(/^[-*+]\s+(.+)$/gm, "<li>$1</li>");
    // 包裝連續的 <li> 為 <ul>
    cleaned = cleaned.replace(/(<li>[\s\S]*?<\/li>)(\s*<li>)/g, "$1$2");

    // Step 10: 清理有序列表 1. item -> <li>item</li>
    cleaned = cleaned.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");

    // Step 11: 清理水平線 --- -> <hr>
    cleaned = cleaned.replace(/^[-*_]{3,}$/gm, "<hr>");

    // Step 12: 清理多餘的空白行
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

    // Step 13: 將純文字段落包裝為 <p>
    const lines = cleaned.split("\n\n");
    cleaned = lines
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return "";
        if (trimmed.startsWith("<")) return trimmed;
        return `<p>${trimmed}</p>`;
      })
      .filter(Boolean)
      .join("\n");

    if (cleaned !== html) {
      console.log(
        "[OutputAdapter] 🧹 Cleaned up residual markdown syntax in HTML",
      );
    }

    return cleaned;
  }

  private buildEmptyOutput(): WritingAgentOutput {
    return {
      markdown: "",
      html: '<div class="content-empty"></div>',
      statistics: { totalWords: 0, totalParagraphs: 0, totalSections: 0 },
      readability: {
        fleschReadingEase: 0,
        fleschKincaidGrade: 0,
        gunningFog: 0,
        averageSentenceLength: 0,
        averageWordLength: 0,
      },
      keywordUsage: {
        keyword: "",
        count: 0,
        density: 0,
        positions: [],
        inTitle: false,
        inHeadings: false,
        inFirstParagraph: false,
        inLastParagraph: false,
      },
      internalLinks: [],
    };
  }

  /**
   * 驗證 HTML 有效性（Type Guard 模式）
   */
  private validateHTML(html: unknown): html is string {
    // Step 1: 類型檢查
    if (typeof html !== "string") {
      console.warn("[OutputAdapter] Validation failed: html is not a string", {
        type: typeof html,
        value:
          html === null ? "null" : html === undefined ? "undefined" : "other",
      });
      return false;
    }

    // Step 2: 空值檢查
    if (html.trim().length === 0) {
      console.warn("[OutputAdapter] Validation failed: Empty HTML");
      return false;
    }

    // Step 3: 基本標籤檢查
    if (!html.includes("<") || !html.includes(">")) {
      console.warn("[OutputAdapter] Validation failed: No HTML tags found");
      return false;
    }

    // Step 4: 殘留 Markdown 檢查
    const markdownPatterns = ["## ", "** ", "```"];
    if (markdownPatterns.some((p) => html.includes(p))) {
      console.warn(
        "[OutputAdapter] Validation failed: Markdown syntax detected",
        {
          sample: html.substring(0, 200),
        },
      );
      return false;
    }

    return true;
  }

  /**
   * 計算可讀性指標
   */
  private calculateReadability(markdown: string): ReadabilityMetrics {
    const text = markdown
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*_~`]/g, "")
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
      .replace(/^[-*+]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "")
      .replace(/^>\s+/gm, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]+`/g, "")
      .replace(/\n{2,}/g, "\n")
      .trim();

    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const syllables = words.reduce((count, word) => {
      return count + this.countSyllables(word);
    }, 0);

    const sentenceCount = Math.max(sentences.length, 1);
    const wordCount = Math.max(words.length, 1);
    const syllableCount = Math.max(syllables, 1);

    // Flesch Reading Ease Score
    const fleschScore = Math.max(
      0,
      Math.min(
        100,
        206.835 -
          1.015 * (wordCount / sentenceCount) -
          84.6 * (syllableCount / wordCount),
      ),
    );

    // Flesch-Kincaid Grade Level
    const fleschKincaidGrade = Math.max(
      0,
      0.39 * (wordCount / sentenceCount) +
        11.8 * (syllableCount / wordCount) -
        15.59,
    );

    // Gunning Fog Index
    const complexWords = words.filter(
      (word) => this.countSyllables(word) >= 3,
    ).length;
    const gunningFog =
      0.4 * (wordCount / sentenceCount + 100 * (complexWords / wordCount));

    return {
      fleschReadingEase: Math.round(fleschScore),
      fleschKincaidGrade: Math.round(fleschKincaidGrade * 10) / 10,
      gunningFog: Math.round(gunningFog * 10) / 10,
      averageSentenceLength: Math.round(wordCount / sentenceCount),
      averageWordLength:
        Math.round(((text.length - words.length + 1) / wordCount) * 10) / 10,
    };
  }

  /**
   * 計算音節數
   */
  private countSyllables(word: string): number {
    word = word.toLowerCase();
    let count = 0;
    const vowels = "aeiouy";
    let previousWasVowel = false;

    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i]);
      if (isVowel && !previousWasVowel) {
        count++;
      }
      previousWasVowel = isVowel;
    }

    // 調整規則
    if (word.endsWith("e")) {
      count--;
    }
    if (
      word.endsWith("le") &&
      word.length > 2 &&
      !vowels.includes(word[word.length - 3])
    ) {
      count++;
    }
    if (count === 0) {
      count = 1;
    }

    return count;
  }

  /**
   * 分析關鍵字使用情況
   */
  private analyzeKeywordUsage(
    markdown: string,
    focusKeyword: string,
  ): KeywordUsage {
    const text = markdown.toLowerCase();
    const keyword = focusKeyword.toLowerCase();

    // 計算關鍵字出現次數
    const regex = new RegExp(
      `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "gi",
    );
    const matches = text.match(regex) || [];
    const count = matches.length;

    // 計算總字數
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const totalWords = words.length;

    // 計算密度
    const density = totalWords > 0 ? (count / totalWords) * 100 : 0;

    // 分析位置分佈
    const positions: string[] = [];

    // 檢查標題
    const titleRegex = new RegExp(`^#\\s+.*${keyword}.*$`, "mi");
    if (titleRegex.test(markdown)) {
      positions.push("title");
    }

    // 檢查副標題
    const headingRegex = new RegExp(`^##\\s+.*${keyword}.*$`, "gmi");
    if (headingRegex.test(markdown)) {
      positions.push("headings");
    }

    // 檢查第一段
    const paragraphs = markdown
      .split("\n\n")
      .filter((p) => p.trim() && !p.startsWith("#"));
    if (
      paragraphs.length > 0 &&
      paragraphs[0].toLowerCase().includes(keyword)
    ) {
      positions.push("firstParagraph");
    }

    // 檢查最後一段
    if (
      paragraphs.length > 0 &&
      paragraphs[paragraphs.length - 1].toLowerCase().includes(keyword)
    ) {
      positions.push("lastParagraph");
    }

    return {
      keyword: focusKeyword,
      count,
      density: Math.round(density * 100) / 100,
      positions,
      inTitle: positions.includes("title"),
      inHeadings: positions.includes("headings"),
      inFirstParagraph: positions.includes("firstParagraph"),
      inLastParagraph: positions.includes("lastParagraph"),
    };
  }

  /**
   * 從 HTML 擷取內部連結
   */
  private extractInternalLinks(html: string): InternalLink[] {
    const links: InternalLink[] = [];

    // 使用正則表達式匹配所有 <a> 標籤
    const linkRegex = /<a\s+[^>]*?href=["']([^"']+)["'][^>]*?>([^<]+)<\/a>/gi;

    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1];
      const anchor = match[2];

      // Extract title attribute separately
      const fullTag = html.substring(
        html.lastIndexOf("<a", linkRegex.lastIndex - 1),
        linkRegex.lastIndex,
      );
      const titleMatch = fullTag.match(/title=["']([^"']+)["']/);
      const title = titleMatch ? titleMatch[1] : "";

      // 判斷是否為內部連結（以 / 或 # 開頭，或不包含 http(s)://）
      const isInternal =
        url.startsWith("/") ||
        url.startsWith("#") ||
        (!url.startsWith("http://") &&
          !url.startsWith("https://") &&
          !url.startsWith("//"));

      if (isInternal) {
        links.push({
          url,
          anchor,
          title: title || anchor,
          isInternal: true,
        });
      }
    }

    return links;
  }
}
