import { redirect } from "next/navigation";
import { LinkIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listAdminCompaniesAction, listAllInvitationsAction } from "./actions";
import { CreateInvitationForm } from "./_components/CreateInvitationForm";
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
            {t("fromUrl.title")}
          </CardTitle>
          <CardDescription>
            {t("createForm.linkFormat", {
              url: siteUrl(),
              tokenPlaceholder: "<token>",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateInvitationForm companies={companies} />
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
