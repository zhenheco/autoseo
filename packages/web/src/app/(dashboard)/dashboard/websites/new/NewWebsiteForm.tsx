"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/card";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/ui/select";
import { Switch } from "@shared/ui/switch";
import { RadioGroup, RadioGroupItem } from "@shared/ui/radio-group";
import {
  Calendar,
  Clock,
  CalendarDays,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { createWebsite } from "./actions";
import { Alert, AlertDescription, AlertTitle } from "@shared/ui/alert";
import { useTranslations } from "next-intl";
import { FormRow } from "@/components/ui/form-row";
import { IconLabel } from "@/components/ui/icon-label";

// 地區選項的 value 列表（用於 Select）
const REGION_VALUES = [
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

// 語言選項（語言名稱是原生名稱，不需要翻譯）
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

// 每日篇數選項（1-5 篇）
const DAILY_LIMIT_VALUES = ["1", "2", "3", "4", "5"] as const;

// 間隔天數選項（2-7 天）
const INTERVAL_DAY_VALUES = ["2", "3", "4", "5", "6", "7"] as const;

// 語氣選項的 value 列表
const TONE_VALUES = [
  "professionalFormal",
  "professionalFriendly",
  "casualFriendly",
  "educational",
  "persuasive",
  "expertAuthority",
] as const;

// 寫作風格選項的 value 列表
const STYLE_VALUES = [
  "professionalFormal",
  "casualFriendly",
  "educational",
  "persuasive",
] as const;

// 時段提示
const TIME_SLOTS_INFO: Record<number, string> = {
  1: "09:00",
  2: "09:00、14:00",
  3: "09:00、14:00、20:00",
  4: "09:00、11:00、14:00、20:00",
  5: "09:00、11:00、14:00、17:00、20:00",
};

interface NewWebsiteFormProps {
  companyId: string;
}

export function NewWebsiteForm({ companyId }: NewWebsiteFormProps) {
  const t = useTranslations("websites.new");

  // 文章生成設定
  const [industry, setIndustry] = useState("");
  const [region, setRegion] = useState("taiwan");
  const [customRegion, setCustomRegion] = useState("");
  const [language, setLanguage] = useState("zh-TW");

  // 品牌聲音設定
  const [toneOfVoice, setToneOfVoice] = useState("professionalFriendly");
  const [writingStyle, setWritingStyle] = useState("professionalFormal");

  // 自動發文設定
  const [autoScheduleEnabled, setAutoScheduleEnabled] = useState(false);
  const [scheduleType, setScheduleType] = useState<"daily" | "interval">(
    "daily",
  );
  const [dailyLimit, setDailyLimit] = useState("3");
  const [intervalDays, setIntervalDays] = useState("3");

  // 排錯說明展開狀態
  const [troubleshootOpen, setTroubleshootOpen] = useState(false);

  // 動態計算時段提示
  const currentTimeSlots =
    scheduleType === "daily"
      ? TIME_SLOTS_INFO[Number(dailyLimit)] || TIME_SLOTS_INFO[3]
      : t("fixedFirstSlot");

  // 取得翻譯後的語氣值（用於提交表單）
  const getToneValue = (key: string) => {
    return t(`tones.${key}`);
  };

  // 取得翻譯後的風格值（用於提交表單）
  const getStyleValue = (key: string) => {
    return t(`styles.${key}`);
  };

  return (
    <form action={createWebsite} className="space-y-6">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="industry" value={industry} />
      <input
        type="hidden"
        name="region"
        value={region === "other" ? customRegion : region}
      />
      <input type="hidden" name="language" value={language} />
      <input
        type="hidden"
        name="toneOfVoice"
        value={getToneValue(toneOfVoice)}
      />
      <input
        type="hidden"
        name="writingStyle"
        value={getStyleValue(writingStyle)}
      />
      {/* 自動發文設定 hidden fields */}
      <input
        type="hidden"
        name="autoScheduleEnabled"
        value={autoScheduleEnabled ? "true" : "false"}
      />
      <input type="hidden" name="scheduleType" value={scheduleType} />
      <input type="hidden" name="dailyArticleLimit" value={dailyLimit} />
      <input type="hidden" name="scheduleIntervalDays" value={intervalDays} />

      {/* 網站資訊 */}
      <Card>
        <CardHeader>
          <CardTitle>{t("websiteInfoTitle")}</CardTitle>
          <CardDescription>{t("websiteInfoDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormRow
            label={t("siteNameLabel")}
            htmlFor="site-name"
            helperText={t("siteNameHint")}
          >
            <Input
              id="site-name"
              name="siteName"
              placeholder={t("siteNamePlaceholder")}
              required
            />
          </FormRow>

          <FormRow
            label={t("siteUrlLabel")}
            htmlFor="site-url"
            helperText={t("siteUrlHint")}
          >
            <Input
              id="site-url"
              name="siteUrl"
              type="url"
              placeholder={t("siteUrlPlaceholder")}
              required
            />
          </FormRow>

          <FormRow label={t("wpUsernameLabel")} htmlFor="wp-username">
            <Input
              id="wp-username"
              name="wpUsername"
              placeholder={t("wpUsernamePlaceholder")}
              required
            />
          </FormRow>

          <FormRow
            label={t("wpPasswordLabel")}
            htmlFor="wp-password"
            helperText={t("wpPasswordHint")}
          >
            <Input
              id="wp-password"
              name="wpPassword"
              type="password"
              placeholder={t("wpPasswordPlaceholder")}
              required
            />
          </FormRow>

          {/* 排錯說明 */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setTroubleshootOpen(!troubleshootOpen)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <IconLabel icon={<HelpCircle className="h-4 w-4" />}>
                <span>{t("troubleshootToggle")}</span>
                {troubleshootOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </IconLabel>
            </button>

            {troubleshootOpen && (
              <Alert className="mt-3">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t("troubleshootTitle")}</AlertTitle>
                <AlertDescription className="mt-2 space-y-3">
                  <div>
                    <p className="font-medium text-sm">{t("error403Title")}</p>
                    <ul className="list-disc list-inside text-sm mt-1 space-y-1 text-muted-foreground">
                      <li>
                        <strong>{t("error403Reason1")}</strong>
                        {t("error403Reason1Desc")}
                      </li>
                      <li>
                        <strong>{t("error403Reason2")}</strong>
                        {t("error403Reason2Desc")}
                      </li>
                      <li>
                        <strong>{t("error403Reason3")}</strong>
                        {t("error403Reason3Desc")}
                      </li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-sm">{t("error401Title")}</p>
                    <ul className="list-disc list-inside text-sm mt-1 space-y-1 text-muted-foreground">
                      <li>{t("error401Reason1")}</li>
                      <li>{t("error401Reason2")}</li>
                      <li>{t("error401Reason3")}</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-sm">{t("error404Title")}</p>
                    <ul className="list-disc list-inside text-sm mt-1 space-y-1 text-muted-foreground">
                      <li>{t("error404Reason1")}</li>
                      <li>{t("error404Reason2")}</li>
                      <li>{t("error404Reason3")}</li>
                    </ul>
                  </div>

                  <div className="pt-3 mt-3 border-t">
                    <p className="font-medium text-sm text-orange-600 dark:text-orange-400">
                      {t("cloudwaysTitle")}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("cloudwaysDesc")}
                    </p>
                    <ul className="list-disc list-inside text-sm mt-1 space-y-1 text-muted-foreground">
                      <li>
                        <strong>{t("cloudwaysReason1")}</strong>
                        {t("cloudwaysReason1Desc")}
                      </li>
                      <li>
                        <strong>{t("cloudwaysReason2")}</strong>
                        {t("cloudwaysReason2Desc")}
                      </li>
                      <li>
                        <strong>{t("cloudwaysReason3")}</strong>
                        {t("cloudwaysReason3Desc")}
                      </li>
                    </ul>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("cloudwaysNote")}
                    </p>
                  </div>

                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium">{t("quickTestTitle")}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("quickTestDesc")}{" "}
                      <code className="bg-muted px-1 py-0.5 rounded text-xs">
                        {t("quickTestEndpoint")}
                      </code>
                      {t("quickTestResult")}
                    </p>
                  </div>

                  <div className="pt-2">
                    <a
                      href="https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/#application-passwords"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      {t("wpDocsLink")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 文章生成設定 */}
      <Card>
        <CardHeader>
          <CardTitle>{t("articleSettingsTitle")}</CardTitle>
          <CardDescription>{t("articleSettingsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormRow
            label={t("topicLabel")}
            htmlFor="industry"
            helperText={t("topicHint")}
          >
            <Input
              id="industry"
              name="industryDisplay"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder={t("topicPlaceholder")}
            />
          </FormRow>

          <FormRow
            label={t("regionLabel")}
            htmlFor="region"
            helperText={t("regionHint")}
          >
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger id="region">
                <SelectValue placeholder={t("regionPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {REGION_VALUES.map((reg) => (
                  <SelectItem key={reg} value={reg}>
                    {t(`regions.${reg}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {region === "other" && (
              <Input
                value={customRegion}
                onChange={(e) => setCustomRegion(e.target.value)}
                placeholder={t("customRegionPlaceholder")}
                className="mt-2"
              />
            )}
          </FormRow>

          <FormRow
            label={t("languageLabel")}
            htmlFor="language"
            helperText={t("languageHint")}
          >
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="language">
                <SelectValue placeholder={t("languagePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>
        </CardContent>
      </Card>

      {/* 品牌聲音設定 */}
      <Card>
        <CardHeader>
          <CardTitle>{t("brandVoiceTitle")}</CardTitle>
          <CardDescription>{t("brandVoiceDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormRow
            label={t("brandNameLabel")}
            htmlFor="brand-name"
            helperText={t("brandNameHint")}
          >
            <Input
              id="brand-name"
              name="brandName"
              placeholder={t("brandNamePlaceholder")}
            />
          </FormRow>

          <FormRow label={t("toneLabel")} htmlFor="tone-of-voice">
            <Select value={toneOfVoice} onValueChange={setToneOfVoice}>
              <SelectTrigger id="tone-of-voice">
                <SelectValue placeholder={t("tonePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {TONE_VALUES.map((tone) => (
                  <SelectItem key={tone} value={tone}>
                    {t(`tones.${tone}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>

          <FormRow
            label={t("targetAudienceLabel")}
            htmlFor="target-audience"
            helperText={t("targetAudienceHint")}
          >
            <Input
              id="target-audience"
              name="targetAudience"
              placeholder={t("targetAudiencePlaceholder")}
            />
          </FormRow>

          <FormRow label={t("writingStyleLabel")} htmlFor="writing-style">
            <Select value={writingStyle} onValueChange={setWritingStyle}>
              <SelectTrigger id="writing-style">
                <SelectValue placeholder={t("writingStylePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {STYLE_VALUES.map((style) => (
                  <SelectItem key={style} value={style}>
                    {t(`styles.${style}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>
        </CardContent>
      </Card>

      {/* 自動發文設定 */}
      <Card>
        <CardHeader>
          <CardTitle>
            <IconLabel icon={<Calendar className="h-5 w-5" />}>
              {t("autoScheduleTitle")}
            </IconLabel>
          </CardTitle>
          <CardDescription>{t("autoScheduleDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 自動排程開關 */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">{t("autoScheduleLabel")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("autoScheduleHint")}
              </p>
            </div>
            <Switch
              checked={autoScheduleEnabled}
              onCheckedChange={setAutoScheduleEnabled}
            />
          </div>

          {/* 排程模式選擇 */}
          <div className="space-y-3">
            <Label>{t("scheduleModeLabel")}</Label>
            <RadioGroup
              value={scheduleType}
              onValueChange={(v) => setScheduleType(v as "daily" | "interval")}
              disabled={!autoScheduleEnabled}
              className="grid grid-cols-2 gap-4"
            >
              <div className="flex items-center space-x-2 rounded-lg border p-4 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="daily" id="daily" />
                <IconLabel
                  as="label"
                  htmlFor="daily"
                  className="cursor-pointer"
                  icon={<Clock className="h-4 w-4" />}
                >
                  {t("dailyPublish")}
                </IconLabel>
              </div>
              <div className="flex items-center space-x-2 rounded-lg border p-4 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="interval" id="interval" />
                <IconLabel
                  as="label"
                  htmlFor="interval"
                  className="cursor-pointer"
                  icon={<CalendarDays className="h-4 w-4" />}
                >
                  {t("intervalPublish")}
                </IconLabel>
              </div>
            </RadioGroup>
          </div>

          {/* 每日發布模式：選擇每日篇數 */}
          {scheduleType === "daily" && (
            <FormRow label={t("dailyLimitLabel")} htmlFor="daily-limit">
              <Select
                value={dailyLimit}
                onValueChange={setDailyLimit}
                disabled={!autoScheduleEnabled}
              >
                <SelectTrigger id="daily-limit">
                  <SelectValue placeholder={t("dailyLimitPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {DAILY_LIMIT_VALUES.map((limit) => (
                    <SelectItem key={limit} value={limit}>
                      {t(`dailyLimits.${limit}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>
          )}

          {/* 間隔發布模式：選擇間隔天數 */}
          {scheduleType === "interval" && (
            <FormRow
              label={t("intervalLabel")}
              htmlFor="interval-days"
              helperText={t("intervalHint")}
            >
              <Select
                value={intervalDays}
                onValueChange={setIntervalDays}
                disabled={!autoScheduleEnabled}
              >
                <SelectTrigger id="interval-days">
                  <SelectValue placeholder={t("intervalPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_DAY_VALUES.map((interval) => (
                    <SelectItem key={interval} value={interval}>
                      {t(`intervalDays.${interval}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>
          )}

          {/* 時段提示 */}
          {autoScheduleEnabled && (
            <div className="rounded-lg bg-muted/50 p-3">
              <IconLabel
                as="p"
                className="text-sm text-muted-foreground"
                icon={<Clock className="h-4 w-4" />}
              >
                <span>
                  {t("publishTimeLabel", { slots: currentTimeSlots })}
                </span>
              </IconLabel>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 按鈕區 */}
      <div className="flex gap-4">
        <Button type="submit">{t("submitButton")}</Button>
        <Link href="/dashboard/websites">
          <Button type="button" variant="outline">
            {t("cancelButton")}
          </Button>
        </Link>
      </div>
    </form>
  );
}
