import { BaseAgent } from './base-agent';
import type { MetaInput, MetaOutput } from '@/types/agents';

export class MetaAgent extends BaseAgent<MetaInput, MetaOutput> {
  get agentName(): string {
    return 'MetaAgent';
  }

  protected async process(input: MetaInput): Promise<MetaOutput> {
    const metaData = await this.generateMetaData(input);

    return {
      ...metaData,
      executionInfo: this.getExecutionInfo(input.model),
    };
  }

  private async generateMetaData(
    input: MetaInput
  ): Promise<Omit<MetaOutput, 'executionInfo'>> {
    const prompt = `你是一位 SEO 專家，請為以下文章生成完整的 meta 資料。

# 文章標題選項
${input.titleOptions.map((t, i) => `${i + 1}. ${t}`).join('\n')}

# 主要關鍵字
${input.keyword}

# 文章摘要
${input.content.markdown.substring(0, 500)}...

# 文章統計
- 字數: ${input.content.statistics.wordCount}
- 段落數: ${input.content.statistics.paragraphCount}
- 閱讀時間: ${input.content.statistics.readingTime} 分鐘

請生成以下 meta 資料（以 JSON 格式回答）:

{
  "title": "SEO 標題（50-60 字元，包含關鍵字）",
  "description": "meta 描述（150-160 字元，吸引人且包含關鍵字）",
  "slug": "url-friendly-slug（使用連字符，包含關鍵字）",
  "openGraph": {
    "title": "Open Graph 標題（可與 SEO 標題相同或略有不同）",
    "description": "Open Graph 描述（簡短吸引人）",
    "type": "article"
  },
  "twitterCard": {
    "card": "summary_large_image",
    "title": "Twitter 卡片標題",
    "description": "Twitter 卡片描述"
  },
  "focusKeyphrase": "主要關鍵字短語"
}

要求:
1. 標題必須在 50-60 字元之間
2. 描述必須在 150-160 字元之間
3. 標題和描述都要自然地包含主要關鍵字
4. slug 應該簡短、清晰、SEO 友好
5. 所有文字都要吸引人且具有說服力`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      format: 'json',
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
      console.error('[MetaAgent] JSON parse error:', error);
      console.error('[MetaAgent] Response content:', response.content);
      console.error('[MetaAgent] Using fallback meta data based on input');

      metaData = this.getFallbackMetaData(input);
    }

    return {
      title: metaData.title || input.titleOptions[0] || input.keyword,
      description: metaData.description || `關於${input.keyword}的完整指南`,
      slug: this.sanitizeSlug(metaData.slug || input.keyword),
      seo: {
        title: metaData.title || input.titleOptions[0] || input.keyword,
        description: metaData.description || `關於${input.keyword}的完整指南`,
        keywords: metaData.keywords || [input.keyword],
      },
      openGraph: {
        title: metaData.openGraph?.title || metaData.title || input.titleOptions[0] || input.keyword,
        description: metaData.openGraph?.description || metaData.description || `關於${input.keyword}的完整指南`,
        type: 'article',
      },
      twitterCard: {
        card: 'summary_large_image',
        title: metaData.twitterCard?.title || metaData.title || input.titleOptions[0] || input.keyword,
        description: metaData.twitterCard?.description || metaData.description || `關於${input.keyword}的完整指南`,
      },
      focusKeyphrase: metaData.focusKeyphrase || input.keyword,
    };
  }

  private getFallbackMetaData(input: MetaInput) {
    const title = input.titleOptions[0] || input.keyword;
    const description = `關於${input.keyword}的詳細介紹與完整指南。${input.content.markdown.substring(0, 100).replace(/[#*\[\]]/g, '')}...`;
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
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
