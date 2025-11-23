import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/affiliate/commissions
 * 取得佣金明細
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 檢查是否已登入
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    // 取得查詢參數
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status') || 'all'

    // 取得聯盟夥伴資料
    const { data: companyMember } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (!companyMember) {
      return NextResponse.json({ error: '無法取得公司資訊' }, { status: 400 })
    }

    const { data: affiliate } = await supabase
      .from('affiliates')
      .select('id')
      .eq('company_id', companyMember.company_id)
      .single()

    if (!affiliate) {
      return NextResponse.json({ error: '您還不是聯盟夥伴' }, { status: 404 })
    }

    // 建立查詢
    let query = supabase
      .from('affiliate_commissions')
      .select(
        `
        *,
        affiliate_referrals!inner (
          referred_company_id,
          companies:referred_company_id (
            name
          )
        )
      `,
        { count: 'exact' }
      )
      .eq('affiliate_id', affiliate.id)

    // 根據狀態篩選
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    // 分頁
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data: commissions, error, count } = await query
      .order('earned_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('查詢佣金列表失敗:', error)
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    // 格式化資料
    const formattedData = commissions?.map((comm: any) => ({
      id: comm.id,
      company_name: comm.affiliate_referrals?.companies?.name || '未知公司',
      order_amount: parseFloat(comm.order_amount.toString()),
      commission_amount: parseFloat(comm.commission_amount.toString()),
      tax_amount: parseFloat(comm.tax_amount.toString()),
      net_commission: parseFloat(comm.net_commission.toString()),
      earned_at: comm.earned_at,
      unlock_at: comm.unlock_at,
      status: comm.status,
      withdrawn_at: comm.withdrawn_at,
    }))

    // 計算摘要
    const { data: summaryData } = await supabase
      .from('affiliate_commissions')
      .select('status, net_commission')
      .eq('affiliate_id', affiliate.id)

    const summary = {
      total_locked: 0,
      total_available: 0,
      total_withdrawn: 0,
    }

    summaryData?.forEach((comm: any) => {
      const amount = parseFloat(comm.net_commission.toString())
      if (comm.status === 'locked') {
        summary.total_locked += amount
      } else if (comm.status === 'available') {
        summary.total_available += amount
      } else if (comm.status === 'withdrawn') {
        summary.total_withdrawn += amount
      }
    })

    return NextResponse.json({
      data: formattedData,
      summary,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('API 錯誤:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
