import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PaymentService } from '@/lib/payment/payment-service'

// 處理 GET 請求（藍新金流使用 GET 重定向）
export async function GET(request: NextRequest) {
  return handleCallback(request)
}

// 處理 POST 請求（以防萬一藍新金流改用 POST）
export async function POST(request: NextRequest) {
  return handleCallback(request)
}

async function handleCallback(request: NextRequest) {
  try {
    console.log('[Payment Callback] 收到回調請求 - Method:', request.method)
    console.log('[Payment Callback] URL:', request.url)

    const params: Record<string, string> = {}
    let tradeInfo: string | null = null
    let tradeSha: string | null = null
    let status: string | null = null
    let message: string | null = null

    if (request.method === 'GET') {
      const searchParams = request.nextUrl.searchParams
      searchParams.forEach((value, key) => {
        params[key] = value
      })
      tradeInfo = searchParams.get('TradeInfo') || searchParams.get('tradeInfo')
      tradeSha = searchParams.get('TradeSha') || searchParams.get('tradeSha')
      status = searchParams.get('Status') || searchParams.get('status')
      message = searchParams.get('Message') || searchParams.get('message')
    } else {
      const formData = await request.formData()
      formData.forEach((value, key) => {
        params[key] = value.toString()
      })
      tradeInfo = formData.get('TradeInfo') as string || formData.get('tradeInfo') as string
      tradeSha = formData.get('TradeSha') as string || formData.get('tradeSha') as string
      status = formData.get('Status') as string || formData.get('status') as string
      message = formData.get('Message') as string || formData.get('message') as string
    }

    console.log('[Payment Callback] 解析結果:', { hasTradeInfo: !!tradeInfo, hasTradeSha: !!tradeSha, status, message })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // 如果有錯誤狀態，直接返回錯誤
    if (status && status !== 'SUCCESS' && status !== '1') {
      console.error('[Payment Callback] 付款失敗，狀態:', status, '訊息:', message)
      const redirectUrl = `${baseUrl}/dashboard/billing?payment=failed&error=${encodeURIComponent(message || '付款失敗')}`
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

    if (!tradeInfo || !tradeSha) {
      console.error('[Payment Callback] 缺少 TradeInfo 或 TradeSha')
      const redirectUrl = Object.keys(params).length === 0
        ? `${baseUrl}/dashboard/billing`
        : `${baseUrl}/dashboard/billing?payment=error`
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

    // 解密 TradeInfo 獲取 orderNo，但不查詢訂單
    const supabase = await createClient()
    const paymentService = PaymentService.createInstance(supabase)

    try {
      const decryptedData = paymentService.decryptTradeInfoForRecurring(tradeInfo, tradeSha)
      const orderNo = decryptedData.MerchantOrderNo as string

      console.log('[Payment Callback] 解密成功，立即重定向:', { orderNo, status: decryptedData.Status })

      // 立即返回，不等待訂單查詢
      // 前端會輪詢訂單狀態
      const redirectUrl = `${baseUrl}/dashboard/billing?payment=pending&orderNo=${encodeURIComponent(orderNo)}`

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
      console.error('[Payment Callback] 解密失敗:', error)
      const redirectUrl = `${baseUrl}/dashboard/billing?payment=error`
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
  } catch (error) {
    console.error('[Payment Callback] 處理回調失敗:', error)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUrl = `${baseUrl}/dashboard/billing?payment=error`
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
