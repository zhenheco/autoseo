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
import { BANK_CODES, MIN_WITHDRAWAL_AMOUNT } from "@/types/referral.types";

export default function AffiliateWithdrawPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [availableCommission, setAvailableCommission] = useState(0);
  const [taxRate, setTaxRate] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    amount: "",
    bank_code: "",
    bank_branch: "",
    bank_account: "",
    bank_account_name: "",
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/affiliate/stats");
      if (response.ok) {
        const data = await response.json();
        setAvailableCommission(data.availableCommission || 0);
        if (data.taxRate) {
          setTaxRate(data.taxRate);
        }
      }
    } catch (err) {
      console.error("載入統計失敗:", err);
    }
  };

  const calculateTax = (amount: number) => {
    return amount * (taxRate / 100);
  };

  const calculateNetAmount = (amount: number) => {
    return amount - calculateTax(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const amount = parseFloat(formData.amount);

      if (isNaN(amount) || amount < MIN_WITHDRAWAL_AMOUNT) {
        throw new Error(`最低提領金額為 NT$${MIN_WITHDRAWAL_AMOUNT}`);
      }

      if (amount > availableCommission) {
        throw new Error("提領金額超過可提領餘額");
      }

      const response = await fetch("/api/affiliate/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          bank_code: formData.bank_code,
          bank_branch: formData.bank_branch || undefined,
          bank_account: formData.bank_account,
          bank_account_name: formData.bank_account_name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "提領申請失敗");
      }

      alert(data.message);
      router.push("/dashboard/affiliate/withdrawals");
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知錯誤");
    } finally {
      setLoading(false);
    }
  };

  const amount = parseFloat(formData.amount) || 0;

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-6">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">申請提領</h1>
          <p className="text-slate-400">將您的佣金提領到銀行帳戶</p>
        </div>
        <Link href="/dashboard/affiliate">
          <Button variant="outline">返回</Button>
        </Link>
      </div>

      {/* 可提領餘額 */}
      <Card className="border-emerald-500/30 bg-emerald-500/10">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <span className="text-lg font-medium text-white">可提領佣金</span>
            <span className="text-3xl font-bold text-emerald-400">
              NT$ {availableCommission.toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-500/30 bg-red-900/20">
          <CardContent className="pt-6">
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 提領表單 */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">提領金額</CardTitle>
            <CardDescription className="text-slate-400">
              最低提領金額 NT${MIN_WITHDRAWAL_AMOUNT}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                提領金額 (TWD) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                required
                min={MIN_WITHDRAWAL_AMOUNT}
                max={availableCommission}
                step="1"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-white/10 bg-slate-700/50 px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyber-violet-500 focus:outline-none focus:ring-cyber-violet-500"
                placeholder={`${MIN_WITHDRAWAL_AMOUNT}`}
              />
            </div>

            {/* 提領試算 */}
            {amount >= MIN_WITHDRAWAL_AMOUNT && (
              <div className="rounded-md bg-cyber-violet-500/10 border border-cyber-violet-500/30 p-4 space-y-2">
                <h4 className="font-medium text-white">提領試算</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-300">提領金額：</span>
                    <span className="font-semibold text-white">
                      NT$ {amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">
                      扣繳稅額 ({taxRate}%)：
                    </span>
                    <span className="text-red-400">
                      -NT$ {calculateTax(amount).toLocaleString()}
                    </span>
                  </div>
                  <div className="border-t border-cyber-violet-500/30 pt-1 mt-1"></div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-white">實際入帳：</span>
                    <span className="text-lg font-bold text-emerald-400">
                      NT$ {calculateNetAmount(amount).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">銀行帳戶資訊</CardTitle>
            <CardDescription className="text-slate-400">
              請填寫正確的銀行帳戶，戶名需與身份證相符
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                銀行代碼 <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={formData.bank_code}
                onChange={(e) =>
                  setFormData({ ...formData, bank_code: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-white/10 bg-slate-700/50 px-3 py-2 text-white focus:border-cyber-violet-500 focus:outline-none focus:ring-cyber-violet-500"
              >
                <option value="" className="bg-slate-800">
                  請選擇銀行
                </option>
                {Object.entries(BANK_CODES).map(([code, name]) => (
                  <option key={code} value={code} className="bg-slate-800">
                    {code} - {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300">
                分行名稱
              </label>
              <input
                type="text"
                value={formData.bank_branch}
                onChange={(e) =>
                  setFormData({ ...formData, bank_branch: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-white/10 bg-slate-700/50 px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyber-violet-500 focus:outline-none focus:ring-cyber-violet-500"
                placeholder="例如：台北分行（選填）"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300">
                銀行帳號 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.bank_account}
                onChange={(e) =>
                  setFormData({ ...formData, bank_account: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-white/10 bg-slate-700/50 px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyber-violet-500 focus:outline-none focus:ring-cyber-violet-500"
                placeholder="請輸入完整帳號"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300">
                戶名 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.bank_account_name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bank_account_name: e.target.value,
                  })
                }
                className="mt-1 block w-full rounded-md border border-white/10 bg-slate-700/50 px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyber-violet-500 focus:outline-none focus:ring-cyber-violet-500"
                placeholder="需與身份證姓名相符"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="pt-6">
            <h4 className="font-medium text-white mb-2">注意事項</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-slate-300">
              <li>所有提領申請統一於每月 25 號撥款</li>
              <li>請在每月 20 號前提交申請，以便趕上當月撥款</li>
              <li>扣繳稅額會在年度報稅時計入可扣抵稅額</li>
              <li>請確保銀行帳戶資訊正確，錯誤資訊可能導致撥款失敗</li>
            </ul>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || amount < MIN_WITHDRAWAL_AMOUNT}
            className="flex-1"
          >
            {loading ? "處理中..." : "提交申請"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            取消
          </Button>
        </div>
      </form>
    </div>
  );
}
