import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Users,
  Gift,
  Link as LinkIcon,
  TrendingUp,
  MousePointerClick,
} from "lucide-react";
import { ReferralLinkCard } from "@/components/referrals/ReferralLinkCard";
import { ReferralHistoryTable } from "@/components/referrals/ReferralHistoryTable";
import { REFERRAL_TOKEN_REWARD } from "@/types/referral.types";

export default async function ReferralsPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) {
    redirect("/dashboard");
  }

  let { data: referralCode } = await supabase
    .from("referral_codes")
    .select("*")
    .eq("company_id", membership.company_id)
    .single();

  if (!referralCode) {
    const { generateReferralCode } = await import("@/lib/referral-service");
    const newCode = await generateReferralCode(membership.company_id);
    if (newCode) {
      referralCode = { ...newCode, code: newCode.referral_code };
    }
  }

  const { data: referrals } = await supabase
    .from("referrals")
    .select("status")
    .eq("referrer_company_id", membership.company_id);

  const pendingReferrals =
    referrals?.filter((r) => r.status === "pending").length || 0;
  const qualifiedReferrals =
    referrals?.filter(
      (r) => r.status === "qualified" || r.status === "rewarded",
    ).length || 0;
  const totalReferrals = referrals?.length || 0;

  const { data: referralHistory } = await supabase
    .from("referrals")
    .select("*")
    .eq("referrer_company_id", membership.company_id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: tokenRewards } = await supabase
    .from("referral_token_rewards")
    .select("referrer_tokens")
    .eq("referrer_company_id", membership.company_id)
    .not("referrer_credited_at", "is", null);

  const totalRewardTokens =
    tokenRewards?.reduce((sum, r) => sum + (r.referrer_tokens || 0), 0) || 0;

  const { data: myReferrer } = await supabase
    .from("referrals")
    .select("referral_code, status")
    .eq("referred_company_id", membership.company_id)
    .single();

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">好友推薦計畫</h1>
        <p className="text-muted-foreground mt-2">
          分享您的推薦連結，朋友註冊並付款後，雙方都將獲得{" "}
          {REFERRAL_TOKEN_REWARD.toLocaleString()} tokens 獎勵
        </p>
      </div>

      {myReferrer && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">您的推薦人</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              推薦碼：
              <span className="font-mono font-bold">
                {myReferrer.referral_code}
              </span>
              {myReferrer.status === "pending" && (
                <span className="ml-2 text-orange-600">
                  （首次付款後雙方獲得獎勵）
                </span>
              )}
              {myReferrer.status === "rewarded" && (
                <span className="ml-2 text-green-600">
                  ✓ 已獲得 {REFERRAL_TOKEN_REWARD.toLocaleString()} tokens
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {referralCode && <ReferralLinkCard referralCode={referralCode.code} />}

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">連結點擊</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {referralCode?.total_clicks || 0}
            </div>
            <p className="text-xs text-muted-foreground">累計點擊次數</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">總推薦數</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReferrals}</div>
            <p className="text-xs text-muted-foreground">累計推薦朋友數</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">成功推薦</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {qualifiedReferrals}
            </div>
            <p className="text-xs text-muted-foreground">已付款並獲得獎勵</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">累計獎勵</CardTitle>
            <Gift className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {totalRewardTokens.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">tokens 獎勵總額</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>推薦記錄</CardTitle>
          <CardDescription>查看您的推薦朋友和獎勵狀態</CardDescription>
        </CardHeader>
        <CardContent>
          {referralHistory && referralHistory.length > 0 ? (
            <ReferralHistoryTable referrals={referralHistory} />
          ) : (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">還沒有推薦記錄</h3>
              <p className="text-sm text-muted-foreground mt-2">
                分享您的推薦連結，開始賺取獎勵吧！
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>獎勵規則</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              1
            </div>
            <div>
              <h4 className="font-semibold">分享推薦連結</h4>
              <p className="text-sm text-muted-foreground">
                複製您的專屬推薦連結，分享給朋友
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              2
            </div>
            <div>
              <h4 className="font-semibold">朋友註冊帳號</h4>
              <p className="text-sm text-muted-foreground">
                朋友通過您的連結註冊，系統會自動記錄推薦關係
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 font-bold">
              3
            </div>
            <div>
              <h4 className="font-semibold">雙方獲得獎勵</h4>
              <p className="text-sm text-muted-foreground">
                朋友完成首次付款後，您和朋友都將獲得{" "}
                <span className="font-bold text-primary">
                  {REFERRAL_TOKEN_REWARD.toLocaleString()} tokens
                </span>{" "}
                獎勵
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
