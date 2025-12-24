/**
 * 健康檢查協調器
 * 負責協調各個服務，執行完整的健康檢查流程
 */

import { PageSpeedService } from "./page-speed-service";
import { MetaAnalysisService } from "./meta-analysis-service";
import { BasicSeoService } from "./basic-seo-service";
import { RecommendationService } from "./recommendation-service";
import type {
  DeviceType,
  CoreWebVitals,
  LighthouseScores,
  MetaAnalysis,
  AiRecommendation,
} from "@/types/health-check";

export interface HealthCheckOrchestratorResult {
  url: string;
  deviceType: DeviceType;
  coreWebVitals: CoreWebVitals;
  lighthouseScores: LighthouseScores;
  metaAnalysis: MetaAnalysis;
  robotsTxtExists: boolean;
  sitemapExists: boolean;
  sitemapUrl: string | null;
  aiRecommendations: AiRecommendation[];
  executionTime: number;
}

export interface HealthCheckOrchestratorOptions {
  url: string;
  deviceType?: DeviceType;
  includeAiRecommendations?: boolean;
}

export class HealthCheckOrchestrator {
  private pageSpeedService: PageSpeedService;
  private metaAnalysisService: MetaAnalysisService;
  private basicSeoService: BasicSeoService;
  private recommendationService: RecommendationService;

  constructor() {
    this.pageSpeedService = new PageSpeedService();
    this.metaAnalysisService = new MetaAnalysisService();
    this.basicSeoService = new BasicSeoService();
    this.recommendationService = new RecommendationService();
  }

  /**
   * 執行完整的健康檢查
   */
  async execute(
    options: HealthCheckOrchestratorOptions,
  ): Promise<HealthCheckOrchestratorResult> {
    const {
      url,
      deviceType = "mobile",
      includeAiRecommendations = true,
    } = options;
    const startTime = Date.now();

    console.log(`[HealthCheckOrchestrator] Starting health check for ${url}`);

    // 並行執行所有檢查（除了 AI 建議）
    const [pageSpeedResult, metaAnalysis, basicSeoResult] = await Promise.all([
      this.pageSpeedService.analyze(url, deviceType).catch((error) => {
        console.error("[HealthCheckOrchestrator] PageSpeed error:", error);
        return {
          coreWebVitals: {
            lcp_ms: null,
            inp_ms: null,
            cls: null,
            fcp_ms: null,
            ttfb_ms: null,
          },
          lighthouseScores: {
            performance_score: null,
            accessibility_score: null,
            seo_score: null,
            best_practices_score: null,
          },
        };
      }),
      this.metaAnalysisService.analyze(url).catch((error) => {
        console.error("[HealthCheckOrchestrator] Meta analysis error:", error);
        return {} as MetaAnalysis;
      }),
      this.basicSeoService.analyze(url).catch((error) => {
        console.error("[HealthCheckOrchestrator] Basic SEO error:", error);
        return {
          robotsTxtExists: false,
          sitemapExists: false,
          sitemapUrl: null,
        };
      }),
    ]);

    // 如果需要，生成 AI 建議
    let aiRecommendations: AiRecommendation[] = [];
    if (includeAiRecommendations) {
      try {
        aiRecommendations =
          await this.recommendationService.generateRecommendations({
            url,
            coreWebVitals: pageSpeedResult.coreWebVitals,
            lighthouseScores: pageSpeedResult.lighthouseScores,
            metaAnalysis,
            robotsTxtExists: basicSeoResult.robotsTxtExists,
            sitemapExists: basicSeoResult.sitemapExists,
          });
      } catch (error) {
        console.error("[HealthCheckOrchestrator] Recommendation error:", error);
        aiRecommendations = [];
      }
    }

    const executionTime = Date.now() - startTime;

    console.log(
      `[HealthCheckOrchestrator] Health check completed in ${executionTime}ms`,
    );

    return {
      url,
      deviceType,
      coreWebVitals: pageSpeedResult.coreWebVitals,
      lighthouseScores: pageSpeedResult.lighthouseScores,
      metaAnalysis,
      robotsTxtExists: basicSeoResult.robotsTxtExists,
      sitemapExists: basicSeoResult.sitemapExists,
      sitemapUrl: basicSeoResult.sitemapUrl,
      aiRecommendations,
      executionTime,
    };
  }
}
