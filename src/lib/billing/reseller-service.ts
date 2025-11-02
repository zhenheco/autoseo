import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export interface Reseller {
  id: string
  companyId: string
  commissionRate: number
  status: 'active' | 'suspended' | 'terminated'
  totalReferrals: number
  totalRevenue: number
  totalCommission: number
  notes: string | null
  createdAt: string
}

export interface Commission {
  id: string
  resellerId: string
  orderType: 'subscription' | 'token_package' | 'lifetime'
  orderId: string
  customerCompanyId: string
  orderAmount: number
  commissionRate: number
  commissionAmount: number
  status: 'pending' | 'approved' | 'paid' | 'rejected'
  paidAt: string | null
  notes: string | null
  createdAt: string
}

export class ResellerService {
  private supabase: ReturnType<typeof createClient<Database>>

  constructor(supabase: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabase
  }

  async getReseller(companyId: string): Promise<Reseller | null> {
    const { data, error } = await this.supabase
      .from('resellers')
      .select('*')
      .eq('company_id', companyId)
      .single<{
        id: string
        company_id: string
        commission_rate: string | number
        status: string
        total_referrals: number
        total_revenue: string | number
        total_commission: string | number
        notes: string | null
        created_at: string | null
      }>()

    if (error || !data) {
      return null
    }

    return {
      id: data.id,
      companyId: data.company_id,
      commissionRate: Number(data.commission_rate),
      status: data.status as 'active' | 'suspended' | 'terminated',
      totalReferrals: data.total_referrals,
      totalRevenue: Number(data.total_revenue),
      totalCommission: Number(data.total_commission),
      notes: data.notes,
      createdAt: data.created_at || '',
    }
  }

  async isReseller(companyId: string): Promise<boolean> {
    const reseller = await this.getReseller(companyId)
    return reseller !== null && reseller.status === 'active'
  }

  async createCommission(params: {
    resellerId: string
    orderType: 'subscription' | 'token_package' | 'lifetime'
    orderId: string
    customerCompanyId: string
    orderAmount: number
  }): Promise<{ success: boolean; commission?: Commission; error?: string }> {
    const { data: resellerData, error: resellerError } = await this.supabase
      .from('resellers')
      .select('commission_rate, status')
      .eq('id', params.resellerId)
      .single()

    if (resellerError || !resellerData) {
      return { success: false, error: '找不到經銷商' }
    }

    if (resellerData.status !== 'active') {
      return { success: false, error: '經銷商狀態不正常' }
    }

    const commissionRate = Number(resellerData.commission_rate)
    const commissionAmount = params.orderAmount * commissionRate

    const { data: commissionData, error: commissionError } = await this.supabase
      .from('commissions')
      .insert({
        reseller_id: params.resellerId,
        order_type: params.orderType,
        order_id: params.orderId,
        customer_company_id: params.customerCompanyId,
        order_amount: params.orderAmount,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        status: 'pending',
      })
      .select()
      .single<{
        id: string
        reseller_id: string
        order_type: string
        order_id: string
        customer_company_id: string
        order_amount: string | number
        commission_rate: string | number
        commission_amount: string | number
        status: string
        paid_at: string | null
        notes: string | null
        created_at: string | null
      }>()

    if (commissionError) {
      console.error('[ResellerService] 建立佣金記錄失敗:', commissionError)
      return { success: false, error: '建立佣金記錄失敗' }
    }

    return {
      success: true,
      commission: {
        id: commissionData.id,
        resellerId: commissionData.reseller_id,
        orderType: commissionData.order_type as 'subscription' | 'token_package' | 'lifetime',
        orderId: commissionData.order_id,
        customerCompanyId: commissionData.customer_company_id,
        orderAmount: Number(commissionData.order_amount),
        commissionRate: Number(commissionData.commission_rate),
        commissionAmount: Number(commissionData.commission_amount),
        status: commissionData.status as 'pending' | 'approved' | 'paid' | 'rejected',
        paidAt: commissionData.paid_at,
        notes: commissionData.notes,
        createdAt: commissionData.created_at || '',
      },
    }
  }

  async getCommissions(
    resellerId: string,
    options: {
      status?: 'pending' | 'approved' | 'paid' | 'rejected'
      limit?: number
      offset?: number
    } = {}
  ): Promise<Commission[]> {
    let query = this.supabase
      .from('commissions')
      .select('*')
      .eq('reseller_id', resellerId)
      .order('created_at', { ascending: false })

    if (options.status) {
      query = query.eq('status', options.status)
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('[ResellerService] 查詢佣金記錄失敗:', error)
      return []
    }

    type CommissionRow = {
      id: string
      reseller_id: string
      order_type: string
      order_id: string
      customer_company_id: string
      order_amount: string | number
      commission_rate: string | number
      commission_amount: string | number
      status: string
      paid_at: string | null
      notes: string | null
      created_at: string | null
    }

    return ((data || []) as CommissionRow[]).map(c => ({
      id: c.id,
      resellerId: c.reseller_id,
      orderType: c.order_type as 'subscription' | 'token_package' | 'lifetime',
      orderId: c.order_id,
      customerCompanyId: c.customer_company_id,
      orderAmount: Number(c.order_amount),
      commissionRate: Number(c.commission_rate),
      commissionAmount: Number(c.commission_amount),
      status: c.status as 'pending' | 'approved' | 'paid' | 'rejected',
      paidAt: c.paid_at,
      notes: c.notes,
      createdAt: c.created_at || '',
    }))
  }

  async approveCommission(
    commissionId: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.supabase
      .from('commissions')
      .update({
        status: 'approved',
        notes: notes || null,
      })
      .eq('id', commissionId)
      .eq('status', 'pending')

    if (error) {
      console.error('[ResellerService] 核准佣金失敗:', error)
      return { success: false, error: '核准佣金失敗' }
    }

    return { success: true }
  }

  async payCommission(
    commissionId: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.supabase
      .from('commissions')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq('id', commissionId)
      .eq('status', 'approved')

    if (error) {
      console.error('[ResellerService] 支付佣金失敗:', error)
      return { success: false, error: '支付佣金失敗' }
    }

    return { success: true }
  }

  async rejectCommission(
    commissionId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.supabase
      .from('commissions')
      .update({
        status: 'rejected',
        notes: reason,
      })
      .eq('id', commissionId)
      .eq('status', 'pending')

    if (error) {
      console.error('[ResellerService] 拒絕佣金失敗:', error)
      return { success: false, error: '拒絕佣金失敗' }
    }

    return { success: true }
  }

  async getTotalEarnings(resellerId: string): Promise<{
    pending: number
    approved: number
    paid: number
    total: number
  }> {
    const { data, error } = await this.supabase
      .from('commissions')
      .select('status, commission_amount')
      .eq('reseller_id', resellerId)

    if (error) {
      console.error('[ResellerService] 查詢收益失敗:', error)
      return { pending: 0, approved: 0, paid: 0, total: 0 }
    }

    const earnings = {
      pending: 0,
      approved: 0,
      paid: 0,
      total: 0,
    }

    for (const commission of data || []) {
      const amount = Number(commission.commission_amount)
      if (commission.status === 'pending') {
        earnings.pending += amount
      } else if (commission.status === 'approved') {
        earnings.approved += amount
      } else if (commission.status === 'paid') {
        earnings.paid += amount
      }
      earnings.total += amount
    }

    return earnings
  }
}
