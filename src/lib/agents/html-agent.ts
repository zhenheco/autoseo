import { BaseAgent } from "./base-agent";
import type { HTMLInput, HTMLOutput } from "@/types/agents";

export class HTMLAgent extends BaseAgent<HTMLInput, HTMLOutput> {
  get agentName(): string {
    return "HTMLAgent";
  }

  protected async process(input: HTMLInput): Promise<HTMLOutput> {
    let fullHtml = input.html;
    if (!fullHtml.includes("<html>") && !fullHtml.includes("<!DOCTYPE")) {
      fullHtml = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
${fullHtml}
</body>
</html>`;
    }

    try {
      fullHtml = await this.insertInternalLinks(fullHtml, input.internalLinks);
    } catch (error) {
      console.warn(
        "[HTMLAgent] ⚠️ Failed to insert internal links, continuing...",
        error,
      );
    }

    try {
      fullHtml = await this.insertExternalReferences(
        fullHtml,
        input.externalReferences,
      );
    } catch (error) {
      console.warn(
        "[HTMLAgent] ⚠️ Failed to insert external references, continuing...",
        error,
      );
    }

    try {
      fullHtml = await this.insertFAQSchema(fullHtml);
    } catch (error) {
      console.warn(
        "[HTMLAgent] ⚠️ Failed to insert FAQ schema, continuing...",
        error,
      );
    }

    try {
      fullHtml = await this.optimizeForWordPress(fullHtml);
    } catch (error) {
      console.warn(
        "[HTMLAgent] ⚠️ Failed to optimize for WordPress, continuing...",
        error,
      );
    }

    try {
      fullHtml = await this.addStyledBoxes(fullHtml);
    } catch (error) {
      console.warn(
        "[HTMLAgent] ⚠️ Failed to add styled boxes, continuing...",
        error,
      );
    }

    const linkCount = await this.countLinks(fullHtml);

    let finalHtml = fullHtml;
    try {
      const { parseHTML } = await import("linkedom");
      const { document } = parseHTML(fullHtml);

      try {
        const bodyElement = document.body;
        if (bodyElement && bodyElement.innerHTML) {
          finalHtml = bodyElement.innerHTML;
        } else {
          console.warn(
            "[HTMLAgent] ⚠️ No body element or innerHTML, using full HTML",
          );
        }
      } catch (bodyError) {
        console.warn(
          "[HTMLAgent] ⚠️ Cannot access document.body (documentElement may be null), using full HTML",
        );
      }
    } catch (error) {
      console.warn("[HTMLAgent] ⚠️ parseHTML failed, using full HTML", error);
    }

    return {
      html: finalHtml,
      linkCount,
      executionInfo: this.getExecutionInfo("html-processor"),
    };
  }

  private async insertInternalLinks(
    html: string,
    internalLinks: HTMLInput["internalLinks"],
  ): Promise<string> {
    if (!internalLinks || internalLinks.length === 0) {
      return html;
    }

    const { parseHTML } = await import("linkedom");
    const { document } = parseHTML(html);
    const body = document.body;

    const walker = document.createTreeWalker(
      body,
      1, // NodeFilter.SHOW_TEXT
      {
        acceptNode: (node: Node) => {
          const element = node as unknown as HTMLElement;
          const parent = element.parentElement;
          if (!parent) return 2; // NodeFilter.FILTER_REJECT

          if (
            ["A", "SCRIPT", "STYLE", "CODE", "PRE"].includes(parent.tagName)
          ) {
            return 2; // NodeFilter.FILTER_REJECT
          }

          return 1; // NodeFilter.FILTER_ACCEPT
        },
      },
    );

    const textNodes: Node[] = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      textNodes.push(currentNode);
      currentNode = walker.nextNode();
    }

    const linkedKeywords = new Set<string>();

    for (const link of internalLinks) {
      if (linkedKeywords.size >= internalLinks.length) break;
      if (!link.keywords) continue;

      for (const keyword of link.keywords) {
        if (linkedKeywords.has(keyword)) continue;

        const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, "i");

        for (const textNode of textNodes) {
          const element = textNode as unknown as HTMLElement;
          const text = element.textContent || "";
          const match = text.match(regex);

          if (match) {
            const matchText = match[0];
            const beforeText = text.substring(0, match.index);
            const afterText = text.substring(
              (match.index || 0) + matchText.length,
            );

            const element2 = textNode as unknown as HTMLElement;
            const parent = element2.parentElement;
            if (!parent) continue;

            const anchor = document.createElement("a");
            anchor.href = link.url;
            anchor.textContent = matchText;
            anchor.setAttribute("rel", "internal");

            const beforeNode = document.createTextNode(beforeText);
            const afterNode = document.createTextNode(afterText);

            parent.replaceChild(afterNode, textNode);
            parent.insertBefore(anchor, afterNode);
            parent.insertBefore(beforeNode, anchor);

            linkedKeywords.add(keyword);
            break;
          }
        }

        if (linkedKeywords.has(keyword)) break;
      }
    }

    return body.innerHTML;
  }

  private async insertExternalReferences(
    html: string,
    externalRefs: HTMLInput["externalReferences"],
  ): Promise<string> {
    if (!externalRefs || externalRefs.length === 0) {
      return html;
    }

    const { parseHTML } = await import("linkedom");
    const { document } = parseHTML(html);
    const body = document.body;

    for (const ref of externalRefs) {
      const sections = ref.relevantSection
        ? this.findSections(body, ref.relevantSection)
        : [body];

      if (sections.length === 0) continue;

      const section = sections[0];

      const keywords = this.extractKeywordsFromDescription(ref.description);

      const walker = document.createTreeWalker(
        section,
        1, // NodeFilter.SHOW_TEXT
        {
          acceptNode: (node: Node) => {
            const element = node as unknown as HTMLElement;
            const parent = element.parentElement;
            if (!parent) return 2; // NodeFilter.FILTER_REJECT

            if (
              ["A", "SCRIPT", "STYLE", "CODE", "PRE"].includes(parent.tagName)
            ) {
              return 2; // NodeFilter.FILTER_REJECT
            }

            return 1; // NodeFilter.FILTER_ACCEPT
          },
        },
      );

      const textNodes: Node[] = [];
      let currentNode = walker.nextNode();
      while (currentNode) {
        textNodes.push(currentNode);
        currentNode = walker.nextNode();
      }

      let linked = false;
      for (const keyword of keywords) {
        if (linked) break;

        const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, "i");

        for (const textNode of textNodes) {
          const element = textNode as unknown as HTMLElement;
          const text = element.textContent || "";
          const match = text.match(regex);

          if (match) {
            const matchText = match[0];
            const beforeText = text.substring(0, match.index);
            const afterText = text.substring(
              (match.index || 0) + matchText.length,
            );

            const element2 = textNode as unknown as HTMLElement;
            const parent = element2.parentElement;
            if (!parent) continue;

            const anchor = document.createElement("a");
            anchor.href = ref.url;
            anchor.textContent = matchText;
            anchor.setAttribute("target", "_blank");
            anchor.setAttribute("rel", "noopener noreferrer external");

            const beforeNode = document.createTextNode(beforeText);
            const afterNode = document.createTextNode(afterText);

            parent.replaceChild(afterNode, textNode);
            parent.insertBefore(anchor, afterNode);
            parent.insertBefore(beforeNode, anchor);

            linked = true;
            break;
          }
        }
      }
    }

    return body.innerHTML;
  }

  private async optimizeForWordPress(html: string): Promise<string> {
    const { parseHTML } = await import("linkedom");
    const { document } = parseHTML(html);
    const body = document.body;

    const images = body.querySelectorAll("img");
    images.forEach((img) => {
      if (!img.getAttribute("loading")) {
        img.setAttribute("loading", "lazy");
      }

      if (!img.classList.contains("wp-image")) {
        img.classList.add("wp-image");
      }

      if (!img.style.maxWidth) {
        img.style.maxWidth = "100%";
        img.style.height = "auto";
      }
    });

    const headings = body.querySelectorAll("h1, h2, h3, h4, h5, h6");
    headings.forEach((heading) => {
      if (!heading.id) {
        const text = heading.textContent || "";
        const id = this.slugify(text);
        heading.id = id;
      }
    });

    const tables = body.querySelectorAll("table");
    tables.forEach((table) => {
      if (!table.classList.contains("wp-table")) {
        table.classList.add("wp-table");
      }

      const wrapper = document.createElement("div");
      wrapper.classList.add("table-responsive");
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });

    return body.innerHTML;
  }

  private async addStyledBoxes(html: string): Promise<string> {
    const { parseHTML } = await import("linkedom");
    const { document } = parseHTML(html);
    const body = document.body;

    if (!body) {
      console.warn("[HTMLAgent] ⚠️ No body element found for styled boxes");
      return html;
    }

    const boxStyle =
      "background-color: #FFF8E7; border-radius: 8px; padding: 20px 24px; margin: 24px 0; border-left: 4px solid #E6B800;";

    this.wrapFAQSection(body, document, boxStyle);
    this.wrapIntroductionSummary(body, document, boxStyle);

    console.log("[HTMLAgent] ✅ Styled boxes added");

    return body.innerHTML;
  }

  private wrapFAQSection(
    body: Element,
    document: Document,
    boxStyle: string,
  ): void {
    const faqPatterns = [
      "常見問題",
      "faq",
      "q&a",
      "問與答",
      "frequently asked questions",
    ];

    const faqHeadings = Array.from(body.querySelectorAll("h2, h3")).filter(
      (h) => {
        const text = (h.textContent || "").toLowerCase();
        return faqPatterns.some((pattern) => text.includes(pattern));
      },
    );

    for (const faqHeading of faqHeadings) {
      if (faqHeading.parentElement?.classList.contains("styled-faq-box")) {
        continue;
      }

      const elementsToWrap: Element[] = [faqHeading];
      let sibling = faqHeading.nextElementSibling;

      while (sibling && !["H1", "H2"].includes(sibling.tagName)) {
        elementsToWrap.push(sibling);
        sibling = sibling.nextElementSibling;
      }

      const wrapper = document.createElement("div");
      wrapper.setAttribute("style", boxStyle);
      wrapper.setAttribute("class", "styled-faq-box");

      faqHeading.parentNode?.insertBefore(wrapper, faqHeading);
      elementsToWrap.forEach((el) => wrapper.appendChild(el));

      console.log("[HTMLAgent] ✅ FAQ section wrapped with styled box");
    }
  }

  private wrapIntroductionSummary(
    body: Element,
    document: Document,
    boxStyle: string,
  ): void {
    const h1 = body.querySelector("h1");
    if (!h1) return;

    let firstParagraph = h1.nextElementSibling;

    while (
      firstParagraph &&
      (firstParagraph.tagName === "FIGURE" ||
        firstParagraph.querySelector?.("img"))
    ) {
      firstParagraph = firstParagraph.nextElementSibling;
    }

    if (
      firstParagraph &&
      firstParagraph.tagName === "P" &&
      !firstParagraph.parentElement?.classList.contains("styled-summary-box")
    ) {
      const wrapper = document.createElement("div");
      wrapper.setAttribute("style", boxStyle);
      wrapper.setAttribute("class", "styled-summary-box");

      firstParagraph.parentNode?.insertBefore(wrapper, firstParagraph);
      wrapper.appendChild(firstParagraph);

      console.log(
        "[HTMLAgent] ✅ Introduction summary wrapped with styled box",
      );
    }
  }

  private findSections(
    element: Element | DocumentFragment,
    sectionName: string,
  ): Element[] {
    const results: Element[] = [];
    const headings = (element as Element).querySelectorAll(
      "h1, h2, h3, h4, h5, h6",
    );

    headings.forEach((heading) => {
      const text = heading.textContent || "";
      if (text.toLowerCase().includes(sectionName.toLowerCase())) {
        const section = heading.nextElementSibling;
        if (section) {
          results.push(section);
        }
      }
    });

    return results;
  }

  private extractKeywordsFromDescription(description: string): string[] {
    // 支援中文分詞：按空格、逗號、句號等分割
    const words = description.split(/[\s,，、。]+/);

    const keywords = words.filter((word) => {
      // 保留中文字符
      const cleaned = word.replace(/[^\w\s\u4e00-\u9fa5]/g, "");
      // 放寬條件：最少 2 字元（允許短詞組和中文詞語）
      return cleaned.length >= 2 && cleaned.length <= 30;
    });

    // 增加到最多 10 個關鍵字
    return keywords.slice(0, 10);
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private async insertFAQSchema(html: string): Promise<string> {
    const { parseHTML } = await import("linkedom");
    const { document } = parseHTML(html);
    const body = document.body;

    if (!body) {
      console.warn("[HTMLAgent] ⚠️ No body element found in HTML");
      return html;
    }

    const faqPatterns = [
      "常見問題",
      "faq",
      "q&a",
      "q & a",
      "qa",
      "問與答",
      "問答",
      "frequently asked questions",
    ];

    const faqHeadings = Array.from(body.querySelectorAll("h2, h3")).filter(
      (h) => {
        const text = (h.textContent || "").toLowerCase();
        return faqPatterns.some((pattern) => text.includes(pattern));
      },
    );

    if (faqHeadings.length === 0) {
      return html;
    }

    const faqSection = faqHeadings[0];
    const faqItems: Array<{ question: string; answer: string }> = [];

    let currentElement = faqSection.nextElementSibling;
    while (currentElement && !["H1", "H2"].includes(currentElement.tagName)) {
      if (currentElement.tagName === "H3" || currentElement.tagName === "H4") {
        const questionText = (currentElement.textContent || "")
          .replace(/^Q:\s*/i, "")
          .trim();
        let answerText = "";

        let nextEl = currentElement.nextElementSibling;
        while (nextEl && !["H1", "H2", "H3", "H4"].includes(nextEl.tagName)) {
          const text = (nextEl.textContent || "").replace(/^A:\s*/i, "").trim();
          if (text) {
            answerText += text + " ";
          }
          nextEl = nextEl.nextElementSibling;
        }

        if (questionText && answerText.trim()) {
          faqItems.push({
            question: questionText,
            answer: answerText.trim(),
          });
        }
      }
      currentElement = currentElement.nextElementSibling;
    }

    if (faqItems.length === 0) {
      return html;
    }

    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    };

    const scriptTag = document.createElement("script");
    scriptTag.setAttribute("type", "application/ld+json");
    scriptTag.textContent = JSON.stringify(schema, null, 2);

    body.appendChild(scriptTag);

    console.log("[HTMLAgent] ✅ FAQ Schema inserted", {
      faqCount: faqItems.length,
    });

    return body.innerHTML;
  }

  private async countLinks(
    html: string,
  ): Promise<{ internal: number; external: number }> {
    try {
      let fullHtml = html;
      if (!fullHtml.includes("<html>") && !fullHtml.includes("<!DOCTYPE")) {
        fullHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body>
${fullHtml}
</body>
</html>`;
      }

      const { parseHTML } = await import("linkedom");
      const { document } = parseHTML(fullHtml);
      const body = document.body;

      if (!body) {
        console.warn(
          "[HTMLAgent] No body element in countLinks, returning zero counts",
        );
        return { internal: 0, external: 0 };
      }

      const allLinks = body.querySelectorAll("a");
      let internal = 0;
      let external = 0;

      allLinks.forEach((link) => {
        const rel = link.getAttribute("rel") || "";
        if (rel.includes("internal")) {
          internal++;
        } else if (rel.includes("external")) {
          external++;
        }
      });

      return { internal, external };
    } catch (error) {
      console.warn("[HTMLAgent] Error counting links:", error);
      return { internal: 0, external: 0 };
    }
  }
}
