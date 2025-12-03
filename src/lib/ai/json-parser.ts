import { z } from "zod";

export interface ParseOptions {
  allowPartial?: boolean;
  extractFirst?: boolean;
  strict?: boolean;
}

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  rawExtracted?: string;
}

export interface FallbackRootCause {
  originalResponsePreview: string;
  modelId: string;
  failedStrategies: string[];
  timestamp: string;
}

export class AIResponseParser {
  private static readonly JSON_PATTERNS = [
    /```json\s*([\s\S]*?)\s*```/i,
    /```\s*([\s\S]*?)\s*```/,
    /\{[\s\S]*\}/,
    /\[[\s\S]*\]/,
  ];

  private static lastFallbackCause: FallbackRootCause | null = null;

  static getLastFallbackCause(): FallbackRootCause | null {
    return this.lastFallbackCause;
  }

  static clearFallbackCause(): void {
    this.lastFallbackCause = null;
  }

  static extractBalancedJSON(content: string): string | null {
    if (!content || typeof content !== "string") {
      return null;
    }

    const jsonStart = content.search(/[{[]/);
    if (jsonStart === -1) {
      return null;
    }

    const startChar = content[jsonStart];
    const endChar = startChar === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = jsonStart; i < content.length; i++) {
      const char = content[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === "\\") {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === startChar || char === (startChar === "{" ? "{" : "[")) {
        if (char === "{" || char === "[") depth++;
      }
      if (char === endChar || char === (endChar === "}" ? "}" : "]")) {
        if (char === "}" || char === "]") depth--;
      }

      if (depth === 0 && (char === "}" || char === "]")) {
        const extracted = content.substring(jsonStart, i + 1);
        try {
          JSON.parse(extracted);
          return extracted;
        } catch {
          continue;
        }
      }
    }

    return null;
  }

  static cleanContent(content: string): string {
    const balanced = this.extractBalancedJSON(content);
    if (balanced) {
      return balanced;
    }

    let cleaned = content.trim();
    cleaned = cleaned
      .replace(/^[\s\S]*?(?=\{|\[)/, "")
      .replace(/(?:\}|\])[\s\S]*$/, (match) => {
        const firstBracket = match[0];
        return firstBracket;
      });

    return cleaned.trim();
  }

  static extractJSON(content: string): string | null {
    if (!content || typeof content !== "string") {
      return null;
    }

    const balanced = this.extractBalancedJSON(content);
    if (balanced) {
      return balanced;
    }

    for (const pattern of this.JSON_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        const extracted = match[1] || match[0];
        const cleaned = extracted
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();

        if (this.isValidJSONStructure(cleaned)) {
          return cleaned;
        }
      }
    }

    const cleaned = this.cleanContent(content);
    if (this.isValidJSONStructure(cleaned)) {
      return cleaned;
    }

    return null;
  }

  private static isValidJSONStructure(str: string): boolean {
    const trimmed = str.trim();
    return (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    );
  }

