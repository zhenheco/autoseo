import {
  Inter,
  Plus_Jakarta_Sans,
  Noto_Sans_TC,
  Noto_Sans_JP,
  Roboto,
} from "next/font/google";

// 支援的語系常數
type SupportedLocale = "zh-TW" | "zh-CN" | "ja-JP" | "en-US";
type FontClass = "font-noto-tc" | "font-noto-jp" | "font-jakarta";

// 語系到字體的映射
const LOCALE_TO_FONT: Record<SupportedLocale, FontClass> = {
  "zh-TW": "font-noto-tc",
  "zh-CN": "font-noto-tc",
  "ja-JP": "font-noto-jp",
  "en-US": "font-jakarta",
} as const;

// 預設字體
const DEFAULT_FONT_CLASS: FontClass = "font-jakarta";

// 英文主字體 - Inter
export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

// 設計字體 - Plus Jakarta Sans（現代感）
export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

// 繁體中文字體
export const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  variable: "--font-noto-tc",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

// 日文字體
export const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-jp",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

// 備用字體 - Roboto
export const roboto = Roboto({
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap",
  weight: ["300", "400", "500", "700"],
});

// 語系字體映射
export const fontVariables = [
  inter.variable,
  jakarta.variable,
  notoSansTC.variable,
  notoSansJP.variable,
  roboto.variable,
].join(" ");

/**
 * 根據語系返回適合的字體類別
 * @param locale 語系代碼
 * @returns 對應的字體 CSS 類別
 */
export function getFontClassForLocale(locale: string): FontClass {
  // 型別守衛：確保 locale 是支援的類型
  if (locale in LOCALE_TO_FONT) {
    return LOCALE_TO_FONT[locale as SupportedLocale];
  }

  // Fallback: 嘗試匹配語言前綴
  const languagePrefix = locale.split("-")[0];

  switch (languagePrefix) {
    case "zh":
      return "font-noto-tc";
    case "ja":
      return "font-noto-jp";
    case "en":
    default:
      return DEFAULT_FONT_CLASS;
  }
}

/**
 * 檢查是否為支援的語系
 * @param locale 語系代碼
 * @returns 是否支援
 */
export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return locale in LOCALE_TO_FONT;
}

/**
 * 取得所有支援的語系
 * @returns 支援的語系列表
 */
export function getSupportedLocales(): SupportedLocale[] {
  return Object.keys(LOCALE_TO_FONT) as SupportedLocale[];
}
