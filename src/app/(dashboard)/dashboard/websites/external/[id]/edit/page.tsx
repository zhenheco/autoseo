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
import { getTranslations } from "next-intl/server";

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
  const t = await getTranslations("externalWebsites");
  const tCommon = await getTranslations("common");

  if (!user) {
    redirect("/login");
  }

  if (!isAdminEmail(user.email)) {
    redirect(
      "/dashboard/websites?error=" + encodeURIComponent(t("noPermission")),
    );
  }

  const { id } = await params;
  const website = await getExternalWebsite(id);

  if (!website) {
    redirect(
      "/dashboard/websites/external?error=" +
        encodeURIComponent(t("websiteNotFound")),
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("editTitle")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("editDescription")}
        </p>
      </div>

      <div className="grid gap-6">
        {/* 網站基本資訊卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>{t("websiteInfo")}</CardTitle>
            <CardDescription>{t("websiteInfoDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateExternalWebsite} className="space-y-6">
              <input type="hidden" name="websiteId" value={website.id} />

              <div className="space-y-2">
                <Label htmlFor="name">{t("websiteName")}</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder={t("websiteNamePlaceholder")}
                  defaultValue={website.website_name || ""}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>{t("slug")}</Label>
                <Input value={website.external_slug || ""} disabled />
                <p className="text-xs text-muted-foreground">{t("slugHint")}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhookUrl">{t("webhookUrl")}</Label>
                <Input
                  id="webhookUrl"
                  name="webhookUrl"
                  type="url"
                  placeholder="https://example.com/api/webhooks/1wayseo"
                  defaultValue={website.webhook_url || ""}
                />
                <p className="text-xs text-muted-foreground">
                  {t("webhookUrlHint")}
                </p>
              </div>

              <div className="flex gap-4">
                <Button type="submit">{tCommon("save")}</Button>
                <Link href="/dashboard/websites/external">
                  <Button type="button" variant="outline">
                    {tCommon("cancel")}
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
