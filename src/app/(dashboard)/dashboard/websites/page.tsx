import { getUser, getUserPrimaryCompany } from "@/lib/auth";
import { Database } from "@/types/database.types";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type WebsiteConfig = Database["public"]["Tables"]["website_configs"]["Row"];
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { deleteWebsite, createPlatformBlog } from "./actions";
import { checkPagePermission } from "@/lib/permissions";
import { WebsiteStatusToggle } from "./website-status-toggle";
import { Globe, ExternalLink } from "lucide-react";

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

  const company = await getUserPrimaryCompany(user.id);

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
  const params = await searchParams;

  return (
    <div className="container mx-auto p-8">
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
                <h3 className="font-semibold">建立官方 Blog</h3>
                <p className="text-sm text-muted-foreground">
                  建立平台官方 Blog，展示 AI 生成文章並獲取 SEO 流量
                </p>
              </div>
            </div>
            <form action={createPlatformBlog}>
              <input type="hidden" name="companyId" value={company.id} />
              <Button type="submit" variant="default">
                <Globe className="h-4 w-4 mr-2" />
                建立官方 Blog
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 網站列表 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {websites && websites.length > 0 ? (
          websites.map((website: WebsiteConfig) => (
            <Card
              key={website.id}
              className={`hover:shadow-lg transition-shadow ${
                website.is_platform_blog
                  ? "border-primary/50 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30"
                  : ""
              }`}
            >
              <Link href={`/dashboard/websites/${website.id}`}>
                <CardHeader className="cursor-pointer">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {website.website_name}
                    </CardTitle>
                    {website.is_platform_blog && (
                      <Badge
                        variant="default"
                        className="bg-gradient-to-r from-blue-600 to-purple-600"
                      >
                        官方 Blog
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="break-all">
                    {website.is_platform_blog ? (
                      <a
                        href="/blog"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        /blog
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      website.wordpress_url
                    )}
                  </CardDescription>
                </CardHeader>
              </Link>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {t("status")}
                    </span>
                    <WebsiteStatusToggle
                      websiteId={website.id}
                      initialStatus={website.is_active ?? true}
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Link
                      href={`/dashboard/websites/${website.id}`}
                      className="flex-1"
                    >
                      <Button variant="default" size="sm" className="w-full">
                        {t("viewArticles")}
                      </Button>
                    </Link>
                    <Link href={`/dashboard/websites/${website.id}/edit`}>
                      <Button variant="outline" size="sm">
                        {tCommon("edit")}
                      </Button>
                    </Link>
                    {!website.is_platform_blog && (
                      <form action={deleteWebsite} className="inline">
                        <input
                          type="hidden"
                          name="websiteId"
                          value={website.id}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          type="submit"
                          className="text-destructive hover:text-destructive"
                        >
                          {tCommon("delete")}
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground mb-4">{t("noWebsites")}</p>
                <Link href="/dashboard/websites/new">
                  <Button>{t("addFirstWebsite")}</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
