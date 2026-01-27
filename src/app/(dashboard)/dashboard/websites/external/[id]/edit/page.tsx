import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/utils/admin-check";
import { createAdminClient } from "@/lib/supabase/server";
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
import Link from "next/link";
import { ExternalWebsiteSyncForm } from "./ExternalWebsiteSyncForm";
import { ExternalWebsiteBrandVoiceForm } from "./ExternalWebsiteBrandVoiceForm";
import { ExternalWebsiteAutoScheduleForm } from "./ExternalWebsiteAutoScheduleForm";
import { ExternalWebsiteSettingsForm } from "./ExternalWebsiteSettingsForm";
import { updateExternalWebsite } from "../../actions";
import type { ExternalWebsiteDetail } from "@/types/external-website.types";

async function getExternalWebsite(
  websiteId: string,
): Promise<ExternalWebsiteDetail | null> {
  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from("website_configs")
    .select(
      `id, website_name, external_slug, webhook_url,
       sync_on_publish, sync_on_update, sync_on_unpublish, sync_translations,
       brand_voice, industry, region, language,
       daily_article_limit, auto_schedule_enabled, schedule_type, schedule_interval_days`,
    )
    .eq("id", websiteId)
    .eq("website_type", "external")
    .single();

  if (error || !data) return null;

  return data as ExternalWebsiteDetail;
}

export default async function EditExternalWebsitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  if (!isAdminEmail(user.email)) {
    redirect(
      "/dashboard/websites?error=" + encodeURIComponent("您沒有權限訪問此頁面"),
    );
  }

  const { id } = await params;
  const website = await getExternalWebsite(id);

  if (!website) {
    redirect(
      "/dashboard/websites/external?error=" +
        encodeURIComponent("找不到該外部網站"),
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">編輯外部網站</h1>
        <p className="text-muted-foreground mt-2">
          設定外部網站的同步參數和文章生成設定
        </p>
      </div>

      <div className="grid gap-6">
        {/* 網站基本資訊卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>網站資訊</CardTitle>
            <CardDescription>修改外部網站的基本資訊</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateExternalWebsite} className="space-y-6">
              <input type="hidden" name="websiteId" value={website.id} />

              <div className="space-y-2">
                <Label htmlFor="name">網站名稱</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="外部網站名稱"
                  defaultValue={website.website_name || ""}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>識別碼</Label>
                <Input value={website.external_slug || ""} disabled />
                <p className="text-xs text-muted-foreground">識別碼無法修改</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhookUrl">Webhook URL</Label>
                <Input
                  id="webhookUrl"
                  name="webhookUrl"
                  type="url"
                  placeholder="https://example.com/api/webhooks/1wayseo"
                  defaultValue={website.webhook_url || ""}
                />
                <p className="text-xs text-muted-foreground">
                  文章發布時會發送 POST 請求到此 URL
                </p>
              </div>

              <div className="flex gap-4">
                <Button type="submit">儲存變更</Button>
                <Link href="/dashboard/websites/external">
                  <Button type="button" variant="outline">
                    取消
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* 同步設定 */}
        <ExternalWebsiteSyncForm
          websiteId={website.id}
          syncOnPublish={website.sync_on_publish}
          syncOnUpdate={website.sync_on_update}
          syncOnUnpublish={website.sync_on_unpublish}
          syncTranslations={website.sync_translations}
        />

        {/* 網站設定（行業、地區、語言） */}
        <ExternalWebsiteSettingsForm
          websiteId={website.id}
          industry={website.industry}
          region={website.region}
          language={website.language}
        />

        {/* 品牌聲音設定 */}
        <ExternalWebsiteBrandVoiceForm
          websiteId={website.id}
          brandVoice={website.brand_voice}
        />

        {/* 自動排程設定 */}
        <ExternalWebsiteAutoScheduleForm
          websiteId={website.id}
          dailyArticleLimit={website.daily_article_limit}
          autoScheduleEnabled={website.auto_schedule_enabled}
          scheduleType={website.schedule_type}
          scheduleIntervalDays={website.schedule_interval_days}
        />
      </div>
    </div>
  );
}
