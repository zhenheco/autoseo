import { createAdminClient, createClient } from "@shared/supabase";
import { cookies } from "next/headers";
import { syncUserToBrevo } from "@/lib/brevo";
import { trackRegistration } from "@/lib/affiliate-client";

export {
  getUser,
  getUserCompanies,
  getUserPrimaryCompany,
  type UserCompany,
  type UserCompanyMembership,
} from "@shared/auth";

function generateSlug(email: string): string {
  const username = email.split("@")[0];
  const random = Math.random().toString(36).substring(2, 8);
  return `${username}-${random}`;
}

export async function signUp(email: string, password: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://1wayseo.com"}/auth/confirm`,
    },
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error("註冊失敗");

  if (authData.user.identities && authData.user.identities.length === 0) {
    throw new Error("User already registered");
  }

  console.log("[註冊] Step 1 完成: 使用者帳號建立成功", authData.user.id);

  const { data: company, error: companyError } = await adminClient
    .from("companies")
    .insert({
      name: `${email.split("@")[0]} 的公司`,
      slug: generateSlug(email),
      owner_id: authData.user.id,
      subscription_tier: "free",
    })
    .select()
    .single();

  if (companyError) {
    console.error("[註冊失敗] Step 2: 建立公司失敗", companyError);
    throw companyError;
  }
  console.log("[註冊] Step 2 完成: 公司建立成功", company.id);

  const { error: memberError } = await adminClient
    .from("company_members")
    .insert({
      company_id: company.id,
      user_id: authData.user.id,
      role: "owner",
      status: "active",
      joined_at: new Date().toISOString(),
    });

  if (memberError) {
    console.error("[註冊失敗] Step 3: 新增成員記錄失敗", memberError);
    throw memberError;
  }
  console.log("[註冊] Step 3 完成: 成員記錄建立成功");

  console.log("[註冊] Step 4: 查詢免費方案...");
  const { data: freePlan, error: planError } = await adminClient
    .from("subscription_plans")
    .select("id, base_tokens, articles_per_month")
    .eq("slug", "free")
    .single();

  if (planError || !freePlan) {
    console.error("[註冊失敗] Step 4: 無法取得免費方案", {
      planError,
      freePlan,
    });
    throw new Error("免費方案設定錯誤");
  }
  console.log("[註冊] Step 4 完成: 免費方案查詢成功", freePlan);

  const freeArticles =
    (freePlan as unknown as { articles_per_month: number | null })
      .articles_per_month || 3;
  const { error: subscriptionError } = await adminClient
    .from("company_subscriptions")
    .insert({
      company_id: company.id,
      plan_id: freePlan.id,
      status: "active",
      monthly_token_quota: 0,
      monthly_quota_balance: 0,
      purchased_token_balance: 0,
      subscription_articles_remaining: freeArticles,
      purchased_articles_remaining: 0,
      articles_per_month: 0,
      lifetime_free_articles_limit: freeArticles,
      current_period_start: null,
      current_period_end: null,
      is_lifetime: false,
      lifetime_discount: 1.0,
    });

  if (subscriptionError) {
    console.error("[註冊失敗] Step 5: 建立訂閱失敗", subscriptionError);
    throw subscriptionError;
  }
  console.log("[註冊] Step 5 完成: 訂閱建立成功");

  const cookieStore = await cookies();
  const affiliateRef = cookieStore.get("affiliate_ref")?.value;

  if (affiliateRef) {
    trackRegistration({
      referralCode: affiliateRef,
      referredUserId: authData.user.id,
      referredUserEmail: email,
    }).catch((err) => console.error("[註冊] Affiliate 追蹤失敗:", err));

    console.log("[註冊] Step 6 完成: Affiliate 追蹤已觸發");
  }

  await adminClient.from("subscriptions").insert({
    company_id: company.id,
    plan_name: "free",
    status: "active",
    monthly_article_limit: 5,
    articles_used_this_month: 0,
    current_period_start: new Date().toISOString(),
    current_period_end: null,
  });

  syncUserToBrevo(authData.user.id).catch((error) => {
    console.error("[註冊] Brevo 同步失敗（不影響註冊）:", error);
  });
  console.log("[註冊] Step 8: Brevo 同步已觸發");

  return { user: authData.user, company };
}

export async function signIn(email: string, password: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  const cookieStore = await cookies();
  const affiliateRef = cookieStore.get("affiliate_ref")?.value;

  console.log("[SignIn Affiliate] 診斷資訊:", {
    userId: data.user?.id,
    userEmail: email,
    affiliateRef: affiliateRef || "(無)",
    hasRef: !!affiliateRef,
  });

  if (affiliateRef && data.user) {
    try {
      const result = await trackRegistration({
        referralCode: affiliateRef,
        referredUserId: data.user.id,
        referredUserEmail: email,
      });
      console.log("[SignIn Affiliate] 追蹤成功:", {
        success: !!result,
        referralId: result?.referralId || null,
      });
    } catch (err) {
      console.error("[SignIn Affiliate] 追蹤失敗:", err);
    }
  } else {
    console.log("[SignIn Affiliate] 無推薦碼或無用戶，跳過追蹤");
  }

  return data;
}

export async function signOut() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) throw error;
}

export async function getCompanyMembers(companyId: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: members, error } = await supabase
    .from("company_members")
    .select("id, user_id, role, status, joined_at")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("joined_at", { ascending: false });

  if (error) throw error;

  if (!members) return [];

  const {
    data: { users },
    error: usersError,
  } = await adminClient.auth.admin.listUsers();

  if (usersError) {
    console.error("獲取使用者資料失敗:", usersError);
    return members.map((member) => ({
      ...member,
      users: null,
    }));
  }

  return members.map((member) => {
    const user = users?.find((u: { id: string }) => u.id === member.user_id);
    return {
      ...member,
      users: user
        ? {
            id: user.id,
            email: user.email || "",
          }
        : null,
    };
  });
}
