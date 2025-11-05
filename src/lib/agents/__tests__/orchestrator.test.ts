import { ParallelOrchestrator } from '../orchestrator';
import type { ArticleGenerationInput } from '@/types/agents';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: {
                  id: 'test',
                  website_id: 'test-website',
                  tone_of_voice: 'professional',
                  target_audience: 'developers',
                  keywords: ['test'],
                  serp_analysis_enabled: true,
                  competitor_count: 5,
                  content_length_min: 1500,
                  content_length_max: 3000,
                  keyword_density_min: 1.0,
                  keyword_density_max: 2.5,
                  quality_threshold: 75,
                  auto_publish: false,
                  research_enabled: true,
                  research_model: 'gpt-4',
                  research_temperature: 0.7,
                  research_max_tokens: 2000,
                  strategy_enabled: true,
                  strategy_model: 'gpt-4',
                  strategy_temperature: 0.7,
                  strategy_max_tokens: 2000,
                  writing_enabled: true,
                  writing_model: 'gpt-4',
                  writing_temperature: 0.7,
                  writing_max_tokens: 4000,
                  image_enabled: true,
                  image_model: 'dall-e-3',
                  image_quality: 'standard',
                  image_size: '1024x1024',
                  image_count: 2,
                  meta_enabled: true,
                  meta_model: 'gpt-3.5-turbo',
                  meta_temperature: 0.3,
                  meta_max_tokens: 500,
                  quality_enabled: true,
                },
                error: null,
              })
            ),
            limit: jest.fn(() =>
              Promise.resolve({
                data: [],
                error: null,
              })
            ),
            order: jest.fn(function () {
              return this;
            }),
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    })
  ),
}));

jest.mock('../research-agent');
jest.mock('../strategy-agent');
jest.mock('../writing-agent');
jest.mock('../image-agent');
jest.mock('../quality-agent');
jest.mock('../meta-agent');

describe('ParallelOrchestrator', () => {
  const input: ArticleGenerationInput = {
    articleJobId: 'test-job',
    companyId: 'test-company',
    websiteId: 'test-website',
    title: 'test keyword',
    region: 'Taiwan',
  };

  it('應該定義 execute 方法', () => {
    const orchestrator = new ParallelOrchestrator();
    expect(orchestrator.execute).toBeDefined();
    expect(typeof orchestrator.execute).toBe('function');
  });

  it('應該接受正確的輸入參數', () => {
    const orchestrator = new ParallelOrchestrator();
    expect(() => {
      orchestrator.execute(input);
    }).not.toThrow();
  });
});
