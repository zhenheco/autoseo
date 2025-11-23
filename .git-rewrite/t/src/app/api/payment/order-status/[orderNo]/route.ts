import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database.types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> }
) {
  try {
    const { orderNo } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: '未授權' },
        { status: 401 }
      )
    }

    // 使用重試機制查詢訂單，應對 Supabase 複製延遲
    let orderData: Database['public']['Tables']['payment_orders']['Row'] | null = null
    let lastError: unknown = null

    // 重試 5 次，每次間隔 1 秒
    for (let attempt = 1; attempt <= 5; attempt++) {
      // 判斷是查詢一般訂單還是定期定額委託
      if (orderNo.startsWith('MAN')) {
        // 查詢 recurring_mandates 表
        const { data: mandate, error } = await supabase
          .from('recurring_mandates')
          .select('*, payment_orders!first_payment_order_id(*)')
          .eq('mandate_no', orderNo)
          .maybeSingle()

        if (mandate && !error && mandate.payment_orders) {
          orderData = mandate.payment_orders as Database['public']['Tables']['payment_orders']['Row']
          lastError = null
          console.log(`[Order Status API] 找到定期定額委託 (嘗試 ${attempt}/5):`, {
            mandateNo: orderNo,
            foundOrderNo: orderData.order_no,
            mandateStatus: mandate.status,
            orderStatus: orderData.status
          })
          break
        }

        lastError = error
        console.log(`[Order Status API] 查詢委託失敗 (嘗試 ${attempt}/5):`, { orderNo, error })
      } else {
        // 查詢 payment_orders 表
        const { data, error } = await supabase
          .from('payment_orders')
          .select<'*', Database['public']['Tables']['payment_orders']['Row']>('*')
          .eq('order_no', orderNo)
          .maybeSingle()

        if (data && !error) {
          orderData = data
          lastError = null
          console.log(`[Order Status API] 找到訂單 (嘗試 ${attempt}/5):`, {
            orderNo,
            status: data.status
          })
          break
        }

        lastError = error
        console.log(`[Order Status API] 查詢訂單失敗 (嘗試 ${attempt}/5):`, { orderNo, error })
      }

      if (attempt < 5) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    if (!orderData) {
      console.log('[Order Status API] 訂單尚未同步:', { orderNo, error: lastError })
      return NextResponse.json({
        synced: false,
        status: 'pending',
        message: '訂單正在處理中...'
      })
    }

    // 檢查訂單是否屬於用戶的公司
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('company_id', orderData.company_id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: '無權限查看此訂單' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      synced: true,
      order: {
        id: orderData.id,
        orderNo: orderData.order_no,
        status: orderData.status,
        amount: orderData.amount,
        description: orderData.item_description,
        newebpayStatus: orderData.newebpay_status,
        newebpayMessage: orderData.newebpay_message,
        createdAt: orderData.created_at,
        updatedAt: orderData.updated_at,
      }
    })
  } catch (error) {
    console.error('[Order Status API] 查詢訂單狀態失敗:', error)
    return NextResponse.json(
      { error: '查詢訂單狀態失敗' },
      { status: 500 }
    )
  }
}
