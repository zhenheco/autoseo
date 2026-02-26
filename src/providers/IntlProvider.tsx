"use client";

import { NextIntlClientProvider } from "next-intl";
import { useEffect, useState, ReactNode } from "react";
import {
  UI_LOCALES,
  DEFAULT_UI_LOCALE,
  UI_LOCALE_STORAGE_KEY,
  UI_LOCALE_COOKIE_KEY,
} from "@/lib/i18n/locales";
import { LocalePrompt } from "@/components/i18n/LocalePrompt";

// 同步載入預設語系的翻譯檔案（用於 SSR）
import defaultMessages from "@/messages/zh-TW.json";

/**
 * 動態載入翻譯檔案
 * @param locale 語系代碼
 * @returns Promise<翻譯物件>
 */
async function loadMessages(locale: string): Promise<Record<string, unknown>> {
  try {
    const messages = await import(`@/messages/${locale}.json`);
    return messages.default;
  } catch (error) {
    console.warn(
      `[IntlProvider] 無法載入語系檔案：${locale}.json，使用預設翻譯`,
      error,
    );
    // 如果找不到翻譯檔案，使用預設翻譯
    return defaultMessages;
  }
}

/**
 * 輔助函數：安全讀取 cookie
 * @param name Cookie 名稱
 * @returns Cookie 值或 null
 */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(";").shift();
    return cookieValue || null;
  }

  return null;
}

interface IntlProviderProps {
  children: ReactNode;
}

export function IntlProvider({ children }: IntlProviderProps) {
  const [locale, setLocale] = useState(DEFAULT_UI_LOCALE);
  // 使用預設翻譯作為初始值，確保 SSR 時也有 context
  const [messages, setMessages] =
    useState<Record<string, unknown>>(defaultMessages);

  // 初始化：讀取語系設定（優先順序：localStorage > cookie > 預設值）
  useEffect(() => {
    let isMounted = true; // 防止組件卸載後更新狀態

    const storedLocale = localStorage.getItem(UI_LOCALE_STORAGE_KEY);
    const cookieLocale = getCookie(UI_LOCALE_COOKIE_KEY);
    const validLocales: string[] = UI_LOCALES.map((l) => l.code);

    let targetLocale = DEFAULT_UI_LOCALE;

    if (storedLocale && validLocales.includes(storedLocale)) {
      // 優先使用 localStorage（用戶手動選擇的語系）
      targetLocale = storedLocale;
    } else if (cookieLocale && validLocales.includes(cookieLocale)) {
      // 其次使用 cookie（IP 偵測的語系）
      targetLocale = cookieLocale;
      // 同步到 localStorage，避免下次還要讀 cookie
      localStorage.setItem(UI_LOCALE_STORAGE_KEY, cookieLocale);
    }
    // 移除 navigator.language 邏輯，改由 middleware IP 偵測處理

    // 如果目標語系不是預設語系，載入對應的翻譯檔案
    if (targetLocale !== DEFAULT_UI_LOCALE) {
      setTimeout(() => {
        if (isMounted) setLocale(targetLocale);
      }, 0);

      loadMessages(targetLocale).then((msgs) => {
        setTimeout(() => {
          if (isMounted) setMessages(msgs);
        }, 0);
      });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // 監聽語系變更事件
  useEffect(() => {
    const handleLocaleChange = (event: CustomEvent<string>) => {
      const newLocale = event.detail;
      setLocale(newLocale);
      loadMessages(newLocale).then(setMessages);
    };

    window.addEventListener(
      "uiLocaleChanged",
      handleLocaleChange as EventListener,
    );

    return () => {
      window.removeEventListener(
        "uiLocaleChanged",
        handleLocaleChange as EventListener,
      );
    };
  }, []);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="Asia/Taipei"
    >
      {children}
      <LocalePrompt currentLocale={locale} />
    </NextIntlClientProvider>
  );
}
