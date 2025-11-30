import { getUser, getUserPrimaryCompany } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";
import { createClient } from "@/lib/supabase/server";
import { checkPagePermission } from "@/lib/permissions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; info?: string }>;
}) {
  await checkPagePermission("canAccessSettings");

  const params = await searchParams;
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

  return <SettingsClient company={company} searchParams={params} />;
}
