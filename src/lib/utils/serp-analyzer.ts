export interface SerpResult {
  url: string;
  title: string;
  position: number;
  domain?: string;
}

export type CompetitionLevel = "極高" | "高" | "中" | "低";

export interface ContentGap {
  type: string;
  count: number;
  percentage: number;
}

export interface SerpAnalysis {
  competitionLevel: CompetitionLevel;
  authorityCount: number;
  contentGaps: ContentGap[];
  missingTypes: string[];
  relatedQueries: string[];
}

const AUTHORITY_DOMAINS = [
  "wikipedia.org",
  "facebook.com",
  "youtube.com",
  "shopee.tw",
  "momo.com",
  "pchome.com.tw",
  "amazon.com",
  "gov.tw",
  "edu.tw",
  "instagram.com",
  "twitter.com",
  "linkedin.com",
  "medium.com",
  "github.com",
  "apple.com",
  "google.com",
  "microsoft.com",
];

const CONTENT_TYPE_PATTERNS: Record<string, RegExp[]> = {
  tutorial: [
    /教學/i,
    /如何/i,
    /怎麼/i,
    /步驟/i,
    /guide/i,
    /how to/i,
    /tutorial/i,
  ],
  review: [/評測/i, /評價/i, /心得/i, /review/i, /開箱/i, /體驗/i],
  comparison: [/比較/i, /vs/i, /對比/i, /差異/i, /compare/i, /versus/i],
  news: [/最新/i, /趨勢/i, /2024/i, /2025/i, /news/i, /update/i],
  product: [/推薦/i, /排名/i, /top/i, /best/i, /精選/i, /必買/i],
};

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function isAuthorityDomain(domain: string): boolean {
  return AUTHORITY_DOMAINS.some(
    (auth) => domain.includes(auth) || auth.includes(domain),
  );
}

function detectContentType(title: string): string[] {
  const types: string[] = [];

  for (const [type, patterns] of Object.entries(CONTENT_TYPE_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(title))) {
      types.push(type);
    }
  }

  return types.length > 0 ? types : ["general"];
}

export function calculateCompetitionLevel(
  serpResults: SerpResult[],
): CompetitionLevel {
  const top10 = serpResults.slice(0, 10);
  let authorityCount = 0;

  for (const result of top10) {
    const domain = result.domain || extractDomain(result.url);
    if (isAuthorityDomain(domain)) {
      authorityCount++;
    }
  }

  if (authorityCount >= 7) return "極高";
  if (authorityCount >= 5) return "高";
  if (authorityCount >= 3) return "中";
  return "低";
}

export function countAuthorityDomains(serpResults: SerpResult[]): number {
  const top10 = serpResults.slice(0, 10);
  let count = 0;

  for (const result of top10) {
    const domain = result.domain || extractDomain(result.url);
    if (isAuthorityDomain(domain)) {
      count++;
    }
  }

  return count;
}

export function identifyContentGaps(titles: string[]): ContentGap[] {
  const typeCounts: Record<string, number> = {
    tutorial: 0,
    review: 0,
    comparison: 0,
    news: 0,
    product: 0,
    general: 0,
  };

  for (const title of titles) {
    const types = detectContentType(title);
    for (const type of types) {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
  }

  const total = titles.length || 1;
  const gaps: ContentGap[] = Object.entries(typeCounts).map(
    ([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / total) * 100),
    }),
  );

  return gaps.sort((a, b) => a.count - b.count);
}

export function getMissingContentTypes(titles: string[]): string[] {
  const gaps = identifyContentGaps(titles);
  return gaps.filter((gap) => gap.count === 0).map((gap) => gap.type);
}

export function extractRelatedQueries(serpData: {
  relatedSearches?: string[];
  peopleAlsoAsk?: string[];
}): string[] {
  const queries: string[] = [];

  if (serpData.relatedSearches) {
    queries.push(...serpData.relatedSearches);
  }

  if (serpData.peopleAlsoAsk) {
    queries.push(...serpData.peopleAlsoAsk);
  }

  return [...new Set(queries)];
}

export function analyzeSerpResults(
  serpResults: SerpResult[],
  serpData?: { relatedSearches?: string[]; peopleAlsoAsk?: string[] },
): SerpAnalysis {
  const titles = serpResults.map((r) => r.title);
  const contentGaps = identifyContentGaps(titles);

  return {
    competitionLevel: calculateCompetitionLevel(serpResults),
    authorityCount: countAuthorityDomains(serpResults),
    contentGaps,
    missingTypes: getMissingContentTypes(titles),
    relatedQueries: serpData ? extractRelatedQueries(serpData) : [],
  };
}
