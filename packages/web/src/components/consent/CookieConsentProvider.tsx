"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type {
  CookieConsentState,
  CookieConsentContextType,
  StoredCookieConsent,
} from "@/types/google-analytics.types";
import { CookieConsentBanner } from "./CookieConsentBanner";
import { CookieSettingsDialog } from "./CookieSettingsDialog";

const CONSENT_STORAGE_KEY = "cookie_consent";
const CONSENT_VERSION = "1.0";

const defaultConsent: CookieConsentState = {
  necessary: true, // 必要 Cookie 始終為 true
  analytics: false,
  marketing: false,
};

const CookieConsentContext = createContext<CookieConsentContextType | null>(
  null,
);

/**
 * 生成訪客 ID（使用瀏覽器指紋的簡化版本）
 */
function generateVisitorId(): string {
  const userAgent = navigator.userAgent;
  const language = navigator.language;
  const screenResolution = `${screen.width}x${screen.height}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const fingerprint = `${userAgent}|${language}|${screenResolution}|${timezone}`;

  // 簡單的 hash 函數
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(16).padStart(8, "0");
}

interface CookieConsentProviderProps {
  children: ReactNode;
}

/**
 * Cookie 同意 Provider
 * 管理 GDPR 合規的 Cookie 同意狀態
 */
export function CookieConsentProvider({
  children,
}: CookieConsentProviderProps) {
  const [consent, setConsent] = useState<CookieConsentState>(defaultConsent);
  const [hasConsented, setHasConsented] = useState(true); // 預設 true 避免閃爍
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 從 localStorage 載入同意狀態
  useEffect(() => {
    const loadConsent = () => {
      try {
        const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
        if (stored) {
          const parsed: StoredCookieConsent = JSON.parse(stored);
          if (parsed.version === CONSENT_VERSION) {
            setConsent(parsed.consent);
            setHasConsented(true);
          } else {
            // 版本不符，需要重新同意
            setHasConsented(false);
          }
        } else {
          setHasConsented(false);
        }
      } catch {
        setHasConsented(false);
      } finally {
        setIsLoading(false);
      }
    };

    // 使用 setTimeout 避免 SSR hydration 問題
    setTimeout(loadConsent, 0);
  }, []);

  // 儲存同意狀態
  const saveConsent = useCallback(async (newConsent: CookieConsentState) => {
    const data: StoredCookieConsent = {
      consent: newConsent,
      version: CONSENT_VERSION,
      timestamp: Date.now(),
    };

    // 儲存到 localStorage
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(data));
    setConsent(newConsent);
    setHasConsented(true);

    // 記錄到後端（GDPR 合規）
    try {
      const visitorId = generateVisitorId();
      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitor_id: visitorId,
          analytics_consent: newConsent.analytics,
          marketing_consent: newConsent.marketing,
          consent_version: CONSENT_VERSION,
        }),
      });
    } catch (error) {
      // 記錄失敗不影響用戶體驗
      console.error("Failed to log consent:", error);
    }
  }, []);

  // 接受全部 Cookie
  const acceptAll = useCallback(() => {
    saveConsent({
      necessary: true,
      analytics: true,
      marketing: true,
    });
  }, [saveConsent]);

  // 只接受必要 Cookie
  const rejectAll = useCallback(() => {
    saveConsent({
      necessary: true,
      analytics: false,
      marketing: false,
    });
  }, [saveConsent]);

  // 更新部分同意狀態
  const updateConsent = useCallback(
    (partial: Partial<CookieConsentState>) => {
      saveConsent({
        ...consent,
        ...partial,
        necessary: true, // 必要 Cookie 始終為 true
      });
    },
    [consent, saveConsent],
  );

  // 開啟設定對話框
  const openSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  // 關閉設定對話框
  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const contextValue: CookieConsentContextType = {
    consent,
    hasConsented,
    isLoading,
    acceptAll,
    rejectAll,
    updateConsent,
    openSettings,
    closeSettings,
    isSettingsOpen,
  };

  return (
    <CookieConsentContext.Provider value={contextValue}>
      {children}
      {!isLoading && !hasConsented && <CookieConsentBanner />}
      {isSettingsOpen && <CookieSettingsDialog />}
    </CookieConsentContext.Provider>
  );
}

/**
 * 使用 Cookie 同意 Context 的 Hook
 */
export function useCookieConsent(): CookieConsentContextType {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error(
      "useCookieConsent must be used within CookieConsentProvider",
    );
  }
  return context;
}
