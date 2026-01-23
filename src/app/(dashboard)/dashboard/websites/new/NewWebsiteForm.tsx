"use client";

import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

// 每日篇數選項（1-5 篇）
const DAILY_LIMITS = [
  { value: "1", label: "1 篇" },
  { value: "2", label: "2 篇" },
  { value: "3", label: "3 篇" },
  { value: "4", label: "4 篇" },
  { value: "5", label: "5 篇" },
];

// 間隔天數選項（2-7 天）
const INTERVAL_DAYS = [
  { value: "2", label: "每 2 天" },
  { value: "3", label: "每 3 天" },
  { value: "4", label: "每 4 天" },
  { value: "5", label: "每 5 天" },
  { value: "6", label: "每 6 天" },
  { value: "7", label: "每 7 天（每週）" },
];

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
  // 文章生成設定
  const [industry, setIndustry] = useState("");
  const [region, setRegion] = useState("taiwan");
  const [customRegion, setCustomRegion] = useState("");
  const [language, setLanguage] = useState("zh-TW");

  // 品牌聲音設定
  const [toneOfVoice, setToneOfVoice] = useState("專業親切");
  const [writingStyle, setWritingStyle] = useState("專業正式");

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
      : "09:00（固定第一個黃金時段）";

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
      <input type="hidden" name="toneOfVoice" value={toneOfVoice} />
      <input type="hidden" name="writingStyle" value={writingStyle} />
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
          <CardTitle>網站資訊</CardTitle>
          <CardDescription>
            請輸入您的 WordPress 網站資訊。您需要使用 WordPress
            應用密碼進行驗證。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="site-name">網站名稱</Label>
            <Input
              id="site-name"
              name="siteName"
              placeholder="我的部落格"
              required
            />
            <p className="text-xs text-muted-foreground">
              為您的網站取一個容易辨識的名稱
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="site-url">網站 URL</Label>
            <Input
              id="site-url"
              name="siteUrl"
              type="url"
              placeholder="https://your-blog.com"
              required
            />
            <p className="text-xs text-muted-foreground">
              您的 WordPress 網站完整網址（包含 https://）
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wp-username">WordPress 使用者名稱</Label>
            <Input
              id="wp-username"
              name="wpUsername"
              placeholder="admin"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wp-password">WordPress 應用密碼</Label>
            <Input
              id="wp-password"
              name="wpPassword"
              type="password"
              placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
              required
            />
            <p className="text-xs text-muted-foreground">
              請至 WordPress 後台 → 使用者 → 個人資料 → 應用程式密碼
              建立新的應用密碼
            </p>
          </div>

          {/* 排錯說明 */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setTroubleshootOpen(!troubleshootOpen)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
              <span>連線失敗？查看排錯指南</span>
              {troubleshootOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {troubleshootOpen && (
              <Alert className="mt-3">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>WordPress 連線排錯指南</AlertTitle>
                <AlertDescription className="mt-2 space-y-3">
                  <div>
                    <p className="font-medium text-sm">
                      403 權限被拒絕 - 常見原因：
                    </p>
                    <ul className="list-disc list-inside text-sm mt-1 space-y-1 text-muted-foreground">
                      <li>
                        <strong>帳號權限不足</strong>：建立應用密碼的帳號必須是「編輯者」或「管理員」角色
                      </li>
                      <li>
                        <strong>安全外掛阻擋</strong>：Wordfence、iThemes
                        Security 等外掛可能會阻擋 REST API 請求
                      </li>
                      <li>
                        <strong>REST API 被禁用</strong>：某些主機或外掛會禁用
                        WordPress REST API
                      </li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-sm">
                      401 認證失敗 - 常見原因：
                    </p>
                    <ul className="list-disc list-inside text-sm mt-1 space-y-1 text-muted-foreground">
                      <li>使用者名稱或應用密碼輸入錯誤</li>
                      <li>應用密碼已過期或被撤銷</li>
                      <li>
                        密碼格式錯誤（應為空格分隔的 24 位字元，如 xxxx xxxx
                        xxxx xxxx xxxx xxxx）
                      </li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-sm">
                      404 找不到 API - 常見原因：
                    </p>
                    <ul className="list-disc list-inside text-sm mt-1 space-y-1 text-muted-foreground">
                      <li>網址格式錯誤（請確認包含 https://）</li>
                      <li>WordPress 固定網址設定問題</li>
                      <li>REST API 被完全禁用</li>
                    </ul>
                  </div>

                  <div className="pt-3 mt-3 border-t">
                    <p className="font-medium text-sm text-orange-600 dark:text-orange-400">
                      🔥 Cloudways 主機用戶注意：
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      如果您使用 Cloudways
                      主機，且在瀏覽器能正常訪問 REST API，但綁定時仍出現 403
                      錯誤，請檢查：
                    </p>
                    <ul className="list-disc list-inside text-sm mt-1 space-y-1 text-muted-foreground">
                      <li>
                        <strong>Bot Protection</strong>：暫時關閉機器人保護
                        （Applications → Bot Protection）
                      </li>
                      <li>
                        <strong>WAF 防火牆</strong>：將 WAF 模式改為 Learning
                        或暫時停用（Application Settings → WAF）
                      </li>
                      <li>
                        <strong>Cloudflare</strong>：如有開啟
                        Cloudflare，檢查防火牆規則是否阻擋 API 請求
                      </li>
                    </ul>
                    <p className="text-xs text-muted-foreground mt-2">
                      完成網站綁定後，可以重新啟用這些安全功能。
                    </p>
                  </div>

                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium">快速測試方法：</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      在瀏覽器中訪問{" "}
                      <code className="bg-muted px-1 py-0.5 rounded text-xs">
                        您的網站網址/wp-json/wp/v2/categories
                      </code>
                      ，如果顯示 JSON 格式的分類資料，表示 REST API 正常運作。
                    </p>
                  </div>

                  <div className="pt-2">
                    <a
                      href="https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/#application-passwords"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      查看 WordPress 應用密碼官方文件
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
          <CardTitle>文章生成設定</CardTitle>
          <CardDescription>
            設定此網站預設的主題、目標地區和語言（選填，可稍後設定）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="industry">你想要寫哪些主題?</Label>
            <Input
              id="industry"
              name="industryDisplay"
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
        </CardContent>
      </Card>

      {/* 品牌聲音設定 */}
      <Card>
        <CardHeader>
          <CardTitle>品牌聲音設定</CardTitle>
          <CardDescription>
            設定文章撰寫時使用的品牌風格和語氣（選填，可稍後設定）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand-name">品牌名稱</Label>
            <Input
              id="brand-name"
              name="brandName"
              placeholder="請輸入您的品牌名稱"
            />
            <p className="text-xs text-muted-foreground">
              文章中會適當提及此品牌名稱
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tone-of-voice">語氣</Label>
            <Select value={toneOfVoice} onValueChange={setToneOfVoice}>
              <SelectTrigger id="tone-of-voice">
                <SelectValue placeholder="請選擇語氣" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="專業正式">專業正式</SelectItem>
                <SelectItem value="專業親切">專業親切</SelectItem>
                <SelectItem value="輕鬆友善">輕鬆友善</SelectItem>
                <SelectItem value="教育性">教育性</SelectItem>
                <SelectItem value="說服性">說服性</SelectItem>
                <SelectItem value="權威專家">權威專家</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-audience">目標受眾</Label>
            <Input
              id="target-audience"
              name="targetAudience"
              placeholder="例如：B2B 專業人士、一般消費者、技術人員"
            />
            <p className="text-xs text-muted-foreground">
              描述您的目標讀者群，文章風格會根據受眾調整
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="writing-style">寫作風格</Label>
            <Select value={writingStyle} onValueChange={setWritingStyle}>
              <SelectTrigger id="writing-style">
                <SelectValue placeholder="請選擇寫作風格" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="專業正式">專業正式</SelectItem>
                <SelectItem value="輕鬆友善">輕鬆友善</SelectItem>
                <SelectItem value="教育性">教育性</SelectItem>
                <SelectItem value="說服性">說服性</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 自動發文設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            自動發文設定
          </CardTitle>
          <CardDescription>
            設定文章生成完成後的自動排程行為（選填，可稍後設定）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 自動排程開關 */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">自動排程</Label>
              <p className="text-sm text-muted-foreground">
                文章生成完成後自動排入發布佇列
              </p>
            </div>
            <Switch
              checked={autoScheduleEnabled}
              onCheckedChange={setAutoScheduleEnabled}
            />
          </div>

          {/* 排程模式選擇 */}
          <div className="space-y-3">
            <Label>排程模式</Label>
            <RadioGroup
              value={scheduleType}
              onValueChange={(v) => setScheduleType(v as "daily" | "interval")}
              disabled={!autoScheduleEnabled}
              className="grid grid-cols-2 gap-4"
            >
              <div className="flex items-center space-x-2 rounded-lg border p-4 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="daily" id="daily" />
                <Label
                  htmlFor="daily"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Clock className="h-4 w-4" />
                  每日發布
                </Label>
              </div>
              <div className="flex items-center space-x-2 rounded-lg border p-4 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="interval" id="interval" />
                <Label
                  htmlFor="interval"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <CalendarDays className="h-4 w-4" />
                  間隔發布
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 每日發布模式：選擇每日篇數 */}
          {scheduleType === "daily" && (
            <div className="space-y-2">
              <Label htmlFor="daily-limit">每日發布文章數上限</Label>
              <Select
                value={dailyLimit}
                onValueChange={setDailyLimit}
                disabled={!autoScheduleEnabled}
              >
                <SelectTrigger id="daily-limit">
                  <SelectValue placeholder="選擇每日篇數" />
                </SelectTrigger>
                <SelectContent>
                  {DAILY_LIMITS.map((limit) => (
                    <SelectItem key={limit.value} value={limit.value}>
                      {limit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 間隔發布模式：選擇間隔天數 */}
          {scheduleType === "interval" && (
            <div className="space-y-2">
              <Label htmlFor="interval-days">發布間隔</Label>
              <Select
                value={intervalDays}
                onValueChange={setIntervalDays}
                disabled={!autoScheduleEnabled}
              >
                <SelectTrigger id="interval-days">
                  <SelectValue placeholder="選擇間隔天數" />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_DAYS.map((interval) => (
                    <SelectItem key={interval.value} value={interval.value}>
                      {interval.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                每隔指定天數發布 1 篇文章
              </p>
            </div>
          )}

          {/* 時段提示 */}
          {autoScheduleEnabled && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>發布時段（台灣時間）：{currentTimeSlots}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 按鈕區 */}
      <div className="flex gap-4">
        <Button type="submit">新增網站</Button>
        <Link href="/dashboard/websites">
          <Button type="button" variant="outline">
            取消
          </Button>
        </Link>
      </div>
    </form>
  );
}
