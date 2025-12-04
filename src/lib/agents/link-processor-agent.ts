import type { InternalLink, ExternalReference } from "@/types/agents";

export interface LinkProcessorConfig {
  maxInternalLinks: number;
  maxExternalLinks: number;
  maxLinksPerUrl: number;
  minDistanceBetweenLinks: number;
  minSemanticScore: number;
}

export interface LinkProcessorInput {
  html: string;
  internalLinks: InternalLink[];
  externalReferences: ExternalReference[];
  targetLanguage?: string;
}

export interface LinkInsertionStats {
  internalLinksInserted: number;
  externalLinksInserted: number;
  totalLinksInserted: number;
  semanticScoreAverage: number;
  rejectedLowScore: number;
}

export interface InsertedLink {
  type: "internal" | "external";
  anchor: string;
  url: string;
  position: string;
  section: string;
  semanticScore: number;
}

export interface LinkProcessorOutput {
  html: string;
  linkStats: LinkInsertionStats;
  insertedLinks: InsertedLink[];
  executionInfo: {
    executionTime: number;
  };
}

interface Section {
  id: string;
  heading: string;
  content: string;
  startIndex: number;
  endIndex: number;
  linksInserted: number;
}

export class LinkProcessorAgent {
  private config: LinkProcessorConfig;
  private urlUsageCount: Map<string, number> = new Map();
  private lastLinkPosition: number = 0;

  constructor(options?: Partial<LinkProcessorConfig>) {
    this.config = {
      maxInternalLinks: options?.maxInternalLinks ?? 5,
      maxExternalLinks: options?.maxExternalLinks ?? 3,
      maxLinksPerUrl: options?.maxLinksPerUrl ?? 2,
      minDistanceBetweenLinks: options?.minDistanceBetweenLinks ?? 500,
      minSemanticScore: options?.minSemanticScore ?? 0.4,
    };
  }

