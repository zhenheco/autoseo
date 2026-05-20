/**
 * 統一的語系常數定義
 * UI 語系和文章生成語系都從這裡引用
 */

// UI 介面支援的語系（目前只有中英日翻譯完整）
export const UI_LOCALES = [
  { code: "zh-TW", name: "繁體中文", flag: "🇹🇼" },
  { code: "en-US", name: "English", flag: "🇺🇸" },
  { code: "ja-JP", name: "日本語", flag: "🇯🇵" },
  // 以下語系翻譯尚未完整，暫時隱藏
  // { code: "es-ES", name: "Español", flag: "🇪🇸" },
  // { code: "de-DE", name: "Deutsch", flag: "🇩🇪" },
  // { code: "fr-FR", name: "Français", flag: "🇫🇷" },
  // { code: "ko-KR", name: "한국어", flag: "🇰🇷" },
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

// Cookie key（用於伺服器端讀取語系）
export const UI_LOCALE_COOKIE_KEY = "ui-locale";

// IP 偵測：國家代碼 → UI 語系映射
export const COUNTRY_TO_LOCALE: Record<string, string> = {
  // 繁體中文區域
  TW: "zh-TW", // 台灣
  HK: "zh-TW", // 香港
  MO: "zh-TW", // 澳門

  // 英文區域
  US: "en-US", // 美國
  GB: "en-US", // 英國
  AU: "en-US", // 澳洲
  CA: "en-US", // 加拿大
  NZ: "en-US", // 紐西蘭
  IE: "en-US", // 愛爾蘭
  SG: "en-US", // 新加坡

  // 日本
  JP: "ja-JP",

  // 韓國
  KR: "ko-KR",

  // 德語區
  DE: "de-DE", // 德國
  AT: "de-DE", // 奧地利
  CH: "de-DE", // 瑞士（德語區）
  LI: "de-DE", // 列支敦斯登

  // 法語區
  FR: "fr-FR", // 法國
  BE: "fr-FR", // 比利時
  LU: "fr-FR", // 盧森堡
  MC: "fr-FR", // 摩納哥

  // 西語區
  ES: "es-ES", // 西班牙
  MX: "es-ES", // 墨西哥
  AR: "es-ES", // 阿根廷
  CO: "es-ES", // 哥倫比亞
  CL: "es-ES", // 智利
  PE: "es-ES", // 秘魯
};

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
