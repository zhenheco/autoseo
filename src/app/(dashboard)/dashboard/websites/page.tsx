import { getUser, getUserPrimaryCompany } from "@/lib/auth";
import { Database } from "@/types/database.types";

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
import Link from "next/link";
import { deleteWebsite } from "./actions";
import { checkPagePermission } from "@/lib/permissions";
import { WebsiteStatusToggle } from "./website-status-toggle";

async function getCompanyWebsites(companyId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("website_configs")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}

export default async function WebsitesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await checkPagePermission("canAccessWebsites");

  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const company = await getUserPrimaryCompany(user.id);

  if (!company) {
    return (
      <div className="container mx-auto p-8">
        <p className="text-muted-foreground">您尚未加入任何公司</p>
      </div>
    );
  }

  const websites = await getCompanyWebsites(company.id);
  const params = await searchParams;

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">網站管理</h1>
          <p className="text-muted-foreground mt-2">
            管理您的 WordPress 網站設定
          </p>
        </div>
        <Link href="/dashboard/websites/new">
          <Button>新增網站</Button>
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

      {/* 網站列表 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {websites && websites.length > 0 ? (
          websites.map((website: WebsiteConfig) => (
            <Card
              key={website.id}
              className="hover:shadow-lg transition-shadow"
            >
              <Link href={`/dashboard/websites/${website.id}`}>
                <CardHeader className="cursor-pointer">
                  <CardTitle className="text-lg">
                    {website.website_name}
                  </CardTitle>
                  <CardDescription className="break-all">
                    {website.wordpress_url}
                  </CardDescription>
                </CardHeader>
              </Link>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">狀態</span>
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
                        查看文章
                      </Button>
                    </Link>
                    <Link href={`/dashboard/websites/${website.id}/edit`}>
                      <Button variant="outline" size="sm">
                        編輯
                      </Button>
                    </Link>
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
                        刪除
                      </Button>
                    </form>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground mb-4">尚未新增任何網站</p>
                <Link href="/dashboard/websites/new">
                  <Button>新增第一個網站</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
