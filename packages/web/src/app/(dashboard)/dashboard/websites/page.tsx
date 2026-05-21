import { getUser, getUserPrimaryCompany } from "@shared/auth";
import { Database } from "@/types/database.types";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@shared/supabase";
import { createAdminClient } from "@shared/supabase";
import {
  createSupabaseShoplineConnectionStore,
  getShoplineConnectionStatus,
} from "@/lib/shopline/connections";

type WebsiteConfig = Database["public"]["Tables"]["website_configs"]["Row"];
import { Card, CardContent } from "@shared/ui/card";
import { Button } from "@shared/ui/button";
import Link from "next/link";
import { deleteWebsite, createPlatformBlog } from "./actions";
import { checkPagePermission } from "@shared/auth/permissions";
import { WebsiteAddedTracker } from "./WebsiteAddedTracker";
import { Globe } from "lucide-react";
import { WebsiteCard } from "./_components/WebsiteCard";
import { EmptyState } from "@/components/ui/empty-state";

async function getCompanyWebsites(companyId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("website_configs")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch websites:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Unexpected error in getCompanyWebsites:", err);
    return [];
  }
}

/**
 * 檢查是否已存在官方 Blog（全域檢查）
 */
async function checkPlatformBlogExists() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("website_configs")
      .select("id")
      .eq("is_platform_blog", true)
      .maybeSingle();

    if (error) {
      console.error("Error checking platform blog:", error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error("Unexpected error in checkPlatformBlogExists:", err);
    return false;
  }
}

async function getShoplineConnectionStatuses(
  companyId: string,
  websites: WebsiteConfig[],
) {
  const statuses = new Map<string, boolean>();
  if (websites.length === 0) return statuses;

  const store = createSupabaseShoplineConnectionStore(createAdminClient());
  const results = await Promise.all(
    websites.map(async (website) => {
      try {
        const status = await getShoplineConnectionStatus(store, {
          companyId,
          websiteId: website.id,
        });
        return [website.id, status.connected] as const;
      } catch (error) {
        console.error(
          "[SHOPLINE Status] Failed to load website connection status:",
          error,
        );
        return [website.id, false] as const;
      }
    }),
  );

  for (const [websiteId, connected] of results) {
    statuses.set(websiteId, connected);
  }

  return statuses;
}

export default async function WebsitesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await checkPagePermission("canAccessWebsites");

  const t = await getTranslations("websites");
  const tCommon = await getTranslations("common");
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  let company = null;
  try {
    company = await getUserPrimaryCompany(user.id);
  } catch (err) {
    console.error("Error fetching user company:", err);
  }

  if (!company) {
    return (
      <div className="container mx-auto p-8">
        <p className="text-muted-foreground">{t("noCompanyJoined")}</p>
      </div>
    );
  }

  const [websites, platformBlogExists] = await Promise.all([
    getCompanyWebsites(company.id),
    checkPlatformBlogExists(),
  ]);
  const shoplineConnectionStatuses = await getShoplineConnectionStatuses(
    company.id,
    websites,
  );
  const params = await searchParams;
  const websiteCardLabels = {
    autoSchedule: t("autoSchedule.autoScheduleLabel"),
    platformBlog: t("platformBlog"),
    seoEditButton: t("shopline.seoEditButton"),
    status: t("status"),
    viewArticles: t("viewArticles"),
    edit: tCommon("edit"),
    delete: tCommon("delete"),
  };

  return (
    <div className="container mx-auto p-8">
      {/* GA4 追蹤：網站添加成功 */}
      <WebsiteAddedTracker success={params.success} />

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground mt-2">{t("manageDescription")}</p>
        </div>
        <Link href="/dashboard/websites/new">
          <Button>{t("addWebsite")}</Button>
        </Link>
      </div>

      {/* 訊息顯示 */}
      {params.error && (
        <div className="mb-6 rounded-md bg-destructive/15 p-4 text-sm text-destructive">
          {params.error}
        </div>
      )}
      {params.success && (
        <div className="mb-6 rounded-md bg-green-500/15 p-4 text-sm text-green-700">
          {params.success}
        </div>
      )}

      {/* 官方 Blog 提示區（如果全域還沒有建立） */}
      {!platformBlogExists && (
        <Card className="mb-6 border-dashed border-2 border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Globe className="h-8 w-8 text-primary" />
              <div>
                <h3 className="font-semibold">{t("createPlatformBlog")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("createPlatformBlogDesc")}
                </p>
              </div>
            </div>
            <form action={createPlatformBlog}>
              <input type="hidden" name="companyId" value={company.id} />
              <Button type="submit" variant="default">
                <Globe className="h-4 w-4 mr-2" />
                {t("createPlatformBlog")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* WordPress 網站列表 */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-muted-foreground">
          {t("wordpressSites")}
        </h2>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {websites && websites.length > 0 ? (
          websites.map((website: WebsiteConfig) => (
            <WebsiteCard
              key={website.id}
              website={website}
              labels={websiteCardLabels}
              shoplineConnected={
                shoplineConnectionStatuses.get(website.id) ?? false
              }
              deleteWebsiteAction={deleteWebsite}
            />
          ))
        ) : (
          <div className="col-span-full">
            <EmptyState
              icon={<Globe className="h-6 w-6" />}
              title={t("noWebsites")}
              action={{
                label: t("addFirstWebsite"),
                href: "/dashboard/websites/new",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
