"use client";

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
  AFFILIATE_TIERS,
  MIN_WITHDRAWAL_AMOUNT,
  COMMISSION_LOCK_DAYS,
} from "@/types/referral.types";

export default function AffiliateGuidePage() {
  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">聯盟夥伴須知</h1>
          <p className="text-muted-foreground">
            佣金規則、鎖定期、提領規範說明
          </p>
        </div>
        <Link href="/dashboard/affiliate">
          <Button variant="outline">返回儀表板</Button>
        </Link>
      </div>

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="font-semibold text-blue-900">快速概覽</h3>
              <ul className="mt-2 space-y-1 text-sm text-blue-800">
                <li>• 佣金比例：15% - 30%（依等級而定）</li>
                <li>• 鎖定期：{COMMISSION_LOCK_DAYS} 天</li>
                <li>• 最低提領：NT${MIN_WITHDRAWAL_AMOUNT.toLocaleString()}</li>
                <li>• 終身有效：推薦客戶的每筆付款都有佣金</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>📊</span>
            分級佣金制度
          </CardTitle>
          <CardDescription>
            佣金比例依據您的有效推薦客戶數量計算
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {AFFILIATE_TIERS.map((tier) => (
              <div
                key={tier.tier_level}
                className="bg-gradient-to-b from-white to-gray-50 p-4 rounded-lg border-2 text-center"
                style={{
                  borderColor:
                    tier.tier_level === 1
                      ? "#CD7F32"
                      : tier.tier_level === 2
                        ? "#C0C0C0"
                        : tier.tier_level === 3
                          ? "#FFD700"
                          : "#E5E4E2",
                }}
              >
                <div className="text-2xl mb-1">
                  {tier.tier_level === 1 && "🥉"}
                  {tier.tier_level === 2 && "🥈"}
                  {tier.tier_level === 3 && "🥇"}
                  {tier.tier_level === 4 && "💎"}
                </div>
                <div className="font-semibold text-foreground">
                  {tier.tier_name}
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {tier.max_referrals === null
                    ? `${tier.min_referrals}+ 人`
                    : `${tier.min_referrals}-${tier.max_referrals} 人`}
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {tier.commission_rate}%
                </div>
              </div>
            ))}
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-900 mb-2">📌 等級說明</h4>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• 有效推薦客戶 = 已完成首次付款的推薦客戶</li>
              <li>• 等級會根據您的有效推薦數量自動升級</li>
              <li>• 升級後，新佣金比例適用於之後的所有交易</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🔒</span>
            佣金鎖定期
          </CardTitle>
          <CardDescription>保護機制確保交易穩定性</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4">
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold text-blue-600">
                {COMMISSION_LOCK_DAYS}
              </div>
              <div>
                <div className="font-semibold">天鎖定期</div>
                <div className="text-sm text-muted-foreground">
                  佣金產生後需等待 {COMMISSION_LOCK_DAYS} 天才能提領
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">佣金狀態說明</h4>
            <div className="grid gap-2">
              <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded text-sm font-medium">
                  鎖定中
                </span>
                <span className="text-sm">
                  佣金在 {COMMISSION_LOCK_DAYS} 天鎖定期內，尚無法提領
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <span className="px-2 py-1 bg-green-200 text-green-800 rounded text-sm font-medium">
                  可提領
                </span>
                <span className="text-sm">已過鎖定期，可以申請提領</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="px-2 py-1 bg-blue-200 text-blue-800 rounded text-sm font-medium">
                  已提領
                </span>
                <span className="text-sm">已完成提領，等待撥款或已入帳</span>
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-red-900 mb-2">⚠️ 退款處理</h4>
            <p className="text-sm text-red-800">
              若推薦客戶在鎖定期內申請退款，相關佣金將被取消。
              這是為了確保佣金只發放給真正完成的交易。
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>💰</span>
            提領規範
          </CardTitle>
          <CardDescription>提領佣金的條件與流程</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">
                最低提領金額
              </div>
              <div className="text-2xl font-bold">
                NT$ {MIN_WITHDRAWAL_AMOUNT.toLocaleString()}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">撥款日期</div>
              <div className="text-2xl font-bold">每月 25 號</div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">提領流程</h4>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">
                  1
                </span>
                <div>
                  <div className="font-medium">確認可提領金額</div>
                  <div className="text-sm text-muted-foreground">
                    在儀表板查看「可提領佣金」金額，需達到最低提領門檻
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">
                  2
                </span>
                <div>
                  <div className="font-medium">填寫銀行資訊</div>
                  <div className="text-sm text-muted-foreground">
                    提供正確的銀行帳戶資訊，戶名需與身份證相符
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">
                  3
                </span>
                <div>
                  <div className="font-medium">提交申請</div>
                  <div className="text-sm text-muted-foreground">
                    確認金額與銀行資訊後提交提領申請
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">
                  4
                </span>
                <div>
                  <div className="font-medium">等待審核與撥款</div>
                  <div className="text-sm text-muted-foreground">
                    統一於每月 25 號撥款至您的銀行帳戶
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h4 className="font-semibold text-orange-900 mb-2">📋 稅務說明</h4>
            <ul className="text-sm text-orange-800 space-y-1">
              <li>• 依台灣稅法規定，佣金收入需扣繳 10% 所得稅</li>
              <li>• 扣繳稅額會在年度報稅時計入可扣抵稅額</li>
              <li>• 每年 1 月會寄發上年度扣繳憑單</li>
              <li>
                • 詳細稅務資訊請參閱{" "}
                <Link
                  href="/dashboard/affiliate/tax-notice"
                  className="underline"
                >
                  稅務須知
                </Link>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>♾️</span>
            終身佣金制度
          </CardTitle>
          <CardDescription>推薦一次，終身受益</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">
              您推薦的客戶，無論是首次購買還是續約、升級，
              <strong>每一筆付款您都能獲得佣金</strong>。
              這不是一次性獎勵，而是終身有效的被動收入！
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">計佣範圍</h4>
            <ul className="text-sm text-foreground space-y-1">
              <li>✅ 首次訂閱付款</li>
              <li>✅ 月費/年費續約</li>
              <li>✅ 方案升級</li>
              <li>✅ 加購服務（如 Token 加值包）</li>
              <li>❌ 退款交易（不計佣金且會扣回）</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>❓</span>
            常見問題
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="border-b pb-4">
              <h4 className="font-semibold mb-2">
                Q: 我要如何查看目前的佣金狀態？
              </h4>
              <p className="text-sm text-muted-foreground">
                A: 請到「
                <Link
                  href="/dashboard/affiliate/commissions"
                  className="text-blue-600 underline"
                >
                  佣金明細
                </Link>
                」頁面，可以查看所有佣金的狀態、金額和解鎖時間。
              </p>
            </div>

            <div className="border-b pb-4">
              <h4 className="font-semibold mb-2">
                Q: 為什麼我的佣金顯示「鎖定中」？
              </h4>
              <p className="text-sm text-muted-foreground">
                A: 佣金產生後需要 {COMMISSION_LOCK_DAYS} 天的鎖定期。
                這是為了確保交易穩定，避免退款造成的問題。
                鎖定期結束後，佣金會自動變為「可提領」狀態。
              </p>
            </div>

            <div className="border-b pb-4">
              <h4 className="font-semibold mb-2">Q: 提領後多久會收到款項？</h4>
              <p className="text-sm text-muted-foreground">
                A: 所有提領申請統一於每月 25 號撥款。請在每月 20 號前提交申請，
                以便趕上當月撥款。您可以在「
                <Link
                  href="/dashboard/affiliate/withdrawals"
                  className="text-blue-600 underline"
                >
                  提領記錄
                </Link>
                」查看處理進度。
              </p>
            </div>

            <div className="border-b pb-4">
              <h4 className="font-semibold mb-2">Q: 如何升級佣金等級？</h4>
              <p className="text-sm text-muted-foreground">
                A: 等級是根據您的有效推薦客戶數量自動計算的。
                當您的有效推薦達到下一等級的門檻時，系統會自動升級，
                新的佣金比例會應用於之後的所有交易。
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">
                Q: 推薦客戶退款會怎麼處理？
              </h4>
              <p className="text-sm text-muted-foreground">
                A: 如果推薦客戶在鎖定期內退款，相關佣金會被取消。
                如果已經提領的佣金因退款需要扣回，會從您的下次提領中扣除。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Link href="/dashboard/affiliate/commissions" className="flex-1">
          <Button className="w-full" variant="default">
            查看佣金明細
          </Button>
        </Link>
        <Link href="/dashboard/affiliate/withdraw" className="flex-1">
          <Button className="w-full" variant="outline">
            申請提領
          </Button>
        </Link>
      </div>
    </div>
  );
}
