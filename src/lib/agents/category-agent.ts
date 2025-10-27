/**
 * CategoryAgent - 自動分析文章內容並推薦分類和標籤
 * 使用免費模型來降低成本
 */

import { z } from 'zod';
import { callOpenRouter } from '../openrouter';

// 分類和標籤輸出 Schema
const CategoryOutputSchema = z.object({
  categories: z.array(z.object({
    name: z.string().describe('分類名稱'),
    slug: z.string().describe('分類 URL slug'),
    confidence: z.number().min(0).max(1).describe('推薦信心度 0-1'),
    reason: z.string().describe('推薦理由')
  })).describe('推薦的分類（最多3個）'),

  tags: z.array(z.object({
    name: z.string().describe('標籤名稱'),
    slug: z.string().describe('標籤 URL slug'),
    relevance: z.number().min(0).max(1).describe('相關性分數 0-1')
  })).describe('推薦的標籤（5-10個）'),

  primaryCategory: z.string().describe('主要分類名稱'),
  focusKeywords: z.array(z.string()).describe('文章焦點關鍵字')
});

export type CategoryOutput = z.infer<typeof CategoryOutputSchema>;

export interface CategoryInput {
  title: string;
  content: string;
  keywords: string[];
  outline?: any;
  existingCategories?: Array<{ name: string; slug: string; count?: number }>;
  existingTags?: Array<{ name: string; slug: string; count?: number }>;
  language?: string;
}

export class CategoryAgent {
  private model: string;

  constructor(model?: string) {
    // 使用免費模型以降低成本
    this.model = model || 'google/gemini-2.0-flash-exp:free';
  }

  async generateCategories(input: CategoryInput): Promise<CategoryOutput> {
    console.log('[CategoryAgent] 開始分析文章分類和標籤...');

    try {
      const systemPrompt = this.buildSystemPrompt(input);
      const userPrompt = this.buildUserPrompt(input);

      const response = await callOpenRouter({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2000,
        response_format: {
          type: 'json_object'
        }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from model');
      }

      const parsed = JSON.parse(content);
      const validated = CategoryOutputSchema.parse(parsed);

      console.log('[CategoryAgent] 成功生成分類和標籤');
      console.log(`  - 主要分類: ${validated.primaryCategory}`);
      console.log(`  - 分類數量: ${validated.categories.length}`);
      console.log(`  - 標籤數量: ${validated.tags.length}`);

      return validated;

    } catch (error) {
      console.error('[CategoryAgent] 錯誤:', error);
      // 返回預設值
      return this.getDefaultOutput(input);
    }
  }

  private buildSystemPrompt(input: CategoryInput): string {
    const lang = input.language === 'zh-TW' ? '繁體中文' : 'English';

    return `你是一個專業的內容分類專家。請根據文章內容推薦最適合的分類和標籤。

要求：
1. 分析文章主題、內容深度和目標受眾
2. 推薦 1-3 個最相關的分類（按信心度排序）
3. 推薦 5-10 個相關標籤（按相關性排序）
4. 分類應該較廣泛，標籤應該較具體
5. 優先使用現有的分類和標籤（如果提供）
6. 使用 ${lang} 命名
7. slug 使用小寫英文和連字符（如: digital-marketing）

輸出 JSON 格式，包含 categories、tags、primaryCategory 和 focusKeywords。`;
  }

  private buildUserPrompt(input: CategoryInput): string {
    let prompt = `請為以下文章推薦分類和標籤：

標題：${input.title}

關鍵字：${input.keywords.join(', ')}

內容摘要：
${input.content.substring(0, 2000)}...`;

    // 添加現有分類和標籤資訊
    if (input.existingCategories && input.existingCategories.length > 0) {
      prompt += `\n\n現有分類（優先考慮使用）：\n`;
      input.existingCategories.forEach(cat => {
        prompt += `- ${cat.name} (${cat.slug})${cat.count ? ` [已有 ${cat.count} 篇文章]` : ''}\n`;
      });
    }

    if (input.existingTags && input.existingTags.length > 0) {
      prompt += `\n現有標籤（可參考）：\n`;
      const topTags = input.existingTags.slice(0, 20);
      topTags.forEach(tag => {
        prompt += `- ${tag.name} (${tag.slug})${tag.count ? ` [使用 ${tag.count} 次]` : ''}\n`;
      });
    }

    prompt += `\n請分析並推薦最適合的分類和標籤。`;

    return prompt;
  }

  private getDefaultOutput(input: CategoryInput): CategoryOutput {
    // 基於關鍵字生成預設分類和標籤
    const primaryKeyword = input.keywords[0] || 'general';

    return {
      categories: [
        {
          name: this.titleCase(primaryKeyword),
          slug: this.slugify(primaryKeyword),
          confidence: 0.5,
          reason: '基於主要關鍵字'
        }
      ],
      tags: input.keywords.slice(0, 5).map((kw, index) => ({
        name: kw,
        slug: this.slugify(kw),
        relevance: 1 - (index * 0.1)
      })),
      primaryCategory: this.titleCase(primaryKeyword),
      focusKeywords: input.keywords.slice(0, 3)
    };
  }

  private titleCase(str: string): string {
    return str.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private slugify(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * 根據文章內容和現有分類智能匹配最佳分類
   */
  async matchExistingCategories(
    content: string,
    existingCategories: Array<{ id: string; name: string; description?: string }>
  ): Promise<string[]> {
    if (existingCategories.length === 0) {
      return [];
    }

    const prompt = `從以下分類中選擇最適合這篇文章的1-2個分類：

文章內容摘要：
${content.substring(0, 1000)}

可選分類：
${existingCategories.map(cat => `- ${cat.name}${cat.description ? `: ${cat.description}` : ''}`).join('\n')}

只返回選中的分類ID，用逗號分隔。`;

    try {
      const response = await callOpenRouter({
        model: this.model,
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 100
      });

      const result = response.choices[0]?.message?.content || '';
      const categoryNames = result.split(',').map((s: string) => s.trim()).filter(Boolean);

      // 匹配ID
      return existingCategories
        .filter(cat => categoryNames.some((name: string) =>
          cat.name.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(cat.name.toLowerCase())
        ))
        .map(cat => cat.id)
        .slice(0, 2);

    } catch (error) {
      console.error('[CategoryAgent] 匹配分類錯誤:', error);
      return [];
    }
  }
}

export default CategoryAgent;