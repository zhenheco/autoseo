import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MIN_WITHDRAWAL_AMOUNT } from '@/types/affiliate.types'

/**
 * POST /api/affiliate/withdraw
 * 申請提領佣金
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 檢查是否已登入
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, message: '請先登入' }, { status: 401 })
    }

    // 取得請求資料
    const body = await request.json()
    const { amount, bank_code, bank_branch, bank_account, bank_account_name } = body

    // 驗證必填欄位
    if (!amount || !bank_code || !bank_account || !bank_account_name) {
      return NextResponse.json(
        { success: false, message: '請填寫所有必填欄位' },
        { status: 400 }
      )
    }

    // 驗證最低提領金額
    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      return NextResponse.json(
        { success: false, message: `最低提領金額為 NT$${MIN_WITHDRAWAL_AMOUNT}` },
        { status: 400 }
      )
    }

    // 取得聯盟夥伴資料
    const { data: companyMember } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (!companyMember) {
      return NextResponse.json(
        { success: false, message: '無法取得公司資訊' },
        { status: 400 }
      )
    }

    const { data: affiliate } = await supabase
      .from('affiliates')
      .select('*')
      .eq('company_id', companyMember.company_id)
      .single()

    if (!affiliate) {
      return NextResponse.json(
        { success: false, message: '您還不是聯盟夥伴' },
        { status: 404 }
      )
    }

    // 檢查可提領餘額
    const pendingCommission = parseFloat(affiliate.pending_commission.toString())

    if (amount > pendingCommission) {
      return NextResponse.json(
        {
          success: false,
          message: `可提領金額不足。您的可提領餘額為 NT$${pendingCommission.toFixed(2)}`,
        },
        { status: 400 }
      )
    }

    // 計算稅額和實際撥款金額
    const taxRate = parseFloat(affiliate.tax_rate.toString())
    const taxAmount = amount * (taxRate / 100)
    const netAmount = amount - taxAmount

    // 檢查是否首次提領（需要證件）
    const isFirstWithdrawal = !affiliate.documents_verified
    const requiresDocuments = isFirstWithdrawal

    // 如果是首次提領且未上傳證件，暫時標記為需要證件
    // TODO: 實作檔案上傳功能

    // 取得可用的佣金記錄 IDs
    const { data: availableCommissions } = await supabase
      .from('affiliate_commissions')
      .select('id, net_commission')
      .eq('affiliate_id', affiliate.id)
      .eq('status', 'available')
      .order('unlock_at', { ascending: true })

    // 計算需要提領哪些佣金記錄
    let remainingAmount = amount
    const commissionIds: string[] = []

    for (const comm of availableCommissions || []) {
      if (remainingAmount <= 0) break

      const commAmount = parseFloat(comm.net_commission.toString())
      if (commAmount <= remainingAmount) {
        commissionIds.push(comm.id)
        remainingAmount -= commAmount
      }
    }

    // 創建提領申請
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from('affiliate_withdrawals')
      .insert({
        affiliate_id: affiliate.id,
        withdrawal_amount: amount,
        tax_amount: taxAmount,
        net_amount: netAmount,
        bank_code,
        bank_branch: bank_branch || null,
        bank_account,
        bank_account_name,
        requires_documents: requiresDocuments,
        status: 'pending',
        commission_ids: commissionIds,
      })
      .select()
      .single()

    if (withdrawalError) {
      console.error('創建提領申請失敗:', withdrawalError)
      return NextResponse.json(
        { success: false, message: '提領申請失敗，請稍後再試' },
        { status: 500 }
      )
    }

    // 更新佣金狀態為 'withdrawn'
    if (commissionIds.length > 0) {
      await supabase
        .from('affiliate_commissions')
        .update({
          status: 'withdrawn',
          withdrawal_id: withdrawal.id,
          withdrawn_at: new Date().toISOString(),
        })
        .in('id', commissionIds)

      // 更新聯盟夥伴的可提領餘額
      await supabase
        .from('affiliates')
        .update({
          pending_commission: pendingCommission - amount,
          withdrawn_commission: parseFloat(affiliate.withdrawn_commission.toString()) + netAmount,
        })
        .eq('id', affiliate.id)
    }

    // TODO: 發送提領確認 Email

    return NextResponse.json({
      success: true,
      withdrawal_id: withdrawal.id,
      estimated_days: 5,
      message: isFirstWithdrawal
        ? '提領申請已提交。由於是首次提領，請稍後上傳證件以完成審核。'
        : '提領申請已提交，預計 5-7 個工作天內完成審核並撥款。',
      requires_documents: requiresDocuments,
    })
  } catch (error) {
    console.error('API 錯誤:', error)
    return NextResponse.json(
      { success: false, message: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/affiliate/withdraw
 * 取得提領記錄
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

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

    // 取得提領記錄
    const { data: withdrawals, error } = await supabase
      .from('affiliate_withdrawals')
      .select('*')
      .eq('affiliate_id', affiliate.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('查詢提領記錄失敗:', error)
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    const formattedData = withdrawals?.map((w) => ({
      id: w.id,
      withdrawal_amount: parseFloat(w.withdrawal_amount.toString()),
      tax_amount: parseFloat(w.tax_amount.toString()),
      net_amount: parseFloat(w.net_amount.toString()),
      status: w.status,
      created_at: w.created_at,
      processed_at: w.processed_at,
      completed_at: w.completed_at,
    }))

    return NextResponse.json({ data: formattedData })
  } catch (error) {
    console.error('API 錯誤:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
