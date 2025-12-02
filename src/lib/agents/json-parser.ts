export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  rawContent?: string;
}

export function safeJsonParse<T>(
  content: string,
  defaultValue?: T,
): ParseResult<T> {
  if (!content || typeof content !== "string") {
    return {
      success: false,
      error: "Empty or invalid content",
      rawContent: content,
      data: defaultValue,
    };
  }

  const cleanedContent = cleanJsonString(content);

  try {
    const data = JSON.parse(cleanedContent) as T;
    return { success: true, data };
  } catch {
    const extracted = extractJsonFromText(cleanedContent);
    if (extracted) {
      try {
        const data = JSON.parse(extracted) as T;
        return { success: true, data };
      } catch {
        // Continue to next fallback
      }
    }

    return {
      success: false,
      error: "Failed to parse JSON",
      rawContent: content,
      data: defaultValue,
    };
  }
}

function cleanJsonString(content: string): string {
  let cleaned = content.trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  cleaned = cleaned.trim();

  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, (char) => {
    if (char === "\n" || char === "\r" || char === "\t") {
      return char;
    }
    return "";
  });

  return cleaned;
}

function extractJsonFromText(text: string): string | null {
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }

  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  return null;
}

export function parseJsonResponse<T>(
  content: string,
  validator?: (data: unknown) => data is T,
): T | null {
  const result = safeJsonParse<T>(content);

  if (!result.success || !result.data) {
    return null;
  }

  if (validator && !validator(result.data)) {
    return null;
  }

  return result.data;
}

export function parseJsonWithFallback<T>(
  content: string,
  fallbackExtractor: (content: string) => T | null,
): T | null {
  const result = safeJsonParse<T>(content);

  if (result.success && result.data) {
    return result.data;
  }

  return fallbackExtractor(content);
}
