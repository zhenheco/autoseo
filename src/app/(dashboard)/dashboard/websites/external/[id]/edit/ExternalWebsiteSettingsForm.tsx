"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateExternalWebsiteSettings } from "../../actions";
import type { SettingsFormProps } from "@/types/external-website.types";

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

const LANGUAGES = [
  { code: "zh-TW", name: "繁體中文" },
  { code: "zh-CN", name: "简体中文" },
  { code: "en-US", name: "English" },
  { code: "ja-JP", name: "日本語" },
  { code: "ko-KR", name: "한국어" },
  { code: "vi-VN", name: "Tiếng Việt" },
  { code: "ms-MY", name: "Bahasa Melayu" },
  { code: "th-TH", name: "ไทย" },
  { code: "id-ID", name: "Bahasa Indonesia" },
  { code: "tl-PH", name: "Filipino" },
  { code: "fr-FR", name: "Français" },
  { code: "de-DE", name: "Deutsch" },
  { code: "es-ES", name: "Español" },
  { code: "pt-PT", name: "Português" },
  { code: "it-IT", name: "Italiano" },
  { code: "ru-RU", name: "Русский" },
  { code: "ar-SA", name: "العربية" },
  { code: "hi-IN", name: "हिन्दी" },
];

export function ExternalWebsiteSettingsForm({
  websiteId,
  industry: initialIndustry,
  region: initialRegion,
  language: initialLanguage,
}: SettingsFormProps): React.ReactElement {
  // 檢查初始地區是否為預設選項之外的自訂值
  const initialState = useMemo(() => {
    const isCustomRegion =
      initialRegion !== null &&
      initialRegion !== "" &&
      !REGIONS.some((r) => r.value === initialRegion);

    return {
      industry: initialIndustry || "",
      region: isCustomRegion ? "other" : initialRegion || "",
      customRegion: isCustomRegion ? initialRegion : "",
      language: initialLanguage || "zh-TW",
    };
  }, [initialIndustry, initialRegion, initialLanguage]);

  const [industry, setIndustry] = useState(initialState.industry);
  const [region, setRegion] = useState(initialState.region);
  const [customRegion, setCustomRegion] = useState(initialState.customRegion);
  const [language, setLanguage] = useState(initialState.language);

  // 計算實際要提交的地區值
  const actualRegion = region === "other" ? customRegion : region;

  return (
    <Card>
      <CardHeader>
        <CardTitle>文章生成設定</CardTitle>
        <CardDescription>
          設定此網站預設的主題、目標地區和語言，寫文章時會自動套用這些設定
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={updateExternalWebsiteSettings} className="space-y-6">
          <input type="hidden" name="websiteId" value={websiteId} />
          <input type="hidden" name="industry" value={industry} />
          <input type="hidden" name="region" value={actualRegion} />
          <input type="hidden" name="language" value={language} />

          <div className="space-y-2">
            <Label htmlFor="industry">你想要寫哪些主題?</Label>
            <Input
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="如何把ai融入行銷中"
            />
            <p className="text-xs text-muted-foreground">
              AI 會根據這個主題調整文章內容和用語
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="region">目標地區</Label>
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
                value={customRegion}
                onChange={(e) => setCustomRegion(e.target.value)}
                placeholder="請輸入您的目標地區"
                className="mt-2"
              />
            )}
            <p className="text-xs text-muted-foreground">
              AI 會針對目標地區的讀者習慣調整內容
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="language">撰寫語言</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="language">
                <SelectValue placeholder="請選擇撰寫語言" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">文章將以此語言撰寫</p>
          </div>

          <Button type="submit">儲存設定</Button>
        </form>
      </CardContent>
    </Card>
  );
}
