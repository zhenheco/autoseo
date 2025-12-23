"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuickArticleForm } from "./QuickArticleForm";
import { ArticleForm } from "./ArticleForm";
import { WebsiteSelector } from "@/components/articles/WebsiteSelector";
import {
  ARTICLE_LOCALES,
  ARTICLE_LOCALE_STORAGE_KEY,
} from "@/lib/i18n/locales";

const STORAGE_KEYS = {
  LANGUAGE: ARTICLE_LOCALE_STORAGE_KEY,
  INDUSTRY: "preferred-industry",
  REGION: "preferred-region",
  CUSTOM_REGION: "preferred-custom-region",
};

const REGION_KEYS = [
  "taiwan",
  "japan",
  "usa",
  "singapore",
  "hongkong",
  "china",
  "korea",
  "global",
  "other",
] as const;

interface QuotaStatus {
  plan: string;
  quota: number;
  used: number;
  remaining: number;
  canUseCompetitors: boolean;
  month: string;
}

interface ArticleFormTabsProps {
  quotaStatus: QuotaStatus | null;
  initialWebsiteId?: string;
}

export function ArticleFormTabs({
  quotaStatus,
  initialWebsiteId,
}: ArticleFormTabsProps) {
  const t = useTranslations("articles");
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(
    initialWebsiteId || null,
  );
  const [industry, setIndustry] = useState("");
  const [region, setRegion] = useState("");
  const [customRegion, setCustomRegion] = useState("");
  const [language, setLanguage] = useState("zh-TW");

  // 初始載入 localStorage 設定
  useEffect(() => {
    const storedLanguage = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
    if (storedLanguage) {
      setTimeout(() => setLanguage(storedLanguage), 0);
    }

    const storedIndustry = localStorage.getItem(STORAGE_KEYS.INDUSTRY);
    if (storedIndustry) {
      setTimeout(() => setIndustry(storedIndustry), 0);
    }

    const storedRegion = localStorage.getItem(STORAGE_KEYS.REGION);
    if (storedRegion) {
      setTimeout(() => setRegion(storedRegion), 0);
    }

    const storedCustomRegion = localStorage.getItem(STORAGE_KEYS.CUSTOM_REGION);
    if (storedCustomRegion) {
      setTimeout(() => setCustomRegion(storedCustomRegion), 0);
    }
  }, []);

  // 當選擇網站時，自動載入網站設定
  useEffect(() => {
    if (!selectedWebsiteId) return;

    const fetchWebsiteSettings = async () => {
      try {
        const response = await fetch(
          `/api/websites/${selectedWebsiteId}/settings`,
        );
        if (!response.ok) return;

        const settings = await response.json();
        console.log("[DEBUG] 網站設定 API 返回:", settings);

        // 新邏輯：不論 API 返回什麼，都更新狀態
        // 使用單一 setTimeout 包裹所有狀態更新，避免 race condition
        setTimeout(() => {
          // 主題：有值就用，沒有就清空
          setIndustry(settings.industry || "");

          // 地區：有值就用，沒有就用預設值 "taiwan"
          if (settings.region) {
            const isPreset = (REGION_KEYS as readonly string[]).includes(
              settings.region,
            );
            if (isPreset) {
              setRegion(settings.region);
              setCustomRegion("");
            } else {
              setRegion("other");
              setCustomRegion(settings.region);
            }
          } else {
            setRegion("taiwan");
            setCustomRegion("");
          }

          // 語言：有值就用，沒有就用預設值 "zh-TW"
          setLanguage(settings.language || "zh-TW");
        }, 0);
      } catch (error) {
        console.error("載入網站設定失敗:", error);
      }
    };

    fetchWebsiteSettings();
  }, [selectedWebsiteId]);

  const handleIndustryChange = (value: string) => {
    setIndustry(value);
    localStorage.setItem(STORAGE_KEYS.INDUSTRY, value);
  };

  const handleRegionChange = (value: string) => {
    setRegion(value);
    localStorage.setItem(STORAGE_KEYS.REGION, value);
    if (value !== "other") {
      localStorage.removeItem(STORAGE_KEYS.CUSTOM_REGION);
    }
  };

  const handleCustomRegionChange = (value: string) => {
    setCustomRegion(value);
    localStorage.setItem(STORAGE_KEYS.CUSTOM_REGION, value);
  };

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, value);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="website">{t("targetWebsite")}</Label>
          <WebsiteSelector
            value={selectedWebsiteId}
            onChange={setSelectedWebsiteId}
            allowNoWebsite={true}
            placeholder={t("selectWebsite")}
          />
        </div>
        <div className="rounded-lg bg-muted/50 p-4 space-y-3">
          <h4 className="font-medium text-sm">💡 {t("usageHint")}</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• {t("noWebsiteHint")}</li>
            <li>• {t("laterPublishHint")}</li>
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="industry">{t("whatToWrite")}</Label>
          <Input
            id="industry"
            value={industry}
            onChange={(e) => handleIndustryChange(e.target.value)}
            placeholder={t("industryPlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="region">{t("targetRegion")} *</Label>
          <Select value={region} onValueChange={handleRegionChange}>
            <SelectTrigger id="region">
              <SelectValue placeholder={t("selectRegion")} />
            </SelectTrigger>
            <SelectContent>
              {REGION_KEYS.map((key) => (
                <SelectItem key={key} value={key}>
                  {t(`regions.${key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {region === "other" && (
            <Input
              id="customRegion"
              value={customRegion}
              onChange={(e) => handleCustomRegionChange(e.target.value)}
              placeholder={t("customRegionPlaceholder")}
              className="mt-2"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="language">{t("writingLanguage")} *</Label>
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger id="language">
              <SelectValue placeholder={t("selectLanguage")} />
            </SelectTrigger>
            <SelectContent>
              {ARTICLE_LOCALES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  <div className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="lg:col-span-8">
        <Tabs defaultValue="quick" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick">{t("keywordGenerate")}</TabsTrigger>
            <TabsTrigger value="advanced">{t("aiAutoGenerate")}</TabsTrigger>
          </TabsList>
          <TabsContent value="quick" className="mt-4">
            <QuickArticleForm
              websiteId={selectedWebsiteId}
              industry={industry}
              region={region === "other" ? customRegion : region}
              language={language}
            />
          </TabsContent>
          <TabsContent value="advanced" className="mt-4">
            <ArticleForm
              websiteId={selectedWebsiteId}
              industry={industry}
              region={region === "other" ? customRegion : region}
              language={language}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
