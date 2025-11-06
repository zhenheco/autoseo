import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/affiliate/referrals
 * 取得推薦客戶列表
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

    // 取得查詢參數
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status') || 'all' // 'all' | 'active' | 'inactive'

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
      .from('affiliate_referrals')
      .select(
        `
        *,
        companies:referred_company_id (
          name
        )
      `,
        { count: 'exact' }
      )
      .eq('affiliate_id', affiliate.id)

    // 根據狀態篩選
    if (status === 'active') {
      query = query.eq('is_active', true)
    } else if (status === 'inactive') {
      query = query.eq('is_active', false)
    }

    // 排序和分頁
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data: referrals, error, count } = await query
      .order('registered_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('查詢推薦列表失敗:', error)
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    // 格式化資料
    const formattedData = referrals?.map((ref: any) => ({
      id: ref.id,
      company_name: ref.companies?.name || '未知公司',
      registered_at: ref.registered_at,
      first_payment_at: ref.first_payment_at,
      first_payment_amount: ref.first_payment_amount,
      total_payments: ref.total_payments,
      lifetime_value: parseFloat(ref.lifetime_value.toString()),
      total_commission_generated: parseFloat(ref.total_commission_generated.toString()),
      is_active: ref.is_active,
      last_payment_at: ref.last_payment_at,
      cancelled_at: ref.cancelled_at,
    }))

    return NextResponse.json({
      data: formattedData,
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
