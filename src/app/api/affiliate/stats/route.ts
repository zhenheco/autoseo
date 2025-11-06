import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AffiliateDashboardStats } from '@/types/affiliate.types'

/**
 * GET /api/affiliate/stats
 * 取得聯盟夥伴統計資料
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 檢查是否已登入
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    // 取得用戶的 company_id
    const { data: companyMember } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (!companyMember) {
      return NextResponse.json({ error: '無法取得公司資訊' }, { status: 400 })
    }

    // 取得聯盟夥伴資料
    const { data: affiliate, error: affiliateError } = await supabase
      .from('affiliates')
      .select('*')
      .eq('company_id', companyMember.company_id)
      .single()

    if (affiliateError || !affiliate) {
      return NextResponse.json({ error: '您還不是聯盟夥伴' }, { status: 404 })
    }

    // 取得推薦記錄
    const { data: referrals } = await supabase
      .from('affiliate_referrals')
      .select('*')
      .eq('affiliate_id', affiliate.id)

    // 計算轉換率
    const totalClicks = referrals?.length || 0
    const paidReferrals = referrals?.filter((r) => r.first_payment_at !== null).length || 0
    const conversionRate = totalClicks > 0 ? (paidReferrals / totalClicks) * 100 : 0

    // 計算平均訂單價值
    const totalValue = referrals?.reduce((sum, r) => sum + (r.lifetime_value || 0), 0) || 0
    const averageOrderValue = paidReferrals > 0 ? totalValue / paidReferrals : 0

    // 取得最後一次付款日期
    const lastPaymentDate = referrals
      ?.filter((r) => r.last_payment_at)
      .sort((a, b) => {
        const dateA = a.last_payment_at ? new Date(a.last_payment_at).getTime() : 0
        const dateB = b.last_payment_at ? new Date(b.last_payment_at).getTime() : 0
        return dateB - dateA
      })[0]?.last_payment_at

    const stats: AffiliateDashboardStats = {
      totalReferrals: affiliate.total_referrals,
      activeReferrals: affiliate.active_referrals,
      pendingCommission: parseFloat(affiliate.pending_commission.toString()),
      lockedCommission: parseFloat(affiliate.locked_commission.toString()),
      withdrawnCommission: parseFloat(affiliate.withdrawn_commission.toString()),
      lifetimeCommission: parseFloat(affiliate.lifetime_commission.toString()),
      conversionRate: Math.round(conversionRate * 100) / 100,
      averageOrderValue: Math.round(averageOrderValue),
      lastPaymentDate: lastPaymentDate || null,
    }

    return NextResponse.json({
      ...stats,
      affiliate_code: affiliate.affiliate_code,
      status: affiliate.status,
    })
  } catch (error) {
    console.error('API 錯誤:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
