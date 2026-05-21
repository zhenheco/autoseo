import { getUser, getUserPrimaryCompany } from "@shared/auth";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";
import { createClient } from "@shared/supabase";
import { checkPagePermission } from "@shared/auth/permissions";
import { getTranslations } from "next-intl/server";
import { canUserManageCompanyBilling } from "@/lib/billing/customer-portal-access";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; info?: string }>;
}) {
  await checkPagePermission("canAccessSettings");

  const params = await searchParams;
  const user = await getUser();
  const t = await getTranslations("settings");

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

  const supabase = await createClient();
  const { data: currentMember } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", company.id)
    .eq("user_id", user.id)
    .single();

  if (!currentMember) {
    redirect("/dashboard");
  }

  const canManageSubscription = await canUserManageCompanyBilling(supabase, {
    companyId: company.id,
    userId: user.id,
  });

  return (
    <SettingsClient
      company={company}
      searchParams={params}
      canManageSubscription={canManageSubscription}
    />
  );
}
