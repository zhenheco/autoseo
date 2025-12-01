import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const SUPER_ADMIN_EMAILS =
  process.env.SUPER_ADMIN_EMAILS?.split(",").map((e) => e.trim()) || [];

export function isSuperAdmin(email: string | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function requireSuperAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!isSuperAdmin(user.email)) {
    redirect("/dashboard");
  }

  return { user };
}

export async function requireOwnerRole() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership, error } = await supabase
    .from("company_members")
    .select("role, company_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (error || !membership || membership.role !== "owner") {
    redirect("/dashboard");
  }

  return { user, companyId: membership.company_id };
}
