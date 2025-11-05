import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAffiliateCode } from '@/lib/affiliate/tracking'
import type { ApplyAffiliateRequest, ApplyAffiliateResponse } from '@/types/affiliate.types'

/**
 * POST /api/affiliate/apply
 * 申請成為聯盟夥伴
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 檢查是否已登入
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, message: '請先登入' }, { status: 401 })
    }

    // 取得請求資料
    const body = (await request.json()) as ApplyAffiliateRequest

    const { full_name, id_number, phone, email, address, is_resident, agree_terms } = body

    // 驗證必填欄位
    if (!full_name || !id_number || !phone || !email || !address) {
      return NextResponse.json(
        { success: false, message: '請填寫所有必填欄位' },
        { status: 400 }
      )
    }

    if (!agree_terms) {
      return NextResponse.json(
        { success: false, message: '請同意條款與條件' },
        { status: 400 }
      )
    }

    // 驗證身份證/統編格式
    const idPattern = /^[A-Z][12]\d{8}$/
    const companyIdPattern = /^\d{8}$/

    if (!idPattern.test(id_number) && !companyIdPattern.test(id_number)) {
      return NextResponse.json(
        { success: false, message: '身份證字號或統編格式錯誤' },
        { status: 400 }
      )
    }

    // 取得用戶的 company_id
    const { data: companyMember, error: memberError } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (memberError || !companyMember) {
      return NextResponse.json(
        { success: false, message: '無法取得公司資訊' },
        { status: 400 }
      )
    }

    const companyId = companyMember.company_id

    // 檢查是否已經申請過
    const { data: existingAffiliate, error: checkError } = await supabase
      .from('affiliates')
      .select('id, affiliate_code, status')
      .eq('company_id', companyId)
      .single()

    if (existingAffiliate) {
      // 如果已經申請過，返回現有的推薦碼
      return NextResponse.json({
        success: true,
        affiliate_code: existingAffiliate.affiliate_code,
        message: '您已經是聯盟夥伴了！',
        already_exists: true,
      })
    }

    // 生成唯一推薦碼（確保不重複）
    let affiliateCode = generateAffiliateCode()
    let isUnique = false
    let attempts = 0

    while (!isUnique && attempts < 10) {
      const { data: duplicate } = await supabase
        .from('affiliates')
        .select('id')
        .eq('affiliate_code', affiliateCode)
        .single()

      if (!duplicate) {
        isUnique = true
      } else {
        affiliateCode = generateAffiliateCode()
        attempts++
      }
    }

    if (!isUnique) {
      return NextResponse.json(
        { success: false, message: '推薦碼生成失敗，請稍後再試' },
        { status: 500 }
      )
    }

    // 計算稅率
    const taxRate = is_resident ? 10.0 : 20.0

    // 創建 affiliate 記錄
    const { data: newAffiliate, error: insertError } = await supabase
      .from('affiliates')
      .insert({
        company_id: companyId,
        affiliate_code: affiliateCode,
        full_name,
        id_number,
        phone,
        email,
        address,
        is_resident,
        tax_rate: taxRate,
        status: 'active', // 自動審核通過
        approved_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('創建聯盟夥伴失敗:', insertError)
      return NextResponse.json(
        { success: false, message: '申請失敗，請稍後再試' },
        { status: 500 }
      )
    }

    // 記錄追蹤事件（可選）
    await supabase.from('affiliate_tracking_logs').insert({
      affiliate_code: affiliateCode,
      event_type: 'register',
      company_id: companyId,
      user_id: user.id,
      metadata: { source: 'apply_form' },
    })

    // TODO: 發送歡迎 Email

    return NextResponse.json({
      success: true,
      affiliate_code: affiliateCode,
      message: '申請成功！您已成為聯盟夥伴',
    } as ApplyAffiliateResponse)
  } catch (error) {
    console.error('API 錯誤:', error)
    return NextResponse.json(
      { success: false, message: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
