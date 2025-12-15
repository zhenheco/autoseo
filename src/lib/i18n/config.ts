import {
  UI_LOCALES,
  DEFAULT_UI_LOCALE,
  UI_LOCALE_STORAGE_KEY,
  UI_LOCALE_COOKIE_KEY,
  type UILocaleCode,
} from "./locales";

// 取得支援的語系代碼列表
export const locales: string[] = UI_LOCALES.map((l) => l.code);
export const defaultLocale = DEFAULT_UI_LOCALE;

// 檢查是否為有效的 UI 語系
function isValidLocale(locale: string): locale is UILocaleCode {
  return locales.includes(locale);
}

// 取得當前 UI 語系（client-side only）
export function getUILocale(): string {
  if (typeof window === "undefined") {
    return defaultLocale;
  }

  const stored = localStorage.getItem(UI_LOCALE_STORAGE_KEY);
  if (stored && isValidLocale(stored)) {
    return stored;
  }

  // 嘗試從瀏覽器語言設定推斷
  const browserLang = navigator.language;
  const match = locales.find(
    (l) => l === browserLang || l.startsWith(browserLang.split("-")[0]),
  );

  return match || defaultLocale;
}

// 設定 UI 語系（client-side only）
export function setUILocale(locale: string): void {
  if (typeof window === "undefined") return;

  if (locales.includes(locale)) {
    // 設定 localStorage
    localStorage.setItem(UI_LOCALE_STORAGE_KEY, locale);

    // 設定 cookie（確保伺服器端也知道用戶偏好，有效期 1 年）
    document.cookie = `${UI_LOCALE_COOKIE_KEY}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

    // 觸發自訂事件通知其他組件
    window.dispatchEvent(
      new CustomEvent("uiLocaleChanged", { detail: locale }),
    );
  }
}
