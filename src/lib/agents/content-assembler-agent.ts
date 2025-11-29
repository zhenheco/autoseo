import { marked } from "marked";
import type {
  ContentAssemblerInput,
  ContentAssemblerOutput,
} from "@/types/agents";

// 配置 marked 全局選項（與 WritingAgent 保持一致）
marked.use({
  async: true,
  gfm: true,
  breaks: false,
  pedantic: false,
});

export class ContentAssemblerAgent {
  async execute(input: ContentAssemblerInput): Promise<ContentAssemblerOutput> {
    const startTime = Date.now();

    this.validateInput(input);

    const { title, introduction, sections, conclusion, qa } = input;

    const markdownParts: string[] = [];

    markdownParts.push(`# ${title}`, "");

    markdownParts.push(introduction.markdown, "");

    sections.forEach((section) => {
      markdownParts.push(section.markdown, "");
    });

    markdownParts.push(conclusion.markdown, "");

    markdownParts.push(qa.markdown, "");

    let markdown = markdownParts.join("\n");

    markdown = this.cleanupMarkdown(markdown);

    let html = await this.convertToHTML(markdown);

    if (qa.schemaJson) {
      html += `\n<script type="application/ld+json">\n${qa.schemaJson}\n</script>`;
    }

    const statistics = this.calculateStatistics(markdown, sections, qa);

    const executionTime = Date.now() - startTime;

    return {
      markdown,
      html,
      statistics,
      executionInfo: {
        executionTime,
      },
    };
  }

  private validateInput(input: ContentAssemblerInput): void {
    if (!input.title || input.title.trim() === "") {
      throw new Error("Title is required");
    }

    if (!input.introduction || !input.introduction.markdown) {
      throw new Error("Introduction is required");
    }

    if (!input.sections || input.sections.length === 0) {
      throw new Error("At least one section is required");
    }

    const totalWords =
      input.introduction.wordCount +
      input.sections.reduce((sum, s) => sum + s.wordCount, 0) +
      (input.conclusion?.wordCount || 0);

    if (totalWords < 800) {
      throw new Error(
        `Total word count (${totalWords}) is below minimum (800)`,
      );
    }
  }

  private cleanupMarkdown(markdown: string): string {
    let cleaned = markdown;

    cleaned = cleaned.replace(/#{1,6}\s+#\s+/g, (match) => {
      return match.replace(/\s+#\s+/, " ");
    });

    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

    cleaned = cleaned.trim();

    return cleaned;
  }

