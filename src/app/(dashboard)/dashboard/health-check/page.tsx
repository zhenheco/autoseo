"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  Globe,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
} from "lucide-react";

interface Website {
  id: string;
  name: string;
  site_url: string | null;
}

interface HealthCheckJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
  lighthouse_performance?: number;
  lighthouse_seo?: number;
}

interface WebsiteWithHealth extends Website {
  latestJob?: HealthCheckJob | null;
}

/**
 * 網站健康檢查入口頁面
 * 顯示所有網站及其最近的健檢狀態
 */
export default function HealthCheckPage() {
  const t = useTranslations("healthCheck");
  const tNav = useTranslations("nav");
  const [websites, setWebsites] = useState<WebsiteWithHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWebsites = async () => {
      try {
        // 取得網站列表
        const response = await fetch("/api/websites");
        if (!response.ok) {
          throw new Error("Failed to fetch websites");
        }
        const data = await response.json();
        const websiteList = data.data || data || [];

        // 為每個網站取得最新的健檢狀態
        const websitesWithHealth = await Promise.all(
          websiteList.map(async (website: Website) => {
            try {
              const healthResponse = await fetch(
                `/api/websites/${website.id}/health-check`,
              );
              if (healthResponse.ok) {
                const healthData = await healthResponse.json();
                return {
                  ...website,
                  latestJob: healthData.job,
                };
              }
            } catch {
              // 忽略錯誤，繼續處理
            }
            return { ...website, latestJob: null };
          }),
        );

        setWebsites(websitesWithHealth);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchWebsites();
  }, []);

  const getStatusBadge = (job?: HealthCheckJob | null) => {
    if (!job) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          {t("neverChecked")}
        </Badge>
      );
    }

    switch (job.status) {
      case "completed":
        return (
          <Badge variant="default" className="gap-1 bg-green-500">
            <CheckCircle2 className="h-3 w-3" />
            {t("completed")}
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="default" className="gap-1 bg-blue-500">
            <Activity className="h-3 w-3 animate-pulse" />
            {t("processing")}
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {t("pending")}
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            {t("failed")}
          </Badge>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Activity className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">{tNav("healthCheck")}</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive">{error}</p>
        <Button onClick={() => window.location.reload()}>{t("retry")}</Button>
      </div>
    );
  }

  if (websites.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Activity className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">{tNav("healthCheck")}</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <Globe className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t("noWebsites")}</p>
            <Button asChild>
              <Link href="/dashboard/websites">{t("addWebsite")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">{tNav("healthCheck")}</h1>
      </div>

      <p className="text-muted-foreground">{t("description")}</p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {websites.map((website) => (
          <Card key={website.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{website.name}</CardTitle>
                  <CardDescription className="mt-1 truncate max-w-[200px]">
                    {website.site_url || t("noUrl")}
                  </CardDescription>
                </div>
                {getStatusBadge(website.latestJob)}
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href={`/dashboard/websites/${website.id}/health-check`}>
                  {website.latestJob?.status === "completed"
                    ? t("viewResults")
                    : t("startCheck")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
