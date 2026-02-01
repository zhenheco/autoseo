"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Share2,
  Settings,
  History,
  ExternalLink,
  ArrowRight,
  Info,
} from "lucide-react";

// 發文小助手系統 URL
const BAS_SYSTEM_URL = "https://bas.zhenhe-dm.com";

/**
 * 社群發文主頁面
 *
 * 功能：
 * - 引導用戶到發文小助手管理帳號和額度
 * - 快速導航到各功能
 * - 使用說明
 */
export default function SocialPage() {
  const t = useTranslations("social");

  return (
    <div className="container mx-auto py-6 space-y-8">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Share2 className="h-8 w-8 text-primary" />
            {t("title") || "社群發文"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("description") || "將 SEO 文章轉換為社群貼文並自動發布"}
          </p>
        </div>
      </div>

      {/* 發文小助手提示卡片 */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            {t("basSystemTitle") || "帳號與額度管理"}
          </CardTitle>
          <CardDescription>
            {t("basSystemDescription") ||
              "社群發文功能使用發文小助手進行帳號管理和額度計費"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t("basSystemHint") ||
                "請至發文小助手查看您的帳號額度、購買發文點數"}
            </p>
            <Button asChild>
              <a
                href={BAS_SYSTEM_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {t("goToBas") || "前往發文小助手"}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 功能卡片 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 帳號設定 */}
        <Card className="hover:border-primary transition-colors cursor-pointer group">
          <Link href="/dashboard/social/settings">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 group-hover:text-primary">
                <Settings className="h-5 w-5" />
                {t("accountSettings") || "帳號設定"}
              </CardTitle>
              <CardDescription>
                {t("accountSettingsDesc") ||
                  "連接您的發文小助手帳號以使用社群發文功能"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t("connectAccounts") || "連接 Facebook、Instagram、Threads"}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </div>
            </CardContent>
          </Link>
        </Card>

        {/* 發文紀錄 */}
        <Card className="hover:border-primary transition-colors cursor-pointer group">
          <Link href="/dashboard/social/posts">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 group-hover:text-primary">
                <History className="h-5 w-5" />
                {t("postHistory") || "發文紀錄"}
              </CardTitle>
              <CardDescription>
                {t("postHistoryDesc") || "查看所有社群發文狀態"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t("viewHistory") || "查看發文歷史記錄"}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* 使用說明 */}
      <Card>
        <CardHeader>
          <CardTitle>{t("howToUse")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                1
              </div>
              <div>
                <h4 className="font-medium">{t("step1Title")}</h4>
                <p className="text-sm text-muted-foreground">
                  {t("step1Desc")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                2
              </div>
              <div>
                <h4 className="font-medium">{t("step2Title")}</h4>
                <p className="text-sm text-muted-foreground">
                  {t("step2Desc")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                3
              </div>
              <div>
                <h4 className="font-medium">{t("step3Title")}</h4>
                <p className="text-sm text-muted-foreground">
                  {t("step3Desc")}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
