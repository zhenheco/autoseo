"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createShoplineInvitation,
  createSupabaseShoplineInvitationStore,
  type ShoplineInvitation,
} from "@/lib/shopline/invitations";

const ADMIN_ROLES = ["owner", "admin"] as const;
const INVITATIONS_PATH = "/dashboard/admin/shopline-invitations";

export type ShoplineInvitationWithCompany = ShoplineInvitation & {
  companyName: string;
};

export type AdminCompanyOption = {
  id: string;
  name: string;
};

type AdminClient = ReturnType<typeof createAdminClient>;

type MembershipRow = {
  company_id: string;
  role: string;
};

type CompanyRow = {
  id: string;
  name: string | null;
};

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function baseSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://1wayseo.com").replace(
    /\/$/,
    "",
  );
}

function invitationLink(token: string): string {
  return `${baseSiteUrl()}/connect/shopline/${token}`;
}

function isAdminRole(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

async function requireAdminForCompany(
  admin: AdminClient,
  userId: string,
  companyId: string,
): Promise<boolean> {
  const { data: membership, error } = await admin
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (error || !membership) return false;

  return isAdminRole((membership as { role?: string | null }).role);
}

async function getAdminCompanyOptions(
  admin: AdminClient,
  userId: string,
): Promise<AdminCompanyOption[]> {
  const { data: memberships, error: membershipError } = await admin
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", [...ADMIN_ROLES]);

  if (membershipError || !memberships) return [];

  const companyIds = Array.from(
    new Set(
      (memberships as MembershipRow[])
        .filter((membership) => isAdminRole(membership.role))
        .map((membership) => membership.company_id)
        .filter(Boolean),
    ),
  );

  if (companyIds.length === 0) return [];

  const { data: companies, error: companiesError } = await admin
    .from("companies")
    .select("id, name")
    .in("id", companyIds)
    .order("name", { ascending: true });

  if (companiesError || !companies) return [];

  return (companies as CompanyRow[]).map((company) => ({
    id: company.id,
    name: company.name ?? company.id,
  }));
}

export async function listAdminCompaniesAction(): Promise<{
  companies: AdminCompanyOption[];
}> {
  const user = await getUser();
  if (!user) return { companies: [] };

  const admin = createAdminClient();
  const companies = await getAdminCompanyOptions(admin, user.id);

  return { companies };
}

export async function createInvitationAction(formData: FormData): Promise<
  | {
      ok: true;
      token: string;
      link: string;
      expiresAt: string;
    }
  | { ok: false; error: string }
> {
  const user = await getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const companyId = formString(formData, "companyId");
  if (!companyId) return { ok: false, error: "missing_company_id" };

  const admin = createAdminClient();
  const authorized = await requireAdminForCompany(admin, user.id, companyId);
  if (!authorized) return { ok: false, error: "unauthorized" };

  const store = createSupabaseShoplineInvitationStore(admin);

  try {
    const invitation = await createShoplineInvitation(store, {
      companyId,
      expectedShopHandle:
        formString(formData, "expectedShopHandle") ||
        formString(formData, "expected_shop_handle") ||
        undefined,
      note: formString(formData, "note") || undefined,
      ttlDays: 7,
      createdBy: user.id,
    });

    revalidatePath(INVITATIONS_PATH);

    return {
      ok: true,
      token: invitation.token,
      link: invitationLink(invitation.token),
      expiresAt: invitation.expiresAt,
    };
  } catch (error) {
    console.error("Failed to create SHOPLINE invitation:", error);
    return { ok: false, error: "create_failed" };
  }
}

export async function createInvitationFormAction(
  formData: FormData,
): Promise<void> {
  await createInvitationAction(formData);
}

export async function revokeInvitationAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const token = formString(formData, "token");
  if (!token) return { ok: false, error: "missing_token" };

  const admin = createAdminClient();
  const store = createSupabaseShoplineInvitationStore(admin);

  try {
    const invitation = await store.findByToken(token);
    if (!invitation) return { ok: false, error: "not_found" };

    const authorized = await requireAdminForCompany(
      admin,
      user.id,
      invitation.companyId,
    );
    if (!authorized) return { ok: false, error: "unauthorized" };

    await store.revoke(token);
    revalidatePath(INVITATIONS_PATH);

    return { ok: true };
  } catch (error) {
    console.error("Failed to revoke SHOPLINE invitation:", error);
    return { ok: false, error: "revoke_failed" };
  }
}

export async function revokeInvitationFormAction(
  formData: FormData,
): Promise<void> {
  await revokeInvitationAction(formData);
}

export async function listAllInvitationsAction(): Promise<{
  invitations: ShoplineInvitationWithCompany[];
}> {
  const user = await getUser();
  if (!user) return { invitations: [] };

  const admin = createAdminClient();
  const companies = await getAdminCompanyOptions(admin, user.id);
  if (companies.length === 0) return { invitations: [] };

  const companyNameById = new Map(
    companies.map((company) => [company.id, company.name]),
  );
  const store = createSupabaseShoplineInvitationStore(admin);
  const invitationGroups = await Promise.all(
    companies.map(async (company) => store.listByCompany(company.id)),
  );

  const invitations = invitationGroups
    .flat()
    .map((invitation) => ({
      ...invitation,
      companyName:
        companyNameById.get(invitation.companyId) ?? invitation.companyId,
    }))
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    );

  return { invitations };
}