  async execute(input: LinkProcessorInput): Promise<LinkProcessorOutput> {
    const startTime = Date.now();
    this.urlUsageCount.clear();
    this.lastLinkPosition = 0;

    const insertedLinks: InsertedLink[] = [];
    let html = input.html;
    let rejectedLowScore = 0;
    let semanticScoreSum = 0;

    console.log("[LinkProcessorAgent] Starting unified link processing", {
      internalLinksAvailable: input.internalLinks.length,
      externalReferencesAvailable: input.externalReferences.length,
      targetLanguage: input.targetLanguage,
      config: this.config,
    });

    const sections = this.extractSections(html);
    console.log(`[LinkProcessorAgent] Extracted ${sections.length} sections`);

    let internalInserted = 0;
    for (const link of input.internalLinks) {
      if (internalInserted >= this.config.maxInternalLinks) break;

      const urlCount = this.urlUsageCount.get(link.url) ?? 0;
      if (urlCount >= this.config.maxLinksPerUrl) continue;

      const keywords = link.keywords || [link.title];
      for (const keyword of keywords) {
        if (internalInserted >= this.config.maxInternalLinks) break;
        if (!keyword || keyword.length < 2) continue;

        const bestMatch = await this.findBestMatch(
          html,
          sections,
          keyword,
          link,
          "internal",
        );

        if (bestMatch) {
          if (bestMatch.semanticScore < this.config.minSemanticScore) {
            rejectedLowScore++;
            console.log(
              `[LinkProcessorAgent] Rejected low-score internal link: "${keyword}" (score: ${bestMatch.semanticScore.toFixed(2)})`,
            );
            continue;
          }

          const result = this.insertLink(
            html,
            bestMatch.matchIndex,
            bestMatch.matchText,
            link.url,
            link.title,
            "internal",
          );

          if (result.inserted) {
            html = result.html;
            internalInserted++;
            semanticScoreSum += bestMatch.semanticScore;
            this.urlUsageCount.set(link.url, urlCount + 1);
            this.lastLinkPosition = bestMatch.matchIndex;

            const section = this.findSectionAtPosition(
              sections,
              bestMatch.matchIndex,
            );
            if (section) section.linksInserted++;

            insertedLinks.push({
              type: "internal",
              anchor: bestMatch.matchText,
              url: link.url,
              position: result.position,
              section: section?.heading ?? "unknown",
              semanticScore: bestMatch.semanticScore,
            });

            console.log(
              `[LinkProcessorAgent] Inserted internal link: "${keyword}" -> ${link.url} (score: ${bestMatch.semanticScore.toFixed(2)})`,
            );
            break;
          }
        }
      }
    }

    let externalInserted = 0;
    for (const ref of input.externalReferences) {
      if (externalInserted >= this.config.maxExternalLinks) break;

      const urlCount = this.urlUsageCount.get(ref.url) ?? 0;
      if (urlCount >= this.config.maxLinksPerUrl) continue;

      const keywords = this.extractKeywordsFromReference(ref);
      for (const keyword of keywords) {
        if (externalInserted >= this.config.maxExternalLinks) break;
        if (!keyword || keyword.length < 2) continue;

        const bestMatch = await this.findBestMatch(
          html,
          sections,
          keyword,
          { url: ref.url, title: ref.title, keywords: [keyword] },
          "external",
        );

        if (bestMatch) {
          if (bestMatch.semanticScore < this.config.minSemanticScore) {
            rejectedLowScore++;
            console.log(
              `[LinkProcessorAgent] Rejected low-score external link: "${keyword}" (score: ${bestMatch.semanticScore.toFixed(2)})`,
            );
            continue;
          }

          const result = this.insertLink(
            html,
            bestMatch.matchIndex,
            bestMatch.matchText,
            ref.url,
            ref.title,
            "external",
          );

          if (result.inserted) {
            html = result.html;
            externalInserted++;
            semanticScoreSum += bestMatch.semanticScore;
            this.urlUsageCount.set(ref.url, urlCount + 1);
            this.lastLinkPosition = bestMatch.matchIndex;

            const section = this.findSectionAtPosition(
              sections,
              bestMatch.matchIndex,
            );
            if (section) section.linksInserted++;

            insertedLinks.push({
              type: "external",
              anchor: bestMatch.matchText,
              url: ref.url,
              position: result.position,
              section: section?.heading ?? "unknown",
              semanticScore: bestMatch.semanticScore,
            });

            console.log(
              `[LinkProcessorAgent] Inserted external link: "${keyword}" -> ${ref.url} (score: ${bestMatch.semanticScore.toFixed(2)})`,
            );
            break;
          }
        }
      }
    }

    const totalInserted = insertedLinks.length;
    const avgScore = totalInserted > 0 ? semanticScoreSum / totalInserted : 0;

    console.log("[LinkProcessorAgent] Link processing completed", {
      internalLinksInserted: internalInserted,
      externalLinksInserted: externalInserted,
      totalLinksInserted: totalInserted,
      semanticScoreAverage: avgScore.toFixed(2),
      rejectedLowScore,
      executionTime: Date.now() - startTime,
    });

    return {
      html,
      linkStats: {
        internalLinksInserted: internalInserted,
        externalLinksInserted: externalInserted,
        totalLinksInserted: totalInserted,
        semanticScoreAverage: avgScore,
        rejectedLowScore,
      },
      insertedLinks,
      executionInfo: {
        executionTime: Date.now() - startTime,
      },
    };
  }

  private extractSections(html: string): Section[] {
    const sections: Section[] = [];
    const h2Regex = /<h2[^>]*>(.*?)<\/h2>/gi;
    let match;
    let lastEnd = 0;

    const matches: { heading: string; index: number }[] = [];
    while ((match = h2Regex.exec(html)) !== null) {
      matches.push({
        heading: this.stripHtmlTags(match[1]),
        index: match.index,
      });
    }

    for (let i = 0; i < matches.length; i++) {
      const startIndex = matches[i].index;
      const endIndex =
        i < matches.length - 1 ? matches[i + 1].index : html.length;

      sections.push({
        id: `section-${i}`,
        heading: matches[i].heading,
        content: html.slice(startIndex, endIndex),
        startIndex,
        endIndex,
        linksInserted: 0,
      });

      lastEnd = endIndex;
    }

    if (matches.length === 0) {
      sections.push({
        id: "section-0",
        heading: "main",
        content: html,
        startIndex: 0,
        endIndex: html.length,
        linksInserted: 0,
      });
    }

    return sections;
  }

