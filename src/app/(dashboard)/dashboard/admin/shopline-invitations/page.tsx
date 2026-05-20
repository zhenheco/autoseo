import { redirect } from "next/navigation";
import { CalendarClock, LinkIcon, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("admin.shoplineInvitations");
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
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            {t("createForm.title")}
          </CardTitle>
          <CardDescription>
            {t("createForm.linkFormat", {
              url: siteUrl(),
              tokenPlaceholder: "<token>",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={createInvitationFormAction}
            className="grid gap-5 md:grid-cols-2"
          >
            <div className="space-y-2">
              <Label htmlFor="companyId">{t("createForm.companyLabel")}</Label>
              <select
                id="companyId"
                name="companyId"
                aria-label={t("createForm.companyPlaceholder")}
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
              <Label htmlFor="ttlDays">{t("createForm.ttlHint")}</Label>
              <div className="flex h-9 items-center gap-2 rounded-md border bg-muted px-3 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4" />
                {t("createForm.ttlHint")}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected_shop_handle">
                {t("createForm.expectedShopHandleLabel")}
              </Label>
              <Input
                id="expected_shop_handle"
                name="expected_shop_handle"
                placeholder={t("createForm.expectedShopHandlePlaceholder")}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">{t("createForm.noteLabel")}</Label>
              <Textarea
                id="note"
                name="note"
                placeholder={t("createForm.notePlaceholder")}
                className="min-h-9"
              />
            </div>

            <div className="md:col-span-2">
              <Button type="submit">
                <Plus className="h-4 w-4" />
                {t("createForm.submitButton")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("list.title")}</CardTitle>
          <CardDescription>{t("list.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <InvitationsTable invitations={invitations} siteUrl={siteUrl()} />
        </CardContent>
      </Card>
    </div>
  );
}
