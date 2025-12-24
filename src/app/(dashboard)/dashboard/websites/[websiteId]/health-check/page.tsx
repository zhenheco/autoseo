/**
 * 網站健康檢查頁面
 * 顯示最新的健檢結果，並提供執行新檢查的功能
 */

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WebsiteHealthService } from "@/lib/services/website-health-service";
import {
  HealthCheckResults,
  HealthCheckTriggerButton,
} from "@/components/health-check";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Activity, ExternalLink } from "lucide-react";
import Link from "next/link";

interface HealthCheckPageProps {
  params: Promise<{ websiteId: string }>;
}

export default async function HealthCheckPage({
  params,
}: HealthCheckPageProps) {
  const { websiteId } = await params;
  const supabase = await createClient();

  // 驗證用戶身份
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 取得網站資訊
  const { data: website, error: websiteError } = await supabase
    .from("website_configs")
    .select("id, company_id, url, name")
    .eq("id", websiteId)
    .single();

  if (websiteError || !website) {
    redirect("/dashboard/websites");
  }

  // 驗證用戶是否屬於該公司
  const { data: membership } = await supabase
    .from("company_members")
    .select("id")
    .eq("company_id", website.company_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) {
    redirect("/dashboard/websites");
  }

  // 取得最新的健檢結果
  const healthService = new WebsiteHealthService(supabase);
  const latestCheck = await healthService.getLatestHealthCheck(websiteId);

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
      {/* 頁面標題 */}
      <div className="mb-6">
        <Link
          href={`/dashboard/websites/${websiteId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回網站詳情
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">網站健康檢查</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-muted-foreground">{website.name}</span>
              <a
                href={website.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
          <HealthCheckTriggerButton websiteId={websiteId} />
        </div>
      </div>

      {/* 健檢結果或空狀態 */}
      {latestCheck ? (
        <HealthCheckResults result={latestCheck} />
      ) : (
        <EmptyState websiteId={websiteId} />
      )}
    </div>
  );
}

/**
 * 空狀態元件
 */
function EmptyState({ websiteId }: { websiteId: string }) {
  return (
    <Card>
      <CardContent className="py-16">
        <div className="flex flex-col items-center text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Activity className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">尚未執行過健康檢查</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            執行健康檢查以了解您的網站在效能、SEO、無障礙性等方面的表現， 並獲得
            AI 生成的改善建議。
          </p>
          <HealthCheckTriggerButton websiteId={websiteId} />
        </div>
      </CardContent>
    </Card>
  );
}