  static parse<T>(
    content: string,
    schema: z.ZodSchema<T>,
    options: ParseOptions = {},
  ): ParseResult<T> {
    const {
      allowPartial = false,
      extractFirst = true,
      strict = true,
    } = options;

    if (!content) {
      return {
        success: false,
        error: "Empty content provided",
      };
    }

    let jsonStr: string | null = null;

    if (extractFirst) {
      jsonStr = this.extractJSON(content);
    }

    if (!jsonStr) {
      jsonStr = content.trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);

      if (strict) {
        const result = schema.safeParse(parsed);
        if (result.success) {
          return {
            success: true,
            data: result.data,
            rawExtracted: jsonStr,
          };
        } else {
          return {
            success: false,
            error: `Schema validation failed: ${result.error.message}`,
            rawExtracted: jsonStr,
          };
        }
      } else {
        try {
          const data = schema.parse(parsed);
          return {
            success: true,
            data,
            rawExtracted: jsonStr,
          };
        } catch (zodError) {
          if (allowPartial) {
            return {
              success: true,
              data: parsed as T,
              rawExtracted: jsonStr,
            };
          }
          return {
            success: false,
            error:
              zodError instanceof Error
                ? zodError.message
                : "Schema validation failed",
            rawExtracted: jsonStr,
          };
        }
      }
    } catch (parseError) {
      const repaired = this.attemptRepair(jsonStr);
      if (repaired) {
        try {
          const parsed = JSON.parse(repaired);
          const result = schema.safeParse(parsed);
          if (result.success) {
            return {
              success: true,
              data: result.data,
              rawExtracted: repaired,
            };
          }
        } catch {
          // Fall through to error
        }
      }

      return {
        success: false,
        error:
          parseError instanceof Error
            ? `JSON parse failed: ${parseError.message}`
            : "JSON parse failed",
        rawExtracted: jsonStr,
      };
    }
  }

  private static attemptRepair(json: string): string | null {
    let repaired = json;

    repaired = repaired.replace(/,\s*([}\]])/g, "$1");

    repaired = repaired.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');

    repaired = repaired.replace(/:\s*'([^']*)'/g, ': "$1"');

    const openBraces = (repaired.match(/{/g) || []).length;
    const closeBraces = (repaired.match(/}/g) || []).length;
    if (openBraces > closeBraces) {
      repaired += "}".repeat(openBraces - closeBraces);
    }

    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/]/g) || []).length;
    if (openBrackets > closeBrackets) {
      repaired += "]".repeat(openBrackets - closeBrackets);
    }

    try {
      JSON.parse(repaired);
      return repaired;
    } catch {
      return null;
    }
  }

  static validate<T>(data: unknown, schema: z.ZodSchema<T>): T {
    return schema.parse(data);
  }

  static safeValidate<T>(
    data: unknown,
    schema: z.ZodSchema<T>,
  ): { success: true; data: T } | { success: false; error: z.ZodError } {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
  }

  static extractMultipleJSON(content: string): string[] {
    const results: string[] = [];
    const pattern =
      /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\]/g;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      try {
        JSON.parse(match[0]);
        results.push(match[0]);
      } catch {
        // Skip invalid JSON
      }
    }

    return results;
  }

  static parseWithFallback<T>(
    content: string,
    schema: z.ZodSchema<T>,
    fallback: T,
    modelId?: string,
  ): T {
    const result = this.parse(content, schema);
    if (result.success && result.data !== undefined) {
      this.lastFallbackCause = null;
      return result.data;
    }

    const failedStrategies: string[] = [];
    if (!this.extractBalancedJSON(content)) {
      failedStrategies.push("balanced-extraction");
    }
    if (!this.extractJSON(content)) {
      failedStrategies.push("pattern-extraction");
    }
    if (result.error?.includes("Schema validation")) {
      failedStrategies.push("schema-validation");
    }
    if (result.error?.includes("JSON parse")) {
      failedStrategies.push("json-parse");
    }

    this.lastFallbackCause = {
      originalResponsePreview: content.substring(0, 200),
      modelId: modelId || "unknown",
      failedStrategies,
      timestamp: new Date().toISOString(),
    };

    console.warn(
      `[AIResponseParser] Fallback triggered for model ${modelId || "unknown"}:`,
      {
        preview: content.substring(0, 100),
        failedStrategies,
        error: result.error,
      },
    );

    return fallback;
  }

  static buildStrictJsonPromptSuffix(): string {
    return "\n\n⚠️ 只輸出 JSON，第一個字符必須是 { 或 [，禁止任何解釋、邊界標記（```json、---）或額外文字。";
  }

  static shouldRetryParsing(result: ParseResult<unknown>): {
    shouldRetry: boolean;
    reason: string;
    suggestedAction: "add_strict_suffix" | "simplify_schema" | "none";
  } {
    if (result.success) {
      return { shouldRetry: false, reason: "success", suggestedAction: "none" };
    }

    const error = result.error || "";

    if (error.includes("JSON parse failed")) {
      return {
        shouldRetry: true,
        reason: "json_syntax_error",
        suggestedAction: "add_strict_suffix",
      };
    }

    if (error.includes("Schema validation failed")) {
      return {
        shouldRetry: true,
        reason: "schema_mismatch",
        suggestedAction: "simplify_schema",
      };
    }

    if (error.includes("Empty content")) {
      return {
        shouldRetry: false,
        reason: "empty_response",
        suggestedAction: "none",
      };
    }

    return {
      shouldRetry: true,
      reason: "unknown_error",
      suggestedAction: "add_strict_suffix",
    };
  }

  static async parseWithRetry<T>(
    attemptFn: (useStrictPrompt: boolean) => Promise<string>,
    schema: z.ZodSchema<T>,
    fallback: T,
    options: {
      maxRetries?: number;
      modelId?: string;
      onRetry?: (attempt: number, reason: string) => void;
    } = {},
  ): Promise<{ data: T; usedFallback: boolean; attempts: number }> {
    const { maxRetries = 2, modelId, onRetry } = options;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const useStrictPrompt = attempt > 0;
      const content = await attemptFn(useStrictPrompt);

      const result = this.parse(content, schema);

      if (result.success && result.data !== undefined) {
        return {
          data: result.data,
          usedFallback: false,
          attempts: attempt + 1,
        };
      }

      const retryInfo = this.shouldRetryParsing(result);

      if (!retryInfo.shouldRetry || attempt === maxRetries) {
        console.warn(
          `[AIResponseParser] Final fallback after ${attempt + 1} attempts`,
          {
            modelId,
            reason: retryInfo.reason,
            error: result.error,
          },
        );
        return { data: fallback, usedFallback: true, attempts: attempt + 1 };
      }

      if (onRetry) {
        onRetry(attempt + 1, retryInfo.reason);
      }

      console.log(
        `[AIResponseParser] Retry ${attempt + 1}/${maxRetries} for ${modelId || "unknown"}`,
        { reason: retryInfo.reason, action: retryInfo.suggestedAction },
      );
    }

    return { data: fallback, usedFallback: true, attempts: maxRetries + 1 };
  }
}

