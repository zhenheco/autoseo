import { BaseAgent } from "./base-agent";
import type { MetaInput, MetaOutput } from "@/types/agents";
import { LOCALE_FULL_NAMES } from "@/lib/i18n/locales";

export class MetaAgent extends BaseAgent<MetaInput, MetaOutput> {
  get agentName(): string {
    return "MetaAgent";
  }

  protected async process(input: MetaInput): Promise<MetaOutput> {
    const metaData = await this.generateMetaData(input);

    return {
      ...metaData,
      executionInfo: this.getExecutionInfo(input.model),
    };
  }

  private async generateMetaData(
    input: MetaInput,
  ): Promise<Omit<MetaOutput, "executionInfo">> {
    const targetLang = input.targetLanguage || "zh-TW";
    const languageName =
      LOCALE_FULL_NAMES[targetLang] || "Traditional Chinese (繁體中文)";

    const prompt = `You are an SEO expert. Generate complete meta data for the following article.

**Target Language: ${languageName}** (ALL meta content MUST be written in this language)

# Article Title Options
${input.titleOptions.map((t, i) => `${i + 1}. ${t}`).join("\n")}

# Primary Keyword
${input.keyword}

# Article Summary
${input.content.markdown.substring(0, 500)}...

# Article Statistics
- Word count: ${input.content.statistics.wordCount}
- Paragraph count: ${input.content.statistics.paragraphCount}
- Reading time: ${input.content.statistics.readingTime} minutes

Generate the following meta data (respond in JSON format):

{
  "title": "SEO title (50-60 characters, including keyword, in ${languageName})",
  "description": "Meta description (150-160 characters, engaging and including keyword, in ${languageName})",
  "slug": "url-friendly-slug (use hyphens, include keyword, in English/romanized)",
  "openGraph": {
    "title": "Open Graph title (can be same as or slightly different from SEO title, in ${languageName})",
    "description": "Open Graph description (short and engaging, in ${languageName})",
    "type": "article"
  },
  "twitterCard": {
    "card": "summary_large_image",
    "title": "Twitter card title (in ${languageName})",
    "description": "Twitter card description (in ${languageName})"
  },
  "focusKeyphrase": "Primary keyphrase (in ${languageName})"
}

Requirements:
1. Title must be 50-60 characters
2. Description must be 150-160 characters
3. Title and description must naturally include the primary keyword
4. Slug should be short, clear, and SEO-friendly (always in English/romanized)
5. All text should be engaging and persuasive
6. **Ensure complete JSON output, do not omit or truncate any part**
7. **CRITICAL: All content except slug MUST be in ${languageName}**`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      format: "json",
    });

    let metaData;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        metaData = JSON.parse(jsonMatch[0]);
      } else {
        metaData = JSON.parse(response.content);
      }
    } catch (error) {
      console.error("[MetaAgent] JSON parse error:", error);
      console.error("[MetaAgent] Response content:", response.content);
      console.error("[MetaAgent] Using fallback meta data based on input");

      metaData = this.getFallbackMetaData(input);
    }

    const fallbackDesc = `${input.keyword}`;

    return {
      title: metaData.title || input.titleOptions[0] || input.keyword,
      description: metaData.description || fallbackDesc,
      slug: this.sanitizeSlug(metaData.slug || input.keyword),
      seo: {
        title: metaData.title || input.titleOptions[0] || input.keyword,
        description: metaData.description || fallbackDesc,
        keywords: metaData.keywords || [input.keyword],
      },
      openGraph: {
        title:
          metaData.openGraph?.title ||
          metaData.title ||
          input.titleOptions[0] ||
          input.keyword,
        description:
          metaData.openGraph?.description ||
          metaData.description ||
          fallbackDesc,
        type: "article",
      },
      twitterCard: {
        card: "summary_large_image",
        title:
          metaData.twitterCard?.title ||
          metaData.title ||
          input.titleOptions[0] ||
          input.keyword,
        description:
          metaData.twitterCard?.description ||
          metaData.description ||
          fallbackDesc,
      },
      focusKeyphrase: metaData.focusKeyphrase || input.keyword,
    };
  }

  private getFallbackMetaData(input: MetaInput) {
    const title = input.titleOptions[0] || input.keyword;
    // Use article content excerpt as description (language-neutral approach)
    const contentExcerpt = input.content.markdown
      .substring(0, 150)
      .replace(/[#*\[\]]/g, "")
      .trim();
    const description = contentExcerpt || input.keyword;
    const slug = this.sanitizeSlug(input.keyword);

    return {
      title,
      description: description.substring(0, 160),
      slug,
      keywords: [input.keyword],
      openGraph: {
        title,
        description: description.substring(0, 160),
      },
      twitterCard: {
        title,
        description: description.substring(0, 160),
      },
      focusKeyphrase: input.keyword,
    };
  }

  private sanitizeSlug(slug: string): string {
    return slug
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}
