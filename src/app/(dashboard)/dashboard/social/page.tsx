"use client";

import { useEffect, useState } from "react";
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
  CreditCard,
  Settings,
  History,
  Zap,
  ArrowRight,
} from "lucide-react";

/**
 * 社群點數餘額資訊
 */
interface CreditBalance {
  creditsRemaining: number;
  creditsUsed: number;
}

/**
 * 社群發文主頁面
 *
 * 功能：
 * - 顯示點數餘額
 * - 快速導航到各功能
 * - 最近發文狀態
 */
export default function SocialPage() {
  const t = useTranslations("social");
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);

  // 取得點數餘額
  useEffect(() => {
    async function fetchBalance() {
      try {
        const response = await fetch("/api/social/credits");
        if (response.ok) {
          const data = await response.json();
          setBalance(data);
        }
      } catch (error) {
        console.error("取得點數餘額失敗:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchBalance();
  }, []);

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

      {/* 點數卡片 */}
      <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            {t("creditsBalance") || "發文點數餘額"}
          </CardTitle>
          <CardDescription>
            {t("creditsDescription") || "每發布一篇社群貼文消耗 1 點"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              {loading ? (
                <div className="h-12 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
              ) : (
                <>
                  <span className="text-5xl font-bold text-purple-600">
                    {balance?.creditsRemaining?.toLocaleString() || 0}
                  </span>
                  <span className="text-xl text-muted-foreground ml-2">
                    {t("credits") || "點"}
                  </span>
                </>
              )}
            </div>
            <Button asChild>
              <Link href="/dashboard/social/credits">
                <CreditCard className="h-4 w-4 mr-2" />
                {t("buyCredits") || "購買點數"}
              </Link>
            </Button>
          </div>
          {!loading && balance && balance.creditsUsed > 0 && (
            <p className="text-sm text-muted-foreground mt-4">
              {t("totalUsed") || "累計使用"}:{" "}
              {balance.creditsUsed.toLocaleString()} {t("credits") || "點"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 功能卡片 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* 帳號設定 */}
        <Card className="hover:border-primary transition-colors cursor-pointer group">
          <Link href="/dashboard/social/settings">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 group-hover:text-primary">
                <Settings className="h-5 w-5" />
                {t("accountSettings") || "帳號設定"}
              </CardTitle>
              <CardDescription>
                {t("accountSettingsDesc") || "連接您的社群媒體帳號"}
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

        {/* 購買點數 */}
        <Card className="hover:border-primary transition-colors cursor-pointer group">
          <Link href="/dashboard/social/credits">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 group-hover:text-primary">
                <CreditCard className="h-5 w-5" />
                {t("purchaseCredits") || "購買點數"}
              </CardTitle>
              <CardDescription>
                {t("purchaseCreditsDesc") || "選擇適合您的點數套餐"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t("viewPackages") || "查看所有套餐方案"}
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
          <CardTitle>{t("howToUse") || "如何使用"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                1
              </div>
              <div>
                <h4 className="font-medium">{t("step1Title") || "連接帳號"}</h4>
                <p className="text-sm text-muted-foreground">
                  {t("step1Desc") || "在帳號設定中連接您的社群媒體帳號"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                2
              </div>
              <div>
                <h4 className="font-medium">{t("step2Title") || "選擇文章"}</h4>
                <p className="text-sm text-muted-foreground">
                  {t("step2Desc") || "在文章詳情頁點擊「分享到社群」按鈕"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                3
              </div>
              <div>
                <h4 className="font-medium">{t("step3Title") || "發布貼文"}</h4>
                <p className="text-sm text-muted-foreground">
                  {t("step3Desc") || "AI 自動生成文案，一鍵發布到多個平台"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