export const ResearchOutputSchema = z.object({
  title: z.string(),
  region: z.string().optional(),
  searchIntent: z.enum([
    "informational",
    "commercial",
    "transactional",
    "navigational",
  ]),
  intentConfidence: z.number(),
  topRankingFeatures: z.object({
    contentLength: z.object({
      min: z.number(),
      max: z.number(),
      avg: z.number(),
    }),
    titlePatterns: z.array(z.string()),
    structurePatterns: z.array(z.string()),
    commonTopics: z.array(z.string()),
    commonFormats: z.array(z.string()),
  }),
  contentGaps: z.array(z.string()),
  competitorAnalysis: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      position: z.number(),
      domain: z.string(),
      estimatedWordCount: z.number(),
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
      uniqueAngles: z.array(z.string()),
    }),
  ),
  recommendedStrategy: z.string(),
  relatedKeywords: z.array(z.string()),
});

export const StrategyOutputSchema = z.object({
  titleOptions: z.array(z.string()),
  selectedTitle: z.string(),
  outline: z.object({
    introduction: z.object({
      hook: z.string(),
      context: z.string(),
      thesis: z.string(),
      wordCount: z.number(),
    }),
    mainSections: z.array(
      z.object({
        heading: z.string(),
        subheadings: z.array(z.string()),
        keyPoints: z.array(z.string()),
        targetWordCount: z.number(),
        keywords: z.array(z.string()),
      }),
    ),
    conclusion: z.object({
      summary: z.string(),
      callToAction: z.string(),
      wordCount: z.number(),
    }),
    faq: z.array(
      z.object({
        question: z.string(),
        answerOutline: z.string(),
      }),
    ),
  }),
  targetWordCount: z.number(),
  sectionWordDistribution: z.object({
    introduction: z.number(),
    mainSections: z.number(),
    conclusion: z.number(),
    faq: z.number(),
  }),
  keywordDensityTarget: z.number(),
  keywords: z.array(z.string()),
  relatedKeywords: z.array(z.string()),
  lsiKeywords: z.array(z.string()),
});

export const MetaOutputSchema = z.object({
  title: z.string(),
  description: z.string(),
  slug: z.string(),
  seo: z.object({
    title: z.string(),
    description: z.string(),
    keywords: z.array(z.string()).optional(),
  }),
  openGraph: z.object({
    title: z.string(),
    description: z.string(),
    type: z.literal("article"),
    image: z.string().optional(),
  }),
  twitterCard: z.object({
    card: z.literal("summary_large_image"),
    title: z.string(),
    description: z.string(),
    image: z.string().optional(),
  }),
  focusKeyphrase: z.string(),
});
