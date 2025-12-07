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
import Link from "next/link";
import { createWebsite } from "./actions";

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
            <Label htmlFor="industry">你想要寫些什麼?</Label>
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
