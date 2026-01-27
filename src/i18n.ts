import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import {
  UI_LOCALE_COOKIE_KEY,
  DEFAULT_UI_LOCALE,
  UI_LOCALES,
} from "@/lib/i18n/locales";

// 支援的語系代碼
const supportedLocales: string[] = UI_LOCALES.map((l) => l.code);

// 檢查是否為有效語系
function isValidLocale(locale: string): boolean {
  return supportedLocales.includes(locale);
}

// 動態載入語系訊息
async function loadMessages(locale: string) {
  switch (locale) {
    case "zh-TW":
      return (await import("./messages/zh-TW.json")).default;
    case "en-US":
      return (await import("./messages/en-US.json")).default;
    case "ja-JP":
      return (await import("./messages/ja-JP.json")).default;
    case "ko-KR":
      return (await import("./messages/ko-KR.json")).default;
    case "de-DE":
      return (await import("./messages/de-DE.json")).default;
    case "es-ES":
      return (await import("./messages/es-ES.json")).default;
    case "fr-FR":
      return (await import("./messages/fr-FR.json")).default;
    default:
      return (await import("./messages/zh-TW.json")).default;
  }
}

export default getRequestConfig(async () => {
  // 1. 優先從 cookie 讀取用戶偏好
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(UI_LOCALE_COOKIE_KEY)?.value;

  if (cookieLocale && isValidLocale(cookieLocale)) {
    return {
      locale: cookieLocale,
      messages: await loadMessages(cookieLocale),
    };
  }

  // 2. 從 Accept-Language header 推斷
  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");
  if (acceptLanguage) {
    // 解析 Accept-Language header（例如：zh-TW,zh;q=0.9,en;q=0.8）
    const preferredLocales = acceptLanguage
      .split(",")
      .map((lang) => lang.split(";")[0].trim());

    for (const preferred of preferredLocales) {
      // 精確匹配
      if (isValidLocale(preferred)) {
        return {
          locale: preferred,
          messages: await loadMessages(preferred),
        };
      }
      // 語系前綴匹配（例如 zh → zh-TW）
      const prefix = preferred.split("-")[0];
      const match = supportedLocales.find((l) => l.startsWith(prefix + "-"));
      if (match) {
        return {
          locale: match,
          messages: await loadMessages(match),
        };
      }
    }
  }

  // 3. 回退到預設語系
  return {
    locale: DEFAULT_UI_LOCALE,
    messages: await loadMessages(DEFAULT_UI_LOCALE),
  };
});
