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
    console.log('='.repeat(80))
    console.log('[Payment Callback] 收到回調請求 - Method:', request.method)
    console.log('[Payment Callback] URL:', request.url)
    console.log('[Payment Callback] Headers:', Object.fromEntries(request.headers.entries()))

    const params: Record<string, string> = {}
    let tradeInfo: string | null = null
    let tradeSha: string | null = null
    let period: string | null = null
    let status: string | null = null
    let message: string | null = null

    if (request.method === 'GET') {
      const searchParams = request.nextUrl.searchParams
      searchParams.forEach((value, key) => {
        params[key] = value
      })
      tradeInfo = searchParams.get('TradeInfo') || searchParams.get('tradeInfo')
      tradeSha = searchParams.get('TradeSha') || searchParams.get('tradeSha')
      period = searchParams.get('Period') || searchParams.get('period')
      status = searchParams.get('Status') || searchParams.get('status')
      message = searchParams.get('Message') || searchParams.get('message')
    } else {
      const formData = await request.formData()
      formData.forEach((value, key) => {
        params[key] = value.toString()
      })
      tradeInfo = formData.get('TradeInfo') as string || formData.get('tradeInfo') as string
      tradeSha = formData.get('TradeSha') as string || formData.get('tradeSha') as string
      period = formData.get('Period') as string || formData.get('period') as string
      status = formData.get('Status') as string || formData.get('status') as string
      message = formData.get('Message') as string || formData.get('message') as string
    }

    console.log('[Payment Callback] 解析結果:', {
      hasTradeInfo: !!tradeInfo,
      hasTradeSha: !!tradeSha,
      hasPeriod: !!period,
      status,
      message,
      allParams: Object.keys(params),
      fullParams: params  // 記錄所有參數的完整內容
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // 定期定額授權使用 Period 參數，一般付款使用 TradeInfo/TradeSha
    const isPeriodCallback = !!period
    const isTradeCallback = !!tradeInfo && !!tradeSha

    // 只在一般付款時檢查 Status，定期定額授權不檢查（因為 ReturnURL 可能不帶 Status）
    if (!isPeriodCallback && status && status !== 'SUCCESS' && status !== '1') {
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

    if (!isPeriodCallback && !isTradeCallback) {
      console.error('[Payment Callback] 缺少必要參數')
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

    // 解密獲取 orderNo
    const supabase = await createClient()
    const paymentService = PaymentService.createInstance(supabase)

    try {
      let orderNo: string
      let decryptedData: Record<string, unknown>

      if (isPeriodCallback) {
        // 定期定額授權回調
        console.log('[Payment Callback] 處理定期定額授權回調')
        decryptedData = paymentService.decryptPeriodCallback(period!)

        // 記錄完整解密資料（診斷用）
        console.log('[Payment Callback] 定期定額解密資料:', JSON.stringify(decryptedData, null, 2))

        // Period 回調的結構: { Status, Message, Result: { MerchantOrderNo, ... } }
        const result = (decryptedData as any).Result
        if (result && result.MerchantOrderNo) {
          orderNo = result.MerchantOrderNo as string
        } else {
          // 向後兼容：嘗試其他可能的欄位名稱
          orderNo = (decryptedData.MerOrderNo || decryptedData.PeriodNo || decryptedData.MandateNo) as string
        }

        if (!orderNo) {
          console.error('[Payment Callback] 無法從解密資料取得 orderNo')
          console.error('[Payment Callback] decryptedData 結構:', JSON.stringify(decryptedData, null, 2))
          throw new Error('無法取得訂單編號')
        }
      } else {
        // 一般付款回調
        console.log('[Payment Callback] 處理一般付款回調')
        decryptedData = paymentService.decryptTradeInfoForRecurring(tradeInfo!, tradeSha!)
        orderNo = (decryptedData.MerOrderNo || decryptedData.MerchantOrderNo) as string
      }

      console.log('[Payment Callback] 解密成功，orderNo:', orderNo)

      // 對於定期定額，等待 NotifyURL 處理完成（最多 10 秒）
      if (isPeriodCallback) {
        console.log('[Payment Callback] 等待 NotifyURL 處理完成...')

        for (let attempt = 1; attempt <= 5; attempt++) {
          const { data: mandate } = await supabase
            .from('recurring_mandates')
            .select('status')
            .eq('mandate_no', orderNo)
            .maybeSingle()

          if (mandate && mandate.status === 'active') {
            console.log(`[Payment Callback] NotifyURL 已完成 (嘗試 ${attempt}/5)`)
            const redirectUrl = `${baseUrl}/dashboard/billing?payment=success&orderNo=${encodeURIComponent(orderNo)}`
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

          console.log(`[Payment Callback] NotifyURL 尚未完成 (嘗試 ${attempt}/5)`)

          if (attempt < 5) {
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }

        console.log('[Payment Callback] NotifyURL 10 秒內未完成，前端繼續輪詢')
      }

      // 返回 pending 狀態，前端會輪詢訂單狀態
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
    console.error('='.repeat(80))
    console.error('[Payment Callback] 處理回調失敗 - 最外層 catch')
    console.error('[Payment Callback] 錯誤類型:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('[Payment Callback] 錯誤訊息:', error instanceof Error ? error.message : String(error))
    console.error('[Payment Callback] 錯誤堆疊:', error instanceof Error ? error.stack : '無堆疊資訊')
    console.error('='.repeat(80))
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
