'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { AffiliateDashboardStats, AffiliateReferral } from '@/types/affiliate.types'
import { CheckCircle2, XCircle, Users } from 'lucide-react'

export default function AffiliateDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AffiliateDashboardStats | null>(null)
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentReferrals, setRecentReferrals] = useState<AffiliateReferral[]>([])
  const [referralsLoading, setReferralsLoading] = useState(true)

  useEffect(() => {
    fetchStats()
    fetchRecentReferrals()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/affiliate/stats')

      if (response.status === 404) {
        // 還不是聯盟夥伴，跳轉到申請頁面
        router.push('/dashboard/affiliate/apply')
        return
      }

      if (!response.ok) {
        throw new Error('無法取得統計資料')
      }

      const data = await response.json()
      setStats(data)
      setAffiliateCode(data.affiliate_code)
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入失敗')
    } finally {
      setLoading(false)
    }
  }

  const fetchRecentReferrals = async () => {
    try {
      const response = await fetch('/api/affiliate/referrals?limit=5')
      if (response.ok) {
        const data = await response.json()
        setRecentReferrals(data.referrals || [])
      }
    } catch (err) {
      console.error('獲取推薦客戶失敗:', err)
    } finally {
      setReferralsLoading(false)
    }
  }

  const getReferralLink = () => {
    if (!affiliateCode) return ''
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    return `${baseUrl}?ref=${affiliateCode}`
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-gray-200"></div>
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-lg bg-gray-200"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* 標題 */}
      <div>
        <h1 className="text-3xl font-bold">聯盟夥伴儀表板</h1>
        <p className="text-gray-600">追蹤您的推薦成效和佣金收入</p>
      </div>

      {/* 統計卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>可提領佣金</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              NT$ {stats?.pendingCommission.toLocaleString() || 0}
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

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>鎖定中佣金</CardDescription>
            <CardTitle className="text-2xl text-orange-600">
              NT$ {stats?.lockedCommission.toLocaleString() || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">30天後可提領</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>已提領總額</CardDescription>
            <CardTitle className="text-2xl text-blue-600">
              NT$ {stats?.withdrawnCommission.toLocaleString() || 0}
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

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>終身累計</CardDescription>
            <CardTitle className="text-2xl text-purple-600">
              NT$ {stats?.lifetimeCommission.toLocaleString() || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">所有佣金總計</p>
          </CardContent>
        </Card>
      </div>

      {/* 推薦連結 */}
      <Card>
        <CardHeader>
          <CardTitle>您的專屬推薦連結</CardTitle>
          <CardDescription>分享此連結給新客戶，即可獲得 20% 佣金</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {affiliateCode ? (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700">推薦碼</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={affiliateCode}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 bg-gray-50"
                  />
                  <Button onClick={() => copyToClipboard(affiliateCode)}>
                    {copied ? '已複製' : '複製'}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">完整連結</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getReferralLink()}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 bg-gray-50"
                  />
                  <Button onClick={() => copyToClipboard(getReferralLink())}>
                    {copied ? '已複製' : '複製'}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                      getReferralLink()
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    分享到 Facebook
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href={`https://line.me/R/msg/text/?${encodeURIComponent(
                      getReferralLink()
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    分享到 LINE
                  </a>
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-md bg-yellow-50 p-4">
              <p className="text-yellow-800">尚未取得推薦碼，請稍後重新整理</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 推薦統計 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>推薦統計</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">總推薦人數</span>
              <span className="font-semibold">{stats?.totalReferrals || 0} 人</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">活躍推薦</span>
              <span className="font-semibold text-green-600">{stats?.activeReferrals || 0} 人</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">轉換率</span>
              <span className="font-semibold">{stats?.conversionRate || 0}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">平均訂單價值</span>
              <span className="font-semibold">NT$ {stats?.averageOrderValue || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>快速連結</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/dashboard/affiliate/referrals">
              <Button variant="outline" className="w-full justify-start">
                查看推薦客戶
              </Button>
            </Link>
            <Link href="/dashboard/affiliate/commissions">
              <Button variant="outline" className="w-full justify-start">
                查看佣金明細
              </Button>
            </Link>
            <Link href="/dashboard/affiliate/settings">
              <Button variant="outline" className="w-full justify-start">
                更新銀行帳戶
              </Button>
            </Link>
            <Link href="/dashboard/affiliate/tax-notice" target="_blank">
              <Button variant="outline" className="w-full justify-start">
                稅務須知
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* 最近推薦客戶 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                最近推薦客戶
              </CardTitle>
              <CardDescription>顯示最近 5 位推薦客戶</CardDescription>
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
                <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100"></div>
              ))}
            </div>
          ) : recentReferrals.length > 0 ? (
            <div className="space-y-3">
              {recentReferrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">推薦客戶 #{referral.id.slice(0, 8)}</p>
                      {referral.is_active ? (
                        <Badge variant="default" className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          活躍
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <XCircle className="h-3 w-3" />
                          非活躍
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex gap-4 text-sm text-gray-600">
                      <span>註冊：{new Date(referral.registered_at).toLocaleDateString('zh-TW')}</span>
                      {referral.first_payment_at && (
                        <span>
                          首次付款：{new Date(referral.first_payment_at).toLocaleDateString('zh-TW')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">累計訂單</p>
                    <p className="font-semibold">{referral.total_payments} 筆</p>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="text-sm text-gray-600">生命週期價值</p>
                    <p className="font-semibold text-green-600">
                      NT$ {referral.lifetime_value?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-gray-50 p-8 text-center">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-600">尚無推薦客戶</p>
              <p className="mt-2 text-sm text-gray-500">分享您的推薦連結開始賺取佣金</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 最後更新時間 */}
      {stats?.lastPaymentDate && (
        <p className="text-center text-sm text-gray-500">
          最後一次佣金產生時間：{new Date(stats.lastPaymentDate).toLocaleString('zh-TW')}
        </p>
      )}
    </div>
  )
}
