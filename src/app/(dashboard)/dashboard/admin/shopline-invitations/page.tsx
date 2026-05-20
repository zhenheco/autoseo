import { redirect } from "next/navigation";
import { CalendarClock, LinkIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createInvitationFormAction,
  listAdminCompaniesAction,
  listAllInvitationsAction,
} from "./actions";
import { InvitationsTable } from "./_components/InvitationsTable";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://1wayseo.com").replace(
    /\/$/,
    "",
  );
}

export default async function ShoplineInvitationsAdminPage() {
  const [{ companies }, { invitations }] = await Promise.all([
    listAdminCompaniesAction(),
    listAllInvitationsAction(),
  ]);

  if (companies.length === 0) {
    redirect("/dashboard/unauthorized");
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          SHOPLINE 商家邀請連結
        </h1>
        <p className="text-sm text-muted-foreground">
          為新簽約商家產生 7 天有效的 SHOPLINE 授權入口。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            產生新邀請
          </CardTitle>
          <CardDescription>
            連結格式為 {siteUrl()}/connect/shopline/&lt;token&gt;
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={createInvitationFormAction}
            className="grid gap-5 md:grid-cols-2"
          >
            <div className="space-y-2">
              <Label htmlFor="companyId">公司</Label>
              <select
                id="companyId"
                name="companyId"
                required
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ttlDays">有效期限</Label>
              <div className="flex h-9 items-center gap-2 rounded-md border bg-muted px-3 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4" />7 天
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected_shop_handle">expected_shop_handle</Label>
              <Input
                id="expected_shop_handle"
                name="expected_shop_handle"
                placeholder="例如 demo-shop"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">note</Label>
              <Textarea
                id="note"
                name="note"
                placeholder="內部備註，可留空"
                className="min-h-9"
              />
            </div>

            <div className="md:col-span-2">
              <Button type="submit">
                <Plus className="h-4 w-4" />
                產生邀請
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>邀請列表</CardTitle>
          <CardDescription>
            僅顯示你擁有 owner/admin 權限公司的 SHOPLINE 邀請。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvitationsTable invitations={invitations} siteUrl={siteUrl()} />
        </CardContent>
      </Card>
    </div>
  );
}
