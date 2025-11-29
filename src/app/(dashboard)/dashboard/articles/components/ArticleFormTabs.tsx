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

const INDUSTRIES = [
  { value: "tech", label: "科技" },
  { value: "finance", label: "金融" },
  { value: "healthcare", label: "醫療" },
  { value: "education", label: "教育" },
  { value: "realestate", label: "房地產" },
  { value: "travel", label: "旅遊" },
  { value: "food", label: "餐飲" },
  { value: "ecommerce", label: "電商" },
  { value: "legal", label: "法律" },
  { value: "manufacturing", label: "製造業" },
  { value: "other", label: "其他" },
];

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

interface Language {
  code: string;
  name: string;
  flag: string;
}

const SUPPORTED_LANGUAGES: Language[] = [
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
  const [customIndustry, setCustomIndustry] = useState("");
  const [region, setRegion] = useState("");
  const [customRegion, setCustomRegion] = useState("");
  const [language, setLanguage] = useState("zh-TW");

  useEffect(() => {
    const stored = localStorage.getItem("preferred-language");
    if (stored) {
      setTimeout(() => setLanguage(stored), 0);
    }
  }, []);

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
          <Label htmlFor="industry">產業 *</Label>
          <Select value={industry} onValueChange={setIndustry}>
            <SelectTrigger id="industry">
              <SelectValue placeholder="請選擇產業" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((ind) => (
                <SelectItem key={ind.value} value={ind.value}>
                  {ind.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {industry === "other" && (
            <Input
              id="customIndustry"
              value={customIndustry}
              onChange={(e) => setCustomIndustry(e.target.value)}
              placeholder="請輸入您的產業"
              className="mt-2"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="region">目標地區 *</Label>
          <Select value={region} onValueChange={setRegion}>
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
              onChange={(e) => setCustomRegion(e.target.value)}
              placeholder="請輸入您的目標地區"
              className="mt-2"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="language">撰寫語言 *</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger id="language">
              <SelectValue placeholder="請選擇撰寫語言" />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
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
              industry={industry === "other" ? customIndustry : industry}
              region={region === "other" ? customRegion : region}
              language={language}
            />
          </TabsContent>
          <TabsContent value="advanced" className="mt-4">
            <ArticleForm
              websiteId={selectedWebsiteId}
              industry={industry === "other" ? customIndustry : industry}
              region={region === "other" ? customRegion : region}
              language={language}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
