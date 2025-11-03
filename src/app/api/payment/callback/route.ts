import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PaymentService } from '@/lib/payment/payment-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const formData = await request.formData()
    const status = formData.get('Status') as string
    const tradeInfo = formData.get('TradeInfo') as string
    const tradeSha = formData.get('TradeSha') as string

    console.log('[API Callback] 收到 ReturnURL 回調:', {
      hasStatus: !!status,
      hasTradeInfo: !!tradeInfo,
      hasTradeSha: !!tradeSha,
      timestamp: new Date().toISOString()
    })

    if (!tradeInfo || !tradeSha) {
      console.error('[API Callback] 缺少必要參數')
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const redirectUrl = `${baseUrl}/dashboard/subscription?payment=failed&error=${encodeURIComponent('缺少必要參數')}`
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>處理中...</title>
</head>
<body>
  <script>
    window.location.href = "${redirectUrl}";
  </script>
</body>
</html>`,
        {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        }
      )
    }

    const paymentService = PaymentService.createInstance(supabase)

    const result = await paymentService.handleOnetimeCallback(tradeInfo, tradeSha)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    let redirectUrl: string

    if (result.success) {
      console.log('[API Callback] 付款處理成功')
      redirectUrl = `${baseUrl}/dashboard/subscription?payment=success`
    } else {
      console.error('[API Callback] 付款處理失敗:', result.error)
      redirectUrl = `${baseUrl}/dashboard/subscription?payment=failed&error=${encodeURIComponent(result.error || '支付失敗')}`
    }

    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>處理中...</title>
</head>
<body>
  <script>
    window.location.href = "${redirectUrl}";
  </script>
</body>
</html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    )
  } catch (error) {
    console.error('[API Callback] 處理支付回調失敗:', error)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUrl = `${baseUrl}/dashboard/subscription?payment=error`
    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>處理中...</title>
</head>
<body>
  <script>
    window.location.href = "${redirectUrl}";
  </script>
</body>
</html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    )
  }
}
