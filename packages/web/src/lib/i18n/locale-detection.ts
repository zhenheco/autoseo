/**
 * 地區感知與語系偵測邏輯
 */

import { COUNTRY_TO_LOCALE, DEFAULT_UI_LOCALE, UI_LOCALES } from "./locales";

// 透過 Vercel/Cloudflare Headers 取得用戶地理位置
export async function detectUserRegion(): Promise<string | null> {
  try {
    // 嘗試使用 Vercel 的地理位置 API
    const response = await fetch("/api/geo");
    if (response.ok) {
      const data = await response.json();
      return data.country;
    }
  } catch (error) {
    console.warn("[Region Detection] Failed to detect user region:", error);
  }

  return null;
}

// 根據 IP 地址推薦語系
export function getRecommendedLocaleByCountry(countryCode: string): string {
  return COUNTRY_TO_LOCALE[countryCode] || DEFAULT_UI_LOCALE;
}

// 解析瀏覽器 Accept-Language
export function parseAcceptLanguage(acceptLanguage: string): string[] {
  return acceptLanguage
    .split(",")
    .map((lang) => {
      const [code, q] = lang.trim().split(";q=");
      return { code: code.trim(), quality: q ? parseFloat(q) : 1.0 };
    })
    .sort((a, b) => b.quality - a.quality)
    .map((item) => item.code);
}

// 智能語系偵測（優先級排序）
export function detectBestLocale({
  cookieLocale,
  acceptLanguage,
  countryCode,
}: {
  cookieLocale?: string;
  acceptLanguage?: string;
  countryCode?: string;
}): string {
  const supportedCodes = UI_LOCALES.map((l) => l.code);

  // 1. 優先使用 Cookie 中的設定
  if (cookieLocale && supportedCodes.includes(cookieLocale as any)) {
    return cookieLocale;
  }

  // 2. 解析 Accept-Language 標頭
  if (acceptLanguage) {
    const preferredLocales = parseAcceptLanguage(acceptLanguage);

    for (const preferred of preferredLocales) {
      // 精確匹配
      if (supportedCodes.includes(preferred as any)) {
        return preferred;
      }

      // 語系前綴匹配（如 zh → zh-TW）
      const languagePrefix = preferred.split("-")[0];
      const match = supportedCodes.find((code) =>
        code.startsWith(languagePrefix + "-"),
      );
      if (match) {
        return match;
      }
    }
  }

  // 3. 根據地理位置推薦
  if (countryCode) {
    const recommended = getRecommendedLocaleByCountry(countryCode);
    if (supportedCodes.includes(recommended as any)) {
      return recommended;
    }
  }

  // 4. 預設語系
  return DEFAULT_UI_LOCALE;
}

// 檢查是否需要顯示語系切換提示
export function shouldShowLocalePrompt({
  detectedLocale,
  currentLocale,
  hasShownPrompt,
}: {
  detectedLocale: string;
  currentLocale: string;
  hasShownPrompt: boolean;
}): boolean {
  return (
    !hasShownPrompt &&
    detectedLocale !== currentLocale &&
    UI_LOCALES.some((l) => l.code === detectedLocale)
  );
}

// 格式化語系顯示名稱
export function getLocaleDisplayName(code: string): string {
  const locale = UI_LOCALES.find((l) => l.code === code);
  if (!locale) return code;

  // 可以根據 targetLocale 返回本地化的語系名稱
  // 例如：在英文環境下顯示 "Traditional Chinese"
  // 在中文環境下顯示 "繁體中文"
  return locale.name;
}

// 取得語系方向（RTL/LTR）
export function getLocaleDirection(code: string): "ltr" | "rtl" {
  const rtlLocales = ["ar-SA", "he-IL", "fa-IR"];
  return rtlLocales.includes(code) ? "rtl" : "ltr";
}

// 取得語系的數字格式
export function getLocaleNumberFormat(code: string): Intl.NumberFormat {
  return new Intl.NumberFormat(code.replace("-", "_"));
}

// 取得語系的日期格式
export function getLocaleDateFormat(code: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(code.replace("-", "_"), {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