  private async findBestMatch(
    html: string,
    sections: Section[],
    keyword: string,
    link: { url: string; title: string; keywords?: string[] },
    type: "internal" | "external",
  ): Promise<{
    matchIndex: number;
    matchText: string;
    semanticScore: number;
  } | null> {
    const escapedKeyword = this.escapeRegex(keyword);
    const pattern = new RegExp(
      `(?<!<a[^>]*>)(?<!\\p{L})${escapedKeyword}(?!\\p{L})(?![^<]*<\\/a>)`,
      "giu",
    );

    const candidates: {
      index: number;
      text: string;
      section: Section;
      score: number;
    }[] = [];
    let match;

    while ((match = pattern.exec(html)) !== null) {
      const matchIndex = match.index;

      if (this.isInsideLink(html, matchIndex)) continue;

      const distance = Math.abs(matchIndex - this.lastLinkPosition);
      if (
        this.lastLinkPosition > 0 &&
        distance < this.config.minDistanceBetweenLinks
      ) {
        continue;
      }

      const section = this.findSectionAtPosition(sections, matchIndex);
      if (section && section.linksInserted >= 2) {
        continue;
      }

      const semanticScore = await this.calculateSemanticScore(
        section?.content ??
          html.slice(Math.max(0, matchIndex - 200), matchIndex + 200),
        link.title,
        link.keywords ?? [keyword],
      );

      candidates.push({
        index: matchIndex,
        text: match[0],
        section: section ?? sections[0],
        score: semanticScore,
      });
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.score - a.score);

    const best = candidates[0];
    return {
      matchIndex: best.index,
      matchText: best.text,
      semanticScore: best.score,
    };
  }

  private async calculateSemanticScore(
    sectionContent: string,
    linkTitle: string,
    keywords: string[],
  ): Promise<number> {
    const sectionLower = sectionContent.toLowerCase();
    const titleLower = linkTitle.toLowerCase();

    let score = 0;
    let matchCount = 0;

    const titleWords = titleLower.split(/\s+/).filter((w) => w.length > 2);
    for (const word of titleWords) {
      if (sectionLower.includes(word)) {
        matchCount++;
      }
    }

    if (titleWords.length > 0) {
      score += (matchCount / titleWords.length) * 0.5;
    }

    for (const keyword of keywords) {
      if (sectionLower.includes(keyword.toLowerCase())) {
        score += 0.2;
      }
    }

    const hasThematicOverlap = this.checkThematicOverlap(
      sectionContent,
      linkTitle,
    );
    if (hasThematicOverlap) {
      score += 0.3;
    }

    return Math.min(score, 1.0);
  }

  private checkThematicOverlap(content: string, title: string): boolean {
    const contentWords = new Set(
      content
        .toLowerCase()
        .split(/[\s,，、。]+/)
        .filter((w) => w.length > 2),
    );
    const titleWords = title
      .toLowerCase()
      .split(/[\s,，、。]+/)
      .filter((w) => w.length > 2);

    let overlap = 0;
    for (const word of titleWords) {
      if (contentWords.has(word)) {
        overlap++;
      }
    }

    return titleWords.length > 0 && overlap / titleWords.length >= 0.3;
  }

  private insertLink(
    html: string,
    matchIndex: number,
    matchText: string,
    url: string,
    title: string,
    type: "internal" | "external",
  ): { html: string; inserted: boolean; position: string } {
    if (html.includes(`href="${url}"`)) {
      return { html, inserted: false, position: "" };
    }

    const linkHtml =
      type === "external"
        ? `<a href="${url}" target="_blank" rel="noopener noreferrer" title="${this.escapeHtml(title)}">${matchText}</a>`
        : `<a href="${url}" rel="internal" title="${this.escapeHtml(title)}">${matchText}</a>`;

    const modifiedHtml =
      html.slice(0, matchIndex) +
      linkHtml +
      html.slice(matchIndex + matchText.length);

    const position = this.getPositionContext(html, matchIndex);

    return { html: modifiedHtml, inserted: true, position };
  }

