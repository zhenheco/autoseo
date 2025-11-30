import { getUser, getUserPrimaryCompany } from "@/lib/auth";
import { redirect } from "next/navigation";
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
import { createWebsite } from "./actions";

export default async function NewWebsitePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
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

  const params = await searchParams;

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">新增 WordPress 網站</h1>
        <p className="text-slate-400 mt-2">
          連接您的 WordPress 網站以開始自動發布文章
        </p>
      </div>

      {/* 錯誤訊息顯示 */}
      {params.error && (
        <div className="mb-6 rounded-md bg-red-500/15 border border-red-500/30 p-4 text-sm text-red-400">
          {params.error}
        </div>
      )}

      <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">網站資訊</CardTitle>
          <CardDescription className="text-slate-400">
            請輸入您的 WordPress 網站資訊。您需要使用 WordPress
            應用密碼進行驗證。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createWebsite} className="space-y-6">
            <input type="hidden" name="companyId" value={company.id} />

            <div className="space-y-2">
              <Label htmlFor="site-name" className="text-slate-300">
                網站名稱
              </Label>
              <Input
                id="site-name"
                name="siteName"
                placeholder="我的部落格"
                required
                className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-500">
                為您的網站取一個容易辨識的名稱
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="site-url" className="text-slate-300">
                網站 URL
              </Label>
              <Input
                id="site-url"
                name="siteUrl"
                type="url"
                placeholder="https://your-blog.com"
                required
                className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-500">
                您的 WordPress 網站完整網址（包含 https://）
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wp-username" className="text-slate-300">
                WordPress 使用者名稱
              </Label>
              <Input
                id="wp-username"
                name="wpUsername"
                placeholder="admin"
                required
                className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wp-password" className="text-slate-300">
                WordPress 應用密碼
              </Label>
              <Input
                id="wp-password"
                name="wpPassword"
                type="password"
                placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                required
                className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-500">
                請至 WordPress 後台 → 使用者 → 個人資料 → 應用程式密碼
                建立新的應用密碼
              </p>
            </div>

            <div className="flex gap-4">
              <Button type="submit">新增網站</Button>
              <Link href="/dashboard/websites">
                <Button type="button" variant="outline">
                  取消
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
