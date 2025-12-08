"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface Affiliate {
  id: string;
  company_id: string;
  status: "pending" | "active" | "inactive" | "suspended";
  current_tier: number;
  qualified_referrals: number;
  pending_commission: number;
  available_commission: number;
  withdrawn_commission: number;
  lifetime_commission: number;
  created_at: string;
  companies: {
    id: string;
    name: string;
  };
  affiliate_tiers: {
    tier_name: string;
    commission_rate: number;
  } | null;
}

export default function AdminAffiliatesPage() {
  const [loading, setLoading] = useState(true);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [testPaymentLoading, setTestPaymentLoading] = useState(false);

  useEffect(() => {
    fetchAffiliates();
  }, []);

  const fetchAffiliates = async () => {
    try {
      const response = await fetch("/api/admin/affiliates");

      if (response.status === 403) {
        toast.error("您沒有權限存取此頁面");
        return;
      }

      if (!response.ok) {
        throw new Error("載入失敗");
      }

      const data = await response.json();
      setAffiliates(data.data || []);
    } catch (error) {
      console.error("載入聯盟夥伴失敗:", error);
      toast.error("載入失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleTestPayment = async () => {
    setTestPaymentLoading(true);
    try {
      const response = await fetch("/api/admin/test-payment", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "建立測試訂單失敗");
      }

      const { paymentForm } = await response.json();

      // 創建隱藏表單並提交到藍新金流
      const form = document.createElement("form");
      form.method = "POST";
      form.action = paymentForm.apiUrl;

      const fields = [
        { name: "MerchantID", value: paymentForm.merchantId },
        { name: "TradeInfo", value: paymentForm.tradeInfo },
        { name: "TradeSha", value: paymentForm.tradeSha },
        { name: "Version", value: paymentForm.version },
      ];

      fields.forEach(({ name, value }) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      console.error("測試支付失敗:", error);
      toast.error(error instanceof Error ? error.message : "測試支付失敗");
    } finally {
      setTestPaymentLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const getStatusBadge = (status: Affiliate["status"]) => {
    const statusMap = {
      pending: { label: "待審核", className: "bg-yellow-100 text-yellow-800" },
      active: { label: "活躍", className: "bg-green-100 text-green-800" },
      inactive: { label: "不活躍", className: "bg-muted text-foreground" },
      suspended: { label: "已暫停", className: "bg-red-100 text-red-800" },
    };

    const { label, className } = statusMap[status];
    return (
      <span className={`rounded-full px-2 py-1 text-xs ${className}`}>
        {label}
      </span>
    );
  };

  const totalPending = affiliates.reduce(
    (sum, a) => sum + (a.pending_commission || 0),
    0,
  );
  const totalAvailable = affiliates.reduce(
    (sum, a) => sum + (a.available_commission || 0),
    0,
  );
  const totalLifetime = affiliates.reduce(
    (sum, a) => sum + (a.lifetime_commission || 0),
    0,
  );

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">聯盟夥伴管理</h1>
          <p className="text-muted-foreground">管理所有聯盟夥伴和佣金統計</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleTestPayment}
            disabled={testPaymentLoading}
          >
            {testPaymentLoading ? "處理中..." : "測試支付 NT$1"}
          </Button>
          <Link href="/dashboard/admin/withdrawals">
            <Button variant="outline">提領審核</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>聯盟夥伴總數</CardDescription>
            <CardTitle className="text-3xl">{affiliates.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>待解鎖佣金</CardDescription>
            <CardTitle className="text-3xl text-yellow-600">
              NT$ {totalPending.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>可提領佣金</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              NT$ {totalAvailable.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>累計佣金</CardDescription>
            <CardTitle className="text-3xl">
              NT$ {totalLifetime.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>聯盟夥伴列表</CardTitle>
          <CardDescription>共 {affiliates.length} 位夥伴</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              載入中...
            </div>
          ) : affiliates.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              尚無聯盟夥伴
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>加入時間</TableHead>
                    <TableHead>公司名稱</TableHead>
                    <TableHead>等級</TableHead>
                    <TableHead className="text-right">推薦人數</TableHead>
                    <TableHead className="text-right">待解鎖</TableHead>
                    <TableHead className="text-right">可提領</TableHead>
                    <TableHead className="text-right">累計佣金</TableHead>
                    <TableHead>狀態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affiliates.map((affiliate) => (
                    <TableRow key={affiliate.id}>
                      <TableCell>{formatDate(affiliate.created_at)}</TableCell>
                      <TableCell className="font-medium">
                        {affiliate.companies?.name || "-"}
                      </TableCell>
                      <TableCell>
                        <span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium">
                          {affiliate.affiliate_tiers?.tier_name || "-"}
                          {affiliate.affiliate_tiers && (
                            <span className="ml-1 text-muted-foreground">
                              ({affiliate.affiliate_tiers.commission_rate}%)
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {affiliate.qualified_referrals || 0}
                      </TableCell>
                      <TableCell className="text-right text-yellow-600">
                        NT${" "}
                        {(affiliate.pending_commission || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        NT${" "}
                        {(affiliate.available_commission || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        NT${" "}
                        {(affiliate.lifetime_commission || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(affiliate.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
