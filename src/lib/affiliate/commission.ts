/**
 * 聯盟行銷佣金計算邏輯
 */

import { createClient } from '@supabase/supabase-js'
import { COMMISSION_RATE, LOCK_PERIOD_DAYS } from '@/types/affiliate.types'

interface PaymentOrder {
  id: string
  company_id: string
  order_type: string
  payment_type: 'subscription' | 'token_package' | 'lifetime'
  amount: number
  paid_at: string
}

interface CalculateCommissionParams {
  supabaseUrl: string
  supabaseServiceKey: string
  paymentOrder: PaymentOrder
  mandateId?: string
}

/**
 * 計算並創建佣金記錄
 */
export async function calculateAndCreateCommission({
  supabaseUrl,
  supabaseServiceKey,
  paymentOrder,
  mandateId,
}: CalculateCommissionParams): Promise<{
  success: boolean
  commission_id?: string
  message?: string
}> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. 檢查是否為訂閱付款（不包含 Credit 包）
    if (paymentOrder.payment_type !== 'subscription') {
      return {
        success: false,
        message: 'Credit 包不計算佣金',
      }
    }

    // 2. 查詢該公司是否由聯盟夥伴推薦
    const { data: company } = await supabase
      .from('companies')
      .select('referred_by_affiliate_code')
      .eq('id', paymentOrder.company_id)
      .single()

    if (!company || !company.referred_by_affiliate_code) {
      return {
        success: false,
        message: '該公司無推薦碼',
      }
    }

    const affiliateCode = company.referred_by_affiliate_code

    // 3. 查詢聯盟夥伴
    const { data: affiliate } = await supabase
      .from('affiliates')
      .select('*')
      .eq('affiliate_code', affiliateCode)
      .single()

    if (!affiliate) {
      return {
        success: false,
        message: '找不到聯盟夥伴',
      }
    }

    // 4. 檢查聯盟夥伴狀態
    if (affiliate.status !== 'active') {
      // 如果是 inactive，檢查是否可以重新啟動
      if (affiliate.status === 'inactive') {
        // 有新客戶付款，重新啟動
        await supabase
          .from('affiliates')
          .update({
            status: 'active',
            inactive_since: null,
            last_active_payment_at: paymentOrder.paid_at,
          })
          .eq('id', affiliate.id)

        console.log(`聯盟夥伴 ${affiliateCode} 已重新啟動`)
      } else {
        return {
          success: false,
          message: `聯盟夥伴狀態為 ${affiliate.status}，無法計算佣金`,
        }
      }
    } else {
      // 5. 檢查是否超過 3 個月無活動
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

      if (
        affiliate.last_active_payment_at &&
        new Date(affiliate.last_active_payment_at) < threeMonthsAgo
      ) {
        // 超過 3 個月，但這次有新付款，所以重新啟動
        console.log(`聯盟夥伴 ${affiliateCode} 超過 3 個月無活動，但有新付款，重新計算佣金`)
      }
    }

    // 6. 查詢或創建推薦記錄
    let { data: referral } = await supabase
      .from('affiliate_referrals')
      .select('*')
      .eq('affiliate_id', affiliate.id)
      .eq('referred_company_id', paymentOrder.company_id)
      .single()

    if (!referral) {
      // 創建推薦記錄
      const { data: newReferral, error: referralError } = await supabase
        .from('affiliate_referrals')
        .insert({
          affiliate_id: affiliate.id,
          referred_company_id: paymentOrder.company_id,
          affiliate_code: affiliateCode,
          first_payment_at: paymentOrder.paid_at,
          first_payment_amount: paymentOrder.amount,
          total_payments: 1,
          lifetime_value: paymentOrder.amount,
        })
        .select()
        .single()

      if (referralError) {
        console.error('創建推薦記錄失敗:', referralError)
        return {
          success: false,
          message: '創建推薦記錄失敗',
        }
      }

      referral = newReferral
    } else {
      // 更新推薦記錄
      await supabase
        .from('affiliate_referrals')
        .update({
          total_payments: referral.total_payments + 1,
          lifetime_value: parseFloat(referral.lifetime_value.toString()) + paymentOrder.amount,
          last_payment_at: paymentOrder.paid_at,
          is_active: true,
        })
        .eq('id', referral.id)
    }

    // 7. 計算佣金
    const commissionAmount = paymentOrder.amount * (COMMISSION_RATE / 100)
    const taxRate = parseFloat(affiliate.tax_rate.toString())
    const taxAmount = commissionAmount * (taxRate / 100)
    const netCommission = commissionAmount - taxAmount

    // 8. 計算解鎖時間（30天後）
    const earnedAt = new Date(paymentOrder.paid_at)
    const unlockAt = new Date(earnedAt)
    unlockAt.setDate(unlockAt.getDate() + LOCK_PERIOD_DAYS)

    // 9. 創建佣金記錄
    const { data: commission, error: commissionError } = await supabase
      .from('affiliate_commissions')
      .insert({
        affiliate_id: affiliate.id,
        referral_id: referral.id,
        payment_order_id: paymentOrder.id,
        mandate_id: mandateId || null,
        order_amount: paymentOrder.amount,
        commission_rate: COMMISSION_RATE,
        commission_amount: commissionAmount,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        net_commission: netCommission,
        earned_at: earnedAt.toISOString(),
        unlock_at: unlockAt.toISOString(),
        status: 'locked',
      })
      .select()
      .single()

    if (commissionError) {
      console.error('創建佣金記錄失敗:', commissionError)
      return {
        success: false,
        message: '創建佣金記錄失敗',
      }
    }

    // 10. 更新聯盟夥伴統計
    await supabase
      .from('affiliates')
      .update({
        locked_commission:
          parseFloat(affiliate.locked_commission.toString()) + netCommission,
        lifetime_commission:
          parseFloat(affiliate.lifetime_commission.toString()) + netCommission,
        last_active_payment_at: paymentOrder.paid_at,
      })
      .eq('id', affiliate.id)

    // 11. 更新推薦記錄的累計佣金
    await supabase
      .from('affiliate_referrals')
      .update({
        total_commission_generated:
          parseFloat(referral.total_commission_generated?.toString() || '0') + commissionAmount,
      })
      .eq('id', referral.id)

    // 12. 記錄追蹤事件
    await supabase.from('affiliate_tracking_logs').insert({
      affiliate_code: affiliateCode,
      event_type: 'payment',
      company_id: paymentOrder.company_id,
      metadata: {
        payment_order_id: paymentOrder.id,
        commission_id: commission.id,
        commission_amount: commissionAmount,
        net_commission: netCommission,
      },
    })

    console.log(
      `✅ 佣金計算成功: ${affiliateCode} - NT$${netCommission.toFixed(2)} (訂單 ${
        paymentOrder.id
      })`
    )

    return {
      success: true,
      commission_id: commission.id,
      message: '佣金計算成功',
    }
  } catch (error) {
    console.error('佣金計算錯誤:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '未知錯誤',
    }
  }
}

/**
 * 檢查並更新不活躍的聯盟夥伴
 * （由 Cron Job 呼叫）
 */
export async function checkInactiveAffiliates(supabaseUrl: string, supabaseServiceKey: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const { data: affiliates, error } = await supabase
    .from('affiliates')
    .select('id, affiliate_code, last_active_payment_at')
    .eq('status', 'active')
    .or(`last_active_payment_at.is.null,last_active_payment_at.lt.${threeMonthsAgo.toISOString()}`)

  if (error) {
    console.error('查詢不活躍聯盟夥伴失敗:', error)
    return
  }

  if (affiliates && affiliates.length > 0) {
    const ids = affiliates.map((a) => a.id)

    const { error: updateError } = await supabase
      .from('affiliates')
      .update({
        status: 'inactive',
        inactive_since: new Date().toISOString(),
      })
      .in('id', ids)

    if (updateError) {
      console.error('更新不活躍聯盟夥伴失敗:', updateError)
    } else {
      console.log(`✅ 已將 ${affiliates.length} 個聯盟夥伴設為不活躍`)
    }
  }
}
