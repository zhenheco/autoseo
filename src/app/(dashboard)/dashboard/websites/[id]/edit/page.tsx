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
      "id, website_name, wordpress_url, wp_username, company_id, brand_voice",
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
  };
}

export default async function EditWebsitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const { id } = await params;
  const website = await getWebsite(id, company.id);

  if (!website) {
    redirect("/dashboard/websites?error=" + encodeURIComponent("找不到該網站"));
  }

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">編輯 WordPress 網站</h1>
        <p className="text-muted-foreground mt-2">
          更新您的 WordPress 網站設定
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>網站資訊</CardTitle>
            <CardDescription>
              修改您的 WordPress 網站資訊。留空密碼欄位表示不更改密碼。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateWebsite} className="space-y-6">
              <input type="hidden" name="websiteId" value={website.id} />
              <input type="hidden" name="companyId" value={company.id} />

              <div className="space-y-2">
                <Label htmlFor="site-name">網站名稱</Label>
                <Input
                  id="site-name"
                  name="siteName"
                  placeholder="我的部落格"
                  defaultValue={website.website_name || ""}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  為您的網站取一個容易辨識的名稱
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="site-url">網站 URL</Label>
                <Input
                  id="site-url"
                  name="siteUrl"
                  type="url"
                  placeholder="https://your-blog.com"
                  defaultValue={website.wordpress_url || ""}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  您的 WordPress 網站完整網址（包含 https://）
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wp-username">WordPress 使用者名稱</Label>
                <Input
                  id="wp-username"
                  name="wpUsername"
                  placeholder="admin"
                  defaultValue={website.wp_username || ""}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wp-password">WordPress 應用密碼</Label>
                <Input
                  id="wp-password"
                  name="wpPassword"
                  type="password"
                  placeholder="留空表示不更改"
                />
                <p className="text-xs text-muted-foreground">
                  請至 WordPress 後台 → 使用者 → 個人資料 → 應用程式密碼
                  建立新的應用密碼。留空表示不更改現有密碼。
                </p>
              </div>

              <div className="flex gap-4">
                <Button type="submit">儲存變更</Button>
                <Link href="/dashboard/websites">
                  <Button type="button" variant="outline">
                    取消
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <BrandVoiceForm
          websiteId={website.id}
          brandVoice={website.brand_voice}
        />
      </div>
    </div>
  );
}
