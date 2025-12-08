"use client";

import { useState, useEffect } from "react";
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

const REGIONS = [
  { value: "taiwan", label: "台灣" },
  { value: "japan", label: "日本" },
  { value: "usa", label: "美國" },
  { value: "singapore", label: "新加坡" },
  { value: "hongkong", label: "香港" },
  { value: "china", label: "中國" },
  { value: "korea", label: "韓國" },
  { value: "global", label: "全球" },
  { value: "other", label: "其他" },
];

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

        // 只有網站有設定時才更新
        if (settings.industry) {
          setTimeout(() => setIndustry(settings.industry), 0);
        }

        if (settings.region) {
          // 檢查是否為預設地區
          const isPreset = REGIONS.some((r) => r.value === settings.region);
          if (isPreset) {
            setTimeout(() => setRegion(settings.region), 0);
          } else {
            setTimeout(() => {
              setRegion("other");
              setCustomRegion(settings.region);
            }, 0);
          }
        }

        if (settings.language) {
          setTimeout(() => setLanguage(settings.language), 0);
        }
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
          <Label htmlFor="website">目標網站</Label>
          <WebsiteSelector
            value={selectedWebsiteId}
            onChange={setSelectedWebsiteId}
            allowNoWebsite={true}
            placeholder="選擇網站（選填）"
          />
        </div>
        <div className="rounded-lg bg-muted/50 p-4 space-y-3">
          <h4 className="font-medium text-sm">💡 使用說明</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• 不選擇網站也可生成文章</li>
            <li>• 稍後可在「文章管理」決定發布目標</li>
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="industry">你想要寫些什麼?</Label>
          <Input
            id="industry"
            value={industry}
            onChange={(e) => handleIndustryChange(e.target.value)}
            placeholder="如何把ai融入行銷中"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="region">目標地區 *</Label>
          <Select value={region} onValueChange={handleRegionChange}>
            <SelectTrigger id="region">
              <SelectValue placeholder="請選擇目標地區" />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map((reg) => (
                <SelectItem key={reg.value} value={reg.value}>
                  {reg.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {region === "other" && (
            <Input
              id="customRegion"
              value={customRegion}
              onChange={(e) => handleCustomRegionChange(e.target.value)}
              placeholder="請輸入您的目標地區"
              className="mt-2"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="language">撰寫語言 *</Label>
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger id="language">
              <SelectValue placeholder="請選擇撰寫語言" />
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
            <TabsTrigger value="quick">關鍵字生成</TabsTrigger>
            <TabsTrigger value="advanced">AI全自動生成</TabsTrigger>
          </TabsList>
          <TabsContent value="quick" className="mt-4">
            <QuickArticleForm
              quotaStatus={quotaStatus}
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
