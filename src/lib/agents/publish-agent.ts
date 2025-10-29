import { BaseAgent } from './base-agent';
import { WordPressClient } from '../wordpress/client';
import type { WordPressPost } from '../wordpress/client';

export interface PublishInput {
  title: string;
  content: string;
  excerpt?: string;
  slug?: string;
  featuredImageUrl?: string;
  categories?: string[];
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  wordpressConfig: {
    url: string;
    username?: string;
    applicationPassword?: string;
    jwtToken?: string;
  };
  publishStatus?: 'publish' | 'draft';
}

export interface PublishOutput {
  success: boolean;
  postId?: number;
  postUrl?: string;
  status?: string;
  featuredMediaId?: number;
  categoryIds?: number[];
  tagIds?: number[];
  error?: string;
  executionInfo: {
    agentName: string;
    model?: string;
    executionTime: number;
    tokenUsage: {
      input: number;
      output: number;
    };
  };
}

export class PublishAgent extends BaseAgent<PublishInput, PublishOutput> {
  get agentName(): string {
    return 'PublishAgent';
  }

  protected async process(input: PublishInput): Promise<PublishOutput> {
    console.log('[PublishAgent] 開始發布文章到 WordPress');

    try {
      const client = new WordPressClient({
        url: input.wordpressConfig.url,
        username: input.wordpressConfig.username,
        applicationPassword: input.wordpressConfig.applicationPassword,
        jwtToken: input.wordpressConfig.jwtToken,
      });

      console.log('[PublishAgent] WordPress 客戶端已初始化');
      console.log(`[PublishAgent] 目標網站: ${input.wordpressConfig.url}`);

      const result = await client.publishArticle(
        {
          title: input.title,
          content: input.content,
          excerpt: input.excerpt,
          slug: input.slug,
          featuredImageUrl: input.featuredImageUrl,
          categories: input.categories || [],
          tags: input.tags || [],
          seoTitle: input.seoTitle,
          seoDescription: input.seoDescription,
          focusKeyword: input.focusKeyword,
        },
        input.publishStatus || 'draft'
      );

      console.log('[PublishAgent] 文章發布成功！');
      console.log(`[PublishAgent] 文章 ID: ${result.post.id}`);
      console.log(`[PublishAgent] 文章連結: ${result.post.link}`);

      return {
        success: true,
        postId: result.post.id,
        postUrl: result.post.link,
        status: result.post.status,
        featuredMediaId: result.featuredMediaId,
        categoryIds: result.categoryIds,
        tagIds: result.tagIds,
        executionInfo: this.getExecutionInfo('wordpress-publisher'),
      };

    } catch (error) {
      console.error('[PublishAgent] 發布失敗:', error);

      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      return {
        success: false,
        error: errorMessage,
        executionInfo: this.getExecutionInfo('wordpress-publisher'),
      };
    }
  }
}
