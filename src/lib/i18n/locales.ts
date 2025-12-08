/**
 * 統一的語系常數定義
 * UI 語系和文章生成語系都從這裡引用
 */

// UI 介面支援的語系（7 種）
export const UI_LOCALES = [
  { code: "zh-TW", name: "繁體中文", flag: "🇹🇼" },
  { code: "en-US", name: "English", flag: "🇺🇸" },
  { code: "es-ES", name: "Español", flag: "🇪🇸" },
  { code: "de-DE", name: "Deutsch", flag: "🇩🇪" },
  { code: "fr-FR", name: "Français", flag: "🇫🇷" },
  { code: "ja-JP", name: "日本語", flag: "🇯🇵" },
  { code: "ko-KR", name: "한국어", flag: "🇰🇷" },
] as const;

// 文章生成支援的語系（18 種）
export const ARTICLE_LOCALES = [
  { code: "zh-TW", name: "繁體中文", flag: "🇹🇼" },
  { code: "zh-CN", name: "简体中文", flag: "🇨🇳" },
  { code: "en-US", name: "English", flag: "🇺🇸" },
  { code: "ja-JP", name: "日本語", flag: "🇯🇵" },
  { code: "ko-KR", name: "한국어", flag: "🇰🇷" },
  { code: "vi-VN", name: "Tiếng Việt", flag: "🇻🇳" },
  { code: "ms-MY", name: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "th-TH", name: "ไทย", flag: "🇹🇭" },
  { code: "id-ID", name: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "tl-PH", name: "Filipino", flag: "🇵🇭" },
  { code: "fr-FR", name: "Français", flag: "🇫🇷" },
  { code: "de-DE", name: "Deutsch", flag: "🇩🇪" },
  { code: "es-ES", name: "Español", flag: "🇪🇸" },
  { code: "pt-PT", name: "Português", flag: "🇵🇹" },
  { code: "it-IT", name: "Italiano", flag: "🇮🇹" },
  { code: "ru-RU", name: "Русский", flag: "🇷🇺" },
  { code: "ar-SA", name: "العربية", flag: "🇸🇦" },
  { code: "hi-IN", name: "हिन्दी", flag: "🇮🇳" },
] as const;

// 預設語系
export const DEFAULT_UI_LOCALE = "zh-TW";
export const DEFAULT_ARTICLE_LOCALE = "zh-TW";

// 類型定義
export type UILocaleCode = (typeof UI_LOCALES)[number]["code"];
export type ArticleLocaleCode = (typeof ARTICLE_LOCALES)[number]["code"];

// localStorage keys
export const UI_LOCALE_STORAGE_KEY = "ui-locale";
export const ARTICLE_LOCALE_STORAGE_KEY = "preferred-language";

// 語言代碼到完整名稱的映射（用於 AI 提示）
export const LOCALE_FULL_NAMES: Record<string, string> = {
  "zh-TW": "Traditional Chinese (繁體中文)",
  "zh-CN": "Simplified Chinese (简体中文)",
  "en-US": "English",
  "ja-JP": "Japanese (日本語)",
  "ko-KR": "Korean (한국어)",
  "vi-VN": "Vietnamese (Tiếng Việt)",
  "ms-MY": "Malay (Bahasa Melayu)",
  "th-TH": "Thai (ไทย)",
  "id-ID": "Indonesian (Bahasa Indonesia)",
  "tl-PH": "Filipino",
  "fr-FR": "French (Français)",
  "de-DE": "German (Deutsch)",
  "es-ES": "Spanish (Español)",
  "pt-PT": "Portuguese (Português)",
  "it-IT": "Italian (Italiano)",
  "ru-RU": "Russian (Русский)",
  "ar-SA": "Arabic (العربية)",
  "hi-IN": "Hindi (हिन्दी)",
};

// 輔助函數：取得語系名稱
export function getLocaleName(code: string): string {
  const uiLocale = UI_LOCALES.find((l) => l.code === code);
  if (uiLocale) return uiLocale.name;

  const articleLocale = ARTICLE_LOCALES.find((l) => l.code === code);
  if (articleLocale) return articleLocale.name;

  return code;
}

// 輔助函數：取得語系旗幟
export function getLocaleFlag(code: string): string {
  const uiLocale = UI_LOCALES.find((l) => l.code === code);
  if (uiLocale) return uiLocale.flag;

  const articleLocale = ARTICLE_LOCALES.find((l) => l.code === code);
  if (articleLocale) return articleLocale.flag;

  return "";
}