  private async convertToHTML(markdown: string): Promise<string> {
    console.log("[ContentAssembler] 📝 Converting Markdown to HTML...");
    console.log("[ContentAssembler] Markdown length:", markdown.length);
    console.log(
      "[ContentAssembler] Markdown preview (first 300 chars):",
      markdown.substring(0, 300),
    );

    try {
      const html = await marked.parse(markdown);

      console.log("[ContentAssembler] ✅ Markdown parsed successfully");
      console.log("[ContentAssembler] HTML length:", html.length);
      console.log(
        "[ContentAssembler] HTML preview (first 300 chars):",
        html.substring(0, 300),
      );

      if (!this.isValidHTML(html, markdown)) {
        throw new Error("HTML validation failed after conversion");
      }

      console.log("[ContentAssembler] ✅ HTML validation passed", {
        markdownLength: markdown.length,
        htmlLength: html.length,
        ratio: (html.length / markdown.length).toFixed(2),
      });

      return html;
    } catch (error) {
      console.error("[ContentAssembler] ❌ Primary conversion failed:", {
        error: error instanceof Error ? error.message : String(error),
        markdownSample: markdown.substring(0, 500),
      });

      console.warn("[ContentAssembler] 🔄 Attempting fallback conversion...");

      try {
        const fallbackHtml = await this.fallbackConversion(markdown);

        if (!this.isValidHTML(fallbackHtml, markdown)) {
          throw new Error("Fallback HTML validation failed");
        }

        console.warn("[ContentAssembler] ⚠️  Fallback conversion succeeded", {
          method: "basicMarkdownToHTML",
          htmlLength: fallbackHtml.length,
        });

        return fallbackHtml;
      } catch (fallbackError) {
        console.error("[ContentAssembler] ❌ All conversion methods failed", {
          primaryError: error instanceof Error ? error.message : String(error),
          fallbackError:
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError),
          markdownLength: markdown.length,
        });

        throw new Error(
          `Failed to convert Markdown to HTML: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private isValidHTML(html: string, markdown: string): boolean {
    if (!html || html.trim().length === 0) {
      console.warn("[Validator] Empty HTML content");
      return false;
    }

    if (!html.includes("<") || !html.includes(">")) {
      console.warn("[Validator] No HTML tags found");
      return false;
    }

    // 檢查是否有未轉換的 Markdown 標題（行首的 ## 等）
    // 排除 code 區塊內的內容
    const htmlWithoutCode = html.replace(/<code[\s\S]*?<\/code>/gi, "");
    const htmlWithoutPre = htmlWithoutCode.replace(/<pre[\s\S]*?<\/pre>/gi, "");

    // 只檢查行首的 Markdown 標題語法（這表示真正未轉換）
    const unprocessedHeadings = /^#{1,6}\s+\S/m.test(htmlWithoutPre);
    if (unprocessedHeadings) {
      console.warn("[Validator] Unprocessed Markdown headings detected");
      return false;
    }

    // 檢查結構標籤（放寬條件：只要有任何 HTML 標籤即可）
    const structuralTags = [
      "<p>",
      "<h1>",
      "<h2>",
      "<h3>",
      "<h4>",
      "<ul>",
      "<ol>",
      "<div>",
      "<section>",
      "<article>",
    ];
    const hasStructure = structuralTags.some((tag) => html.includes(tag));
    if (!hasStructure) {
      console.warn("[Validator] No structural HTML tags found");
      return false;
    }

    // 放寬比例檢查：只要 HTML 長度合理即可（>50% markdown 長度）
    const ratio = html.length / markdown.length;
    if (ratio < 0.5) {
      console.warn("[Validator] HTML suspiciously short", {
        ratio: ratio.toFixed(2),
        markdownLength: markdown.length,
        htmlLength: html.length,
      });
      return false;
    }

    return true;
  }

  private async fallbackConversion(markdown: string): Promise<string> {
    console.log(
      "[ContentAssembler] Attempting basic Markdown to HTML conversion...",
    );

    // 分割成區塊處理
    const blocks = markdown.split(/\n\n+/);
    const htmlBlocks: string[] = [];

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      // 處理標題
      if (trimmed.startsWith("######")) {
        htmlBlocks.push(`<h6>${trimmed.slice(6).trim()}</h6>`);
      } else if (trimmed.startsWith("#####")) {
        htmlBlocks.push(`<h5>${trimmed.slice(5).trim()}</h5>`);
      } else if (trimmed.startsWith("####")) {
        htmlBlocks.push(`<h4>${trimmed.slice(4).trim()}</h4>`);
      } else if (trimmed.startsWith("###")) {
        htmlBlocks.push(`<h3>${trimmed.slice(3).trim()}</h3>`);
      } else if (trimmed.startsWith("##")) {
        htmlBlocks.push(`<h2>${trimmed.slice(2).trim()}</h2>`);
      } else if (trimmed.startsWith("#")) {
        htmlBlocks.push(`<h1>${trimmed.slice(1).trim()}</h1>`);
      }
      // 處理無序列表
      else if (/^[-*]\s/.test(trimmed)) {
        const items = trimmed.split(/\n/).map((line) => {
          const content = line.replace(/^[-*]\s+/, "");
          return `<li>${this.inlineMarkdown(content)}</li>`;
        });
        htmlBlocks.push(`<ul>${items.join("")}</ul>`);
      }
      // 處理有序列表
      else if (/^\d+\.\s/.test(trimmed)) {
        const items = trimmed.split(/\n/).map((line) => {
          const content = line.replace(/^\d+\.\s+/, "");
          return `<li>${this.inlineMarkdown(content)}</li>`;
        });
        htmlBlocks.push(`<ol>${items.join("")}</ol>`);
      }
      // 一般段落
      else {
        const lines = trimmed
          .split(/\n/)
          .map((line) => this.inlineMarkdown(line));
        htmlBlocks.push(`<p>${lines.join("<br>")}</p>`);
      }
    }

    return htmlBlocks.join("\n");
  }

  private inlineMarkdown(text: string): string {
    let result = text;
    // 粗體
    result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // 斜體
    result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
    // 連結
    result = result.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
    // 行內程式碼
    result = result.replace(/`(.+?)`/g, "<code>$1</code>");
    return result;
  }

  private calculateStatistics(
    markdown: string,
    sections: ContentAssemblerInput["sections"],
    qa: ContentAssemblerInput["qa"],
  ): ContentAssemblerOutput["statistics"] {
    const plainText = markdown
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/[#*`]/g, "")
      .trim();

    // 計算中文字符數
    const chineseChars = (plainText.match(/[\u4e00-\u9fa5]/g) || []).length;

    // 計算英文單詞數（排除中文後按空格分詞）
    const nonChineseText = plainText.replace(/[\u4e00-\u9fa5]/g, "");
    const englishWords = nonChineseText.trim()
      ? nonChineseText.trim().split(/\s+/).length
      : 0;

    // 如果中文字符多，使用中文字符數；否則使用英文單詞數
    const totalWords =
      chineseChars > englishWords
        ? chineseChars
        : Math.max(chineseChars + englishWords, 1);

    const paragraphs = markdown
      .split(/\n\n+/)
      .filter((p) => p.trim() && !p.startsWith("#"));
    const totalParagraphs = paragraphs.length;

    const totalSections = sections.length;
    const totalFAQs = qa.faqs.length;

    return {
      totalWords,
      totalParagraphs,
      totalSections,
      totalFAQs,
    };
  }
}
