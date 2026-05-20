import { createClient } from "../supabase";

export type UserCompany = {
  id: string;
  name: string;
  slug?: string | null;
  owner_id?: string | null;
  subscription_tier?:
    | "free"
    | "starter"
    | "pro"
    | "professional"
    | "business"
    | "agency"
    | null;
  [key: string]: unknown;
};

export type UserCompanyMembership = {
  companies: UserCompany | null;
  role: string | null;
  status: string | null;
  [key: string]: unknown;
};

function isUserCompany(value: unknown): value is UserCompany {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string"
  );
}

function toUserCompanyMembership(value: unknown): UserCompanyMembership | null {
  if (typeof value !== "object" || value === null) return null;

  const row = value as Record<string, unknown>;
  const companies = isUserCompany(row.companies) ? row.companies : null;

  return {
    ...row,
    companies,
    role: typeof row.role === "string" ? row.role : null,
    status: typeof row.status === "string" ? row.status : null,
  };
}

export async function getUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function getUserCompanies(
  userId: string,
): Promise<UserCompanyMembership[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("company_members")
    .select("companies(*), role, status")
    .eq("user_id", userId);

  if (error) throw error;

  const memberships = Array.isArray(data)
    ? data
        .map((membership) => toUserCompanyMembership(membership))
        .filter((membership): membership is UserCompanyMembership => !!membership)
    : [];

  if (memberships.length === 0) return [];

  const activeMembers = memberships.filter(
    (membership) => membership.status === "active",
  );
  return activeMembers.length > 0 ? activeMembers : memberships;
}

export async function getUserPrimaryCompany(
  userId: string,
): Promise<UserCompany | null> {
  const companyMembers = await getUserCompanies(userId);
  if (companyMembers.length === 0) return null;

  return companyMembers[0]?.companies ?? null;
}
