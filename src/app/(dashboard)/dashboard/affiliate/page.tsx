"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  XCircle,
  Users,
  TrendingUp,
  Award,
  Copy,
  Check,
  Info,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AffiliateTier } from "@/types/referral.types";

interface AffiliateReferral {
  id: string;
  company_name: string;
  registered_at: string;
  first_payment_at: string | null;
  first_payment_amount: number | null;
  total_payments: number;
  lifetime_value: number;
  is_active: boolean;
  last_payment_at: string | null;
}

interface AffiliateStats {
  totalReferrals: number;
  activeReferrals: number;
  pendingCommission: number;
  lockedCommission: number;
  availableCommission: number;
  withdrawnCommission: number;
  lifetimeCommission: number;
  conversionRate: number;
  averageOrderValue: number;
  lastPaymentDate: string | null;
  affiliate_code: string;
  status: string;
  currentTier: AffiliateTier;
  nextTier: AffiliateTier | null;
  referralsToNextTier: number;
  qualifiedReferrals: number;
}

export default function AffiliateDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentReferrals, setRecentReferrals] = useState<AffiliateReferral[]>(
    [],
  );
  const [referralsLoading, setReferralsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchRecentReferrals();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/affiliate/stats");

      if (response.status === 404) {
        router.push("/dashboard/affiliate/apply");
        return;
      }

      if (!response.ok) {
        throw new Error("無法取得統計資料");
      }

      const data = await response.json();
      setStats(data);
      setAffiliateCode(data.affiliate_code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentReferrals = async () => {
    try {
      const response = await fetch("/api/affiliate/referrals?limit=5");
      if (response.ok) {
        const data = await response.json();
        setRecentReferrals(data.referrals || data.data || []);
      }
    } catch (err) {
      console.error("獲取推薦客戶失敗:", err);
    } finally {
      setReferralsLoading(false);
    }
  };

  const getReferralLink = () => {
    if (!affiliateCode) return "";
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/r/${affiliateCode}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTierProgress = () => {
    if (!stats || !stats.nextTier) return 100;
    const currentProgress = stats.qualifiedReferrals;
    const nextRequired = stats.nextTier.min_referrals;
    const currentTierMin = stats.currentTier.min_referrals;
    return Math.min(
      100,
      ((currentProgress - currentTierMin) / (nextRequired - currentTierMin)) *
        100,
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-slate-700"></div>
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-lg bg-slate-700"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-500/30 bg-red-900/20">
          <CardContent className="pt-6">
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-white">聯盟夥伴儀表板</h1>
        <p className="text-slate-400">追蹤您的推薦成效和佣金收入</p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          佣金比例依推薦人數分級：15%~30%。詳細規範請參閱{" "}
          <Link
            href="/dashboard/affiliate/terms"
            className="font-medium underline hover:text-primary"
          >
            聯盟行銷計畫服務條款
          </Link>
          。
        </AlertDescription>
      </Alert>

      {stats?.currentTier && (
        <Card className="border-cyber-violet-500/30 bg-gradient-to-br from-cyber-violet-500/10 to-cyber-magenta-500/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyber-violet-500/20">
                  <Award className="h-6 w-6 text-cyber-violet-400" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2 text-white">
                    {stats.currentTier.tier_name}
                    <Badge
                      variant="secondary"
                      className="bg-cyber-violet-500/20 text-cyber-violet-300 border-0"
                    >
                      {stats.currentTier.commission_rate}% 佣金
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    您已有 {stats.qualifiedReferrals} 位付費推薦客戶
                  </CardDescription>
                </div>
              </div>
              {stats.nextTier && (
                <div className="text-right">
                  <p className="text-sm text-slate-400">
                    距離 {stats.nextTier.tier_name}
                  </p>
                  <p className="font-semibold text-white">
                    還需 {stats.referralsToNextTier} 位
                  </p>
                </div>
              )}
            </div>
          </CardHeader>
          {stats.nextTier && (
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{stats.currentTier.tier_name}</span>
                  <span>
                    {stats.nextTier.tier_name} ({stats.nextTier.commission_rate}
                    %)
                  </span>
                </div>
                <Progress value={getTierProgress()} className="h-2" />
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              可提領佣金
            </CardDescription>
            <CardTitle className="text-2xl text-emerald-400">
              NT$ {(stats?.availableCommission || 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/affiliate/withdraw">
              <Button size="sm" className="w-full">
                立即提領
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              鎖定中佣金
            </CardDescription>
            <CardTitle className="text-2xl text-amber-400">
              NT$ {(stats?.lockedCommission || 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">30天後可提領</p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              已提領總額
            </CardDescription>
            <CardTitle className="text-2xl text-cyber-cyan-400">
              NT$ {(stats?.withdrawnCommission || 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/affiliate/withdrawals">
              <Button size="sm" variant="outline" className="w-full">
                查看記錄
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              終身累計
            </CardDescription>
            <CardTitle className="text-2xl text-cyber-violet-400">
              NT$ {(stats?.lifetimeCommission || 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">所有佣金總計</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">您的專屬推薦連結</CardTitle>
          <CardDescription className="text-slate-400">
            分享此連結給新客戶，可獲得 15%~30% 佣金（依推薦人數分級）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {affiliateCode ? (
            <>
              <div>
                <label className="text-sm font-medium text-slate-300">
                  推薦碼
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={affiliateCode}
                    className="flex-1 rounded-md border border-white/10 px-3 py-2 bg-slate-700/50 font-mono text-white"
                  />
                  <Button
                    onClick={() => copyToClipboard(affiliateCode)}
                    variant={copied ? "default" : "outline"}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" /> 已複製
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" /> 複製
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300">
                  完整連結
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getReferralLink()}
                    className="flex-1 rounded-md border border-white/10 px-3 py-2 bg-slate-700/50 font-mono text-sm text-white"
                  />
                  <Button
                    onClick={() => copyToClipboard(getReferralLink())}
                    variant={copied ? "default" : "outline"}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" /> 已複製
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" /> 複製
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getReferralLink())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    分享到 Facebook
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href={`https://line.me/R/msg/text/?${encodeURIComponent(getReferralLink())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    分享到 LINE
                  </a>
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-4">
              <p className="text-amber-400">尚未取得推薦碼，請稍後重新整理</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <TrendingUp className="h-5 w-5 text-cyber-cyan-400" />
              推薦統計
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">總推薦人數</span>
              <span className="font-semibold text-white">
                {stats?.totalReferrals || 0} 人
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">已付款推薦</span>
              <span className="font-semibold text-emerald-400">
                {stats?.activeReferrals || 0} 人
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">轉換率</span>
              <span className="font-semibold text-white">
                {stats?.conversionRate || 0}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">平均訂單價值</span>
              <span className="font-semibold text-white">
                NT$ {stats?.averageOrderValue || 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <Users className="h-5 w-5 text-cyber-violet-400" />
                最近推薦客戶
              </CardTitle>
              <CardDescription className="text-slate-400">
                顯示最近 5 位推薦客戶
              </CardDescription>
            </div>
            <Link href="/dashboard/affiliate/referrals">
              <Button variant="outline" size="sm">
                查看全部
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {referralsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg bg-slate-700"
                ></div>
              ))}
            </div>
          ) : recentReferrals.length > 0 ? (
            <div className="space-y-3">
              {recentReferrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 p-4 hover:bg-slate-700/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">
                        {referral.company_name}
                      </p>
                      {referral.is_active ? (
                        <Badge
                          variant="default"
                          className="flex items-center gap-1"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          已付款
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          <XCircle className="h-3 w-3" />
                          待付款
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex gap-4 text-sm text-slate-400">
                      <span>
                        註冊：
                        {new Date(referral.registered_at).toLocaleDateString(
                          "zh-TW",
                        )}
                      </span>
                      {referral.first_payment_at && (
                        <span>
                          首次付款：
                          {new Date(
                            referral.first_payment_at,
                          ).toLocaleDateString("zh-TW")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">累計訂單</p>
                    <p className="font-semibold text-white">
                      {referral.total_payments} 筆
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="text-sm text-slate-400">生命週期價值</p>
                    <p className="font-semibold text-emerald-400">
                      NT$ {referral.lifetime_value?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-slate-700/50 p-8 text-center">
              <Users className="mx-auto h-12 w-12 text-slate-500" />
              <p className="mt-4 text-slate-300">尚無推薦客戶</p>
              <p className="mt-2 text-sm text-slate-500">
                分享您的推薦連結開始賺取佣金
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {stats?.lastPaymentDate && (
        <p className="text-center text-sm text-slate-500">
          最後一次佣金產生時間：
          {new Date(stats.lastPaymentDate).toLocaleString("zh-TW")}
        </p>
      )}
    </div>
  );
}