  private findSectionAtPosition(
    sections: Section[],
    position: number,
  ): Section | undefined {
    return sections.find(
      (s) => position >= s.startIndex && position < s.endIndex,
    );
  }

  private isInsideLink(html: string, position: number): boolean {
    const beforeText = html.slice(Math.max(0, position - 100), position);
    const openTags = (beforeText.match(/<a\s/gi) || []).length;
    const closeTags = (beforeText.match(/<\/a>/gi) || []).length;
    return openTags > closeTags;
  }

  private extractKeywordsFromReference(ref: ExternalReference): string[] {
    const keywords: string[] = [];
    const stopWords = new Set([
      "的",
      "是",
      "在",
      "和",
      "了",
      "與",
      "或",
      "及",
      "等",
      "這",
      "那",
      "關於",
      "參考",
      "來源",
      "the",
      "a",
      "an",
      "and",
      "or",
      "is",
      "are",
      "for",
      "to",
      "in",
      "on",
      "at",
      "by",
      "with",
    ]);

    // 技術性詞彙黑名單
    const technicalTerms = new Set([
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "https",
      "http",
      "www",
      "html",
      "php",
      "asp",
      "jsp",
      "index",
      "page",
      "post",
      "article",
      "blog",
      "news",
      "id",
      "ref",
      "src",
      "img",
      "css",
      "js",
    ]);

    // 關鍵字驗證函式
    const isValidKeyword = (w: string): boolean => {
      const lower = w.toLowerCase();
      return (
        w.length >= 3 &&
        w.length <= 30 &&
        !stopWords.has(lower) &&
        !technicalTerms.has(lower) &&
        !/^\d+$/.test(w) // 不是純數字
      );
    };

    if (ref.title) {
      // 只有當標題看起來有效時才加入
      if (ref.title.length >= 4 && isValidKeyword(ref.title)) {
        keywords.push(ref.title);
      }
      const titleWords = ref.title
        .split(/[\s,，、。：:]+/)
        .filter((w) => isValidKeyword(w));
      keywords.push(...titleWords.slice(0, 5));
    }

    if (ref.description && ref.description.length > 20) {
      // 中文短語提取（優先使用 description）
      const chinesePhrasesMatch = ref.description.match(
        /[\u4e00-\u9fa5]{3,10}/g,
      );
      if (chinesePhrasesMatch) {
        const validPhrases = chinesePhrasesMatch.filter(
          (p) => !stopWords.has(p) && p.length >= 3,
        );
        keywords.push(...validPhrases.slice(0, 5));
      }

      const descWords = ref.description
        .split(/[\s,，、。：:；;！!？?]+/)
        .filter((w) => isValidKeyword(w));
      keywords.push(...descWords.slice(0, 5));
    }

    if (ref.domain) {
      const domainParts = ref.domain
        .replace(/^www\./, "")
        .split(".")
        .filter(
          (p) => p.length >= 3 && !["com", "tw", "org", "net"].includes(p),
        );
      keywords.push(...domainParts.slice(0, 2));
    }

    return [...new Set(keywords)].slice(0, 12);
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private stripHtmlTags(str: string): string {
    return str.replace(/<[^>]*>/g, "").trim();
  }

  private getPositionContext(html: string, index: number): string {
    const before = html.slice(Math.max(0, index - 200), index);
    const h2Match = before.match(/<h2[^>]*>([^<]*)<\/h2>/gi);
    const h3Match = before.match(/<h3[^>]*>([^<]*)<\/h3>/gi);

    if (h3Match && h3Match.length > 0) {
      const last = h3Match[h3Match.length - 1];
      const text = this.stripHtmlTags(last);
      return `near H3: ${text.slice(0, 30)}`;
    }
    if (h2Match && h2Match.length > 0) {
      const last = h2Match[h2Match.length - 1];
      const text = this.stripHtmlTags(last);
      return `near H2: ${text.slice(0, 30)}`;
    }
    return `position: ${index}`;
  }
}
