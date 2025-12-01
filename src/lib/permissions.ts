import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type UserRole = "owner" | "admin" | "editor" | "writer" | "viewer";

export interface RolePermissions {
  canAccessDashboard: boolean;
  canAccessArticles: boolean;
  canAccessWebsites: boolean;
  canAccessSubscription: boolean;
  canAccessSettings: boolean;
}

const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  owner: {
    canAccessDashboard: true,
    canAccessArticles: true,
    canAccessWebsites: true,
    canAccessSubscription: true,
    canAccessSettings: true,
  },
  admin: {
    canAccessDashboard: true,
    canAccessArticles: true,
    canAccessWebsites: true,
    canAccessSubscription: true,
    canAccessSettings: true,
  },
  editor: {
    canAccessDashboard: true,
    canAccessArticles: true,
    canAccessWebsites: true,
    canAccessSubscription: false,
    canAccessSettings: false,
  },
  writer: {
    canAccessDashboard: false,
    canAccessArticles: true,
    canAccessWebsites: true,
    canAccessSubscription: false,
    canAccessSettings: false,
  },
  viewer: {
    canAccessDashboard: false,
    canAccessArticles: true,
    canAccessWebsites: true,
    canAccessSubscription: false,
    canAccessSettings: false,
  },
};

export async function getUserRole(): Promise<UserRole | null> {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();

  const { data: allMemberships, error: allError } = await supabase
    .from("company_members")
    .select("role, status")
    .eq("user_id", user.id);

  if (allError || !allMemberships || allMemberships.length === 0) {
    console.error("[getUserRole] 查詢失敗或無記錄:", allError);
    return null;
  }

  const activeMembership = allMemberships.find((m) => m.status === "active");
  if (activeMembership) {
    return activeMembership.role as UserRole;
  }

  console.warn(
    "[getUserRole] 無 active 記錄，使用第一個記錄:",
    allMemberships[0],
  );
  return allMemberships[0].role as UserRole;
}

export async function checkPagePermission(
  page: keyof RolePermissions,
): Promise<void> {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const role = await getUserRole();

  if (!role) {
    if (page === "canAccessDashboard") {
      return;
    }
    redirect("/dashboard?error=no-company");
  }

  const permissions = ROLE_PERMISSIONS[role];

  if (!permissions[page]) {
    redirect("/dashboard/unauthorized");
  }
}

/**
 * 檢查用戶是否可以訪問網站連接功能
 * 開放給所有註冊用戶
 */
export async function canAccessWebsitesFeature(): Promise<boolean> {
  return true;
}

/**
 * 取得用戶的訂閱層級
 */
export async function getUserSubscriptionTier(): Promise<
  "free" | "starter" | "professional" | "business" | "agency" | null
> {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("company_members")
    .select("company_id, status")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) return null;

  const activeMembership = memberships.find((m) => m.status === "active");
  const membership = activeMembership || memberships[0];

  const { data: companies } = await supabase
    .from("companies")
    .select("subscription_tier")
    .eq("id", membership.company_id);

  if (!companies || companies.length === 0) return null;

  return companies[0].subscription_tier || null;
}
