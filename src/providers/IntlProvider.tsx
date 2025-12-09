"use client";

import { NextIntlClientProvider } from "next-intl";
import { useEffect, useState, ReactNode } from "react";
import {
  UI_LOCALES,
  DEFAULT_UI_LOCALE,
  UI_LOCALE_STORAGE_KEY,
} from "@/lib/i18n/locales";

// 同步載入預設語系的翻譯檔案（用於 SSR）
import defaultMessages from "@/messages/zh-TW.json";

// 動態載入翻譯檔案
async function loadMessages(locale: string) {
  try {
    const messages = await import(`@/messages/${locale}.json`);
    return messages.default;
  } catch {
    // 如果找不到翻譯檔案，使用預設翻譯
    return defaultMessages;
  }
}

interface IntlProviderProps {
  children: ReactNode;
}

export function IntlProvider({ children }: IntlProviderProps) {
  const [locale, setLocale] = useState(DEFAULT_UI_LOCALE);
  // 使用預設翻譯作為初始值，確保 SSR 時也有 context
  const [messages, setMessages] =
    useState<Record<string, unknown>>(defaultMessages);

  // 初始化：讀取 localStorage 中的語系設定（只在 client 端）
  useEffect(() => {
    const stored = localStorage.getItem(UI_LOCALE_STORAGE_KEY);
    const validLocales: string[] = UI_LOCALES.map((l) => l.code);

    let targetLocale = DEFAULT_UI_LOCALE;

    if (stored && validLocales.includes(stored)) {
      targetLocale = stored;
    } else {
      // 嘗試從瀏覽器語言設定推斷
      const browserLang = navigator.language;
      const match = validLocales.find(
        (l) => l === browserLang || l.startsWith(browserLang.split("-")[0]),
      );
      if (match) {
        targetLocale = match;
      }
    }

    // 如果目標語系不是預設語系，載入對應的翻譯檔案
    if (targetLocale !== DEFAULT_UI_LOCALE) {
      setTimeout(() => setLocale(targetLocale), 0);
      loadMessages(targetLocale).then((msgs) => {
        setTimeout(() => setMessages(msgs), 0);
      });
    }
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
    </NextIntlClientProvider>
  );
}
