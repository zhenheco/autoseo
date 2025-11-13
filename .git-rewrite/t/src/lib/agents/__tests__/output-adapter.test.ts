import { describe, it, expect } from 'vitest';
import { MultiAgentOutputAdapter } from '../output-adapter';

describe('MultiAgentOutputAdapter', () => {
  const adapter = new MultiAgentOutputAdapter();

  describe('adapt', () => {
    it('should convert ContentAssemblerOutput to WritingAgentOutput format', () => {
      const input = {
        assemblerOutput: {
          markdown: '# Test Article\n\nThis is a test article with some content.',
          html: '<h1>Test Article</h1><p>This is a test article with some content.</p>',
          statistics: {
            totalWords: 10,
            totalParagraphs: 1,
            totalSections: 1,
            totalFAQs: 0,
          },
          executionInfo: {
            executionTime: 1000,
          },
        },
        strategyOutput: {
          selectedTitle: 'Test Article',
          outline: {
            mainSections: [
              { title: 'Section 1', targetWordCount: 100 },
              { title: 'Section 2', targetWordCount: 100 },
            ],
          },
          keywords: ['test', 'article'],
          targetSections: [],
          competitorAnalysis: [],
          contentGaps: [],
        },
        focusKeyword: 'test',
      };

      const result = adapter.adapt(input);

      // Check structure
      expect(result).toHaveProperty('markdown');
      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('statistics');
      expect(result).toHaveProperty('readability');
      expect(result).toHaveProperty('keywordUsage');
      expect(result).toHaveProperty('internalLinks');

      // Check readability metrics
      expect(result.readability).toHaveProperty('fleschReadingEase');
      expect(result.readability).toHaveProperty('fleschKincaidGrade');
      expect(result.readability).toHaveProperty('gunningFog');
      expect(result.readability).toHaveProperty('averageSentenceLength');
      expect(result.readability).toHaveProperty('averageWordLength');

      // Check keyword usage
      expect(result.keywordUsage).toHaveProperty('keyword', 'test');
      expect(result.keywordUsage).toHaveProperty('count');
      expect(result.keywordUsage).toHaveProperty('density');
      expect(result.keywordUsage).toHaveProperty('positions');
      expect(result.keywordUsage).toHaveProperty('inTitle');
      expect(result.keywordUsage).toHaveProperty('inHeadings');
      expect(result.keywordUsage).toHaveProperty('inFirstParagraph');
      expect(result.keywordUsage).toHaveProperty('inLastParagraph');

      // Check types
      expect(typeof result.readability.fleschReadingEase).toBe('number');
      expect(typeof result.readability.fleschKincaidGrade).toBe('number');
      expect(typeof result.keywordUsage.density).toBe('number');
      expect(Array.isArray(result.internalLinks)).toBe(true);
    });

    it('should calculate keyword usage correctly', () => {
      const input = {
        assemblerOutput: {
          markdown: '# Test Keyword Article\n\nThis article contains the test keyword multiple times. The test keyword is important for testing.',
          html: '<h1>Test Keyword Article</h1><p>This article contains the test keyword multiple times. The test keyword is important for testing.</p>',
          statistics: {
            totalWords: 17,
            totalParagraphs: 1,
            totalSections: 1,
            totalFAQs: 0,
          },
          executionInfo: {
            executionTime: 1000,
          },
        },
        strategyOutput: {
          selectedTitle: 'Test Keyword Article',
          outline: { mainSections: [] },
          keywords: [],
          targetSections: [],
          competitorAnalysis: [],
          contentGaps: [],
        },
        focusKeyword: 'test',
      };

      const result = adapter.adapt(input);

      expect(result.keywordUsage.keyword).toBe('test');
      expect(result.keywordUsage.count).toBeGreaterThan(0);
      expect(result.keywordUsage.density).toBeGreaterThan(0);
      expect(result.keywordUsage.inTitle).toBe(true);
      expect(result.keywordUsage.inFirstParagraph).toBe(true);
    });

    it('should extract internal links from HTML', () => {
      const input = {
        assemblerOutput: {
          markdown: '# Article',
          html: '<h1>Article</h1><p>Check out <a href="/about" title="About Us">our about page</a> and <a href="https://external.com">external link</a>.</p>',
          statistics: {
            totalWords: 10,
            totalParagraphs: 1,
            totalSections: 1,
            totalFAQs: 0,
          },
          executionInfo: {
            executionTime: 1000,
          },
        },
        strategyOutput: {
          selectedTitle: 'Article',
          outline: { mainSections: [] },
          keywords: [],
          targetSections: [],
          competitorAnalysis: [],
          contentGaps: [],
        },
        focusKeyword: 'article',
      };

      const result = adapter.adapt(input);

      expect(result.internalLinks).toHaveLength(1);
      expect(result.internalLinks[0]).toHaveProperty('url', '/about');
      expect(result.internalLinks[0]).toHaveProperty('anchor', 'our about page');
      expect(result.internalLinks[0]).toHaveProperty('title', 'About Us');
      expect(result.internalLinks[0]).toHaveProperty('isInternal', true);
    });

    it('should handle empty content gracefully', () => {
      const input = {
        assemblerOutput: {
          markdown: '',
          html: '',
          statistics: {
            totalWords: 0,
            totalParagraphs: 0,
            totalSections: 0,
            totalFAQs: 0,
          },
          executionInfo: {
            executionTime: 0,
          },
        },
        strategyOutput: {
          selectedTitle: '',
          outline: { mainSections: [] },
          keywords: [],
          targetSections: [],
          competitorAnalysis: [],
          contentGaps: [],
        },
        focusKeyword: '',
      };

      const result = adapter.adapt(input);

      expect(result).toHaveProperty('markdown', '');
      expect(result).toHaveProperty('html', '');
      expect(result.keywordUsage.count).toBe(0);
      expect(result.keywordUsage.density).toBe(0);
      expect(result.internalLinks).toHaveLength(0);
    });
  });
});