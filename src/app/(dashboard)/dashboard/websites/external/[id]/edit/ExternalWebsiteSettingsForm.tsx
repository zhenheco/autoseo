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
import { useTranslations } from "next-intl";

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
  const t = useTranslations("externalWebsites");
  const tWebsites = useTranslations("websites");

  const REGIONS = useMemo(
    () => [
      { value: "taiwan", label: tWebsites("regions.taiwan") },
      { value: "japan", label: tWebsites("regions.japan") },
      { value: "usa", label: tWebsites("regions.usa") },
      { value: "singapore", label: tWebsites("regions.singapore") },
      { value: "hongkong", label: tWebsites("regions.hongkong") },
      { value: "china", label: tWebsites("regions.china") },
      { value: "korea", label: tWebsites("regions.korea") },
      { value: "global", label: tWebsites("regions.global") },
      { value: "other", label: tWebsites("regions.other") },
    ],
    [tWebsites],
  );

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
  }, [initialIndustry, initialRegion, initialLanguage, REGIONS]);

  const [industry, setIndustry] = useState(initialState.industry);
  const [region, setRegion] = useState(initialState.region);
  const [customRegion, setCustomRegion] = useState(initialState.customRegion);
  const [language, setLanguage] = useState(initialState.language);

  // 計算實際要提交的地區值
  const actualRegion = region === "other" ? customRegion : region;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("articleGenerationSettings")}</CardTitle>
        <CardDescription>
          {t("articleGenerationSettingsDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={updateExternalWebsiteSettings} className="space-y-6">
          <input type="hidden" name="websiteId" value={websiteId} />
          <input type="hidden" name="industry" value={industry} />
          <input type="hidden" name="region" value={actualRegion} />
          <input type="hidden" name="language" value={language} />

          <div className="space-y-2">
            <Label htmlFor="industry">{tWebsites("topicLabel")}</Label>
            <Input
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder={tWebsites("topicPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {tWebsites("topicHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="region">{tWebsites("regionLabel")}</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger id="region">
                <SelectValue placeholder={tWebsites("regionPlaceholder")} />
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
                placeholder={tWebsites("customRegionPlaceholder")}
                className="mt-2"
              />
            )}
            <p className="text-xs text-muted-foreground">
              {tWebsites("regionHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="language">{tWebsites("languageLabel")}</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="language">
                <SelectValue placeholder={tWebsites("languagePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {tWebsites("languageHint")}
            </p>
          </div>

          <Button type="submit">{tWebsites("saveSettings")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
