import type {
  LinkEnrichmentInput,
  LinkEnrichmentOutput,
  InternalLink,
  ExternalReference,
} from "@/types/agents";

export class LinkEnrichmentAgent {
  private maxInternalLinks: number;
  private maxExternalLinks: number;

  constructor(options?: {
    maxInternalLinks?: number;
    maxExternalLinks?: number;
  }) {
    this.maxInternalLinks = options?.maxInternalLinks || 5;
    this.maxExternalLinks = options?.maxExternalLinks || 3;
  }

  async execute(input: LinkEnrichmentInput): Promise<LinkEnrichmentOutput> {
    const startTime = Date.now();
    let html = input.html;
    const insertedLinks: LinkEnrichmentOutput["insertedLinks"] = [];

    console.log("[LinkEnrichmentAgent] Starting link enrichment", {
      internalLinksAvailable: input.internalLinks.length,
      externalReferencesAvailable: input.externalReferences.length,
      targetLanguage: input.targetLanguage,
    });

    const internalInserted = this.insertInternalLinks(
      html,
      input.internalLinks,
      insertedLinks,
    );
    html = internalInserted.html;

    const externalInserted = this.insertExternalLinks(
      html,
      input.externalReferences,
      insertedLinks,
    );
    html = externalInserted.html;

    const internalCount = insertedLinks.filter(
      (l) => l.type === "internal",
    ).length;
    const externalCount = insertedLinks.filter(
      (l) => l.type === "external",
    ).length;

    console.log("[LinkEnrichmentAgent] Link enrichment completed", {
      internalLinksInserted: internalCount,
      externalLinksInserted: externalCount,
      totalLinksInserted: insertedLinks.length,
      executionTime: Date.now() - startTime,
    });

    return {
      html,
      linkStats: {
        internalLinksInserted: internalCount,
        externalLinksInserted: externalCount,
        totalLinksInserted: insertedLinks.length,
      },
      insertedLinks,
      executionInfo: {
        executionTime: Date.now() - startTime,
      },
    };
  }

  private insertInternalLinks(
    html: string,
    internalLinks: InternalLink[],
    insertedLinks: LinkEnrichmentOutput["insertedLinks"],
  ): { html: string } {
    let modifiedHtml = html;
    let insertedCount = 0;

    for (const link of internalLinks) {
      if (insertedCount >= this.maxInternalLinks) break;

      const keywords = link.keywords || [link.title];
      for (const keyword of keywords) {
        if (insertedCount >= this.maxInternalLinks) break;
        if (!keyword || keyword.length < 2) continue;

        const result = this.insertLinkForKeyword(
          modifiedHtml,
          keyword,
          link.url,
          link.title,
          "internal",
        );

        if (result.inserted) {
          modifiedHtml = result.html;
          insertedCount++;
          insertedLinks.push({
            type: "internal",
            anchor: keyword,
            url: link.url,
            position: result.position,
          });
          console.log(
            `[LinkEnrichmentAgent] Inserted internal link: "${keyword}" -> ${link.url}`,
          );
          break;
        }
      }
    }

    return { html: modifiedHtml };
  }

  private insertExternalLinks(
    html: string,
    externalReferences: ExternalReference[],
    insertedLinks: LinkEnrichmentOutput["insertedLinks"],
  ): { html: string } {
    let modifiedHtml = html;
    let insertedCount = 0;

    for (const ref of externalReferences) {
      if (insertedCount >= this.maxExternalLinks) break;

      const keyword = ref.title || this.extractKeywordFromUrl(ref.url);
      if (!keyword || keyword.length < 2) continue;

      const result = this.insertLinkForKeyword(
        modifiedHtml,
        keyword,
        ref.url,
        ref.title,
        "external",
      );

      if (result.inserted) {
        modifiedHtml = result.html;
        insertedCount++;
        insertedLinks.push({
          type: "external",
          anchor: keyword,
          url: ref.url,
          position: result.position,
        });
        console.log(
          `[LinkEnrichmentAgent] Inserted external link: "${keyword}" -> ${ref.url}`,
        );
      }
    }

    return { html: modifiedHtml };
  }

  private insertLinkForKeyword(
    html: string,
    keyword: string,
    url: string,
    title: string,
    type: "internal" | "external",
  ): { html: string; inserted: boolean; position: string } {
    if (html.includes(`href="${url}"`)) {
      return { html, inserted: false, position: "" };
    }

    const escapedKeyword = this.escapeRegex(keyword);

    const pattern = new RegExp(
      `(?<!<a[^>]*>)(?<!\\p{L})${escapedKeyword}(?!\\p{L})(?![^<]*<\\/a>)`,
      "iu",
    );

    const match = pattern.exec(html);
    if (!match) {
      return { html, inserted: false, position: "" };
    }

    const matchIndex = match.index;
    const matchedText = match[0];

    const linkHtml =
      type === "external"
        ? `<a href="${url}" target="_blank" rel="noopener noreferrer" title="${this.escapeHtml(title)}">${matchedText}</a>`
        : `<a href="${url}" title="${this.escapeHtml(title)}">${matchedText}</a>`;

    const modifiedHtml =
      html.slice(0, matchIndex) +
      linkHtml +
      html.slice(matchIndex + matchedText.length);

    const position = this.getPositionContext(html, matchIndex);

    return { html: modifiedHtml, inserted: true, position };
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

  private extractKeywordFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/").filter((p) => p);
      if (pathParts.length > 0) {
        return pathParts[pathParts.length - 1]
          .replace(/-/g, " ")
          .replace(/_/g, " ")
          .replace(/\.[^.]+$/, "");
      }
      return urlObj.hostname;
    } catch {
      return "";
    }
  }

  private getPositionContext(html: string, index: number): string {
    const before = html.slice(Math.max(0, index - 100), index);
    const h2Match = before.match(/<h2[^>]*>([^<]*)<\/h2>/i);
    const h3Match = before.match(/<h3[^>]*>([^<]*)<\/h3>/i);

    if (h3Match) return `near H3: ${h3Match[1].slice(0, 30)}`;
    if (h2Match) return `near H2: ${h2Match[1].slice(0, 30)}`;
    return `position: ${index}`;
  }
}
