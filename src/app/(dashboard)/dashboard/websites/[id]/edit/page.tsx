import { getUser, getUserPrimaryCompany } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
import { updateWebsite } from "../../actions";
import { BrandVoiceForm } from "./BrandVoiceForm";
import { WebsiteSettingsForm } from "./WebsiteSettingsForm";
import { AutoScheduleForm } from "./AutoScheduleForm";
import { getTranslations } from "next-intl/server";

interface BrandVoice {
  brand_name?: string;
  tone_of_voice?: string;
  target_audience?: string;
  writing_style?: string;
}

async function getWebsite(websiteId: string, companyId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("website_configs")
    .select(
      "id, website_name, wordpress_url, wp_username, company_id, brand_voice, industry, region, language, daily_article_limit, auto_schedule_enabled, schedule_type, schedule_interval_days, is_platform_blog",
    )
    .eq("id", websiteId)
    .eq("company_id", companyId)
    .single();

  if (error) throw error;

  return data as {
    id: string;
    website_name: string | null;
    wordpress_url: string | null;
    wp_username: string | null;
    company_id: string;
    brand_voice: BrandVoice | null;
    industry: string | null;
    region: string | null;
    language: string | null;
    daily_article_limit: number | null;
    auto_schedule_enabled: boolean | null;
    schedule_type: "daily" | "interval" | null;
    schedule_interval_days: number | null;
    is_platform_blog: boolean | null;
  };
}

export default async function EditWebsitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("websites");
  const tCommon = await getTranslations("common");
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const company = await getUserPrimaryCompany(user.id);

  if (!company) {
    return (
      <div className="container mx-auto p-8">
        <p className="text-muted-foreground">{t("noCompanyJoined")}</p>
      </div>
    );
  }

  const { id } = await params;
  const website = await getWebsite(id, company.id);

  if (!website) {
    redirect(
      "/dashboard/websites?error=" +
        encodeURIComponent(t("edit.notFoundError")),
    );
  }

  // 判斷網站類型並取得對應的頁面資訊
  const isPlatformBlog = website.is_platform_blog === true;

  // 根據網站類型設定頁面資訊
  const pageTitle = isPlatformBlog
    ? t("edit.editPlatformBlog")
    : t("edit.editWordPressSite");
  const pageDescription = isPlatformBlog
    ? t("edit.platformBlogDescription")
    : t("edit.wordPressDescription");

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{pageTitle}</h1>
        <p className="text-muted-foreground mt-2">{pageDescription}</p>
      </div>

      <div className="grid gap-6">
        {/* 網站基本資訊卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>{t("edit.websiteInfo")}</CardTitle>
            <CardDescription>
              {t("edit.websiteInfoDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateWebsite} className="space-y-6">
              <input type="hidden" name="websiteId" value={website.id} />
              <input type="hidden" name="companyId" value={company.id} />

              <div className="space-y-2">
                <Label htmlFor="site-name">{t("edit.websiteNameLabel")}</Label>
                <Input
                  id="site-name"
                  name="siteName"
                  placeholder={t("edit.websiteNamePlaceholder")}
                  defaultValue={website.website_name || ""}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t("edit.websiteNameHint")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="site-url">{t("edit.websiteUrlLabel")}</Label>
                <Input
                  id="site-url"
                  name="siteUrl"
                  type="url"
                  placeholder={t("edit.websiteUrlPlaceholder")}
                  defaultValue={website.wordpress_url || ""}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t("edit.websiteUrlHint")}
                </p>
              </div>

              {/* WordPress 認證欄位 - Platform Blog 不需要 */}
              {!isPlatformBlog && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="wp-username">
                      {t("edit.wpUsernameLabel")}
                    </Label>
                    <Input
                      id="wp-username"
                      name="wpUsername"
                      placeholder={t("edit.wpUsernamePlaceholder")}
                      defaultValue={website.wp_username || ""}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wp-password">
                      {t("edit.wpPasswordLabel")}
                    </Label>
                    <Input
                      id="wp-password"
                      name="wpPassword"
                      type="password"
                      placeholder={t("edit.wpPasswordPlaceholder")}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("edit.wpPasswordHint")}
                    </p>
                  </div>
                </>
              )}

              <div className="flex gap-4">
                <Button type="submit">{t("edit.saveChanges")}</Button>
                <Link href="/dashboard/websites">
                  <Button type="button" variant="outline">
                    {tCommon("cancel")}
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* 網站設定（行業、地區、語言）- 所有網站類型都顯示 */}
        <WebsiteSettingsForm
          websiteId={website.id}
          industry={website.industry}
          region={website.region}
          language={website.language}
        />

        {/* 品牌聲音設定 - 所有網站類型都顯示 */}
        <BrandVoiceForm
          websiteId={website.id}
          brandVoice={website.brand_voice}
        />

        {/* 自動排程設定 - 所有網站類型都顯示 */}
        <AutoScheduleForm
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
