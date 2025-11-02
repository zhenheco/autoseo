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
    console.log('[Recurring Callback] 收到回調請求 - Method:', request.method)
    console.log('[Recurring Callback] URL:', request.url)
    console.log('[Recurring Callback] Headers:', Object.fromEntries(request.headers.entries()))

    const supabase = await createClient()
    const params: Record<string, string> = {}
    let period: string | null = null
    let tradeInfo: string | null = null
    let tradeSha: string | null = null
    let status: string | null = null
    let message: string | null = null

    if (request.method === 'GET') {
      // GET 請求：從 URL 參數獲取
      const searchParams = request.nextUrl.searchParams
      console.log('[Recurring Callback] URL 參數列表:')
      searchParams.forEach((value, key) => {
        console.log(`  ${key}: ${value}`)
        params[key] = value
      })

      // 嘗試多種可能的參數名稱
      // 注意：藍新金流可能返回 Result（加密資料）而不是 Period
      period = searchParams.get('Period') ||
               searchParams.get('period') ||
               searchParams.get('Result') ||      // 藍新金流錯誤時返回的加密資料
               searchParams.get('result') ||
               searchParams.get('PeriodData') ||
               searchParams.get('periodData')

      // 也可能是一般的 TradeInfo 格式
      tradeInfo = searchParams.get('TradeInfo') || searchParams.get('tradeInfo')
      tradeSha = searchParams.get('TradeSha') || searchParams.get('tradeSha')

      // 狀態和訊息
      status = searchParams.get('Status') || searchParams.get('status')
      message = searchParams.get('Message') || searchParams.get('message')
    } else {
      // POST 請求：從 FormData 獲取
      const formData = await request.formData()
      console.log('[Recurring Callback] FormData 參數列表:')
      formData.forEach((value, key) => {
        console.log(`  ${key}: ${value.toString()}`)
        params[key] = value.toString()
      })

      period = formData.get('Period') as string ||
               formData.get('period') as string ||
               formData.get('Result') as string ||      // 藍新金流錯誤時返回的加密資料
               formData.get('result') as string ||
               formData.get('PeriodData') as string ||
               formData.get('periodData') as string

      tradeInfo = formData.get('TradeInfo') as string || formData.get('tradeInfo') as string
      tradeSha = formData.get('TradeSha') as string || formData.get('tradeSha') as string

      status = formData.get('Status') as string || formData.get('status') as string
      message = formData.get('Message') as string || formData.get('message') as string
    }

    console.log('[Recurring Callback] 解析結果:')
    console.log('  Period:', period ? `${period.substring(0, 50)}...` : 'null')
    console.log('  TradeInfo:', tradeInfo ? `${tradeInfo.substring(0, 50)}...` : 'null')
    console.log('  TradeSha:', tradeSha ? `${tradeSha.substring(0, 50)}...` : 'null')
    console.log('  Status:', status)
    console.log('  Message:', message)
    console.log('[Recurring Callback] 所有參數:', params)

    // 如果有錯誤狀態，直接返回錯誤
    if (status && status !== 'SUCCESS' && status !== '1') {
      console.error('[Recurring Callback] 付款失敗，狀態:', status, '訊息:', message)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const redirectUrl = `${baseUrl}/dashboard/billing?subscription=failed&error=${encodeURIComponent(message || '付款失敗')}`
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

    // 檢查是否有任何可用的參數
    if (!period && !tradeInfo) {
      console.error('[Recurring Callback] 缺少 Period 或 TradeInfo 參數')
      console.error('[Recurring Callback] 收到的所有參數:', params)

      // 如果完全沒有參數，可能是用戶直接訪問此 URL
      if (Object.keys(params).length === 0) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const redirectUrl = `${baseUrl}/dashboard/billing`
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

      return NextResponse.json(
        {
          error: '缺少必要參數',
          receivedParams: params,
          debug: {
            hasperiod: !!period,
            hasTradeInfo: !!tradeInfo,
            paramCount: Object.keys(params).length
          }
        },
        { status: 400 }
      )
    }

    const paymentService = PaymentService.createInstance(supabase)

    // 如果有 Period 參數，使用定期定額回調處理
    if (period) {
      console.log('[Recurring Callback] 處理 Period 參數')
      const result = await paymentService.handleRecurringCallback(period)

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      let redirectUrl: string

      if (result.success) {
        redirectUrl = `${baseUrl}/dashboard/billing?subscription=success`
      } else {
        redirectUrl = `${baseUrl}/dashboard/billing?subscription=failed&error=${encodeURIComponent(result.error || '訂閱失敗')}`
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
    }

    // 如果有 TradeInfo 參數，可能是一般付款回調格式
    if (tradeInfo && tradeSha) {
      console.log('[Recurring Callback] 處理 TradeInfo 參數')

      try {
        // 解密 TradeInfo
        const decryptedData = paymentService.decryptTradeInfoForRecurring(tradeInfo, tradeSha)
        console.log('[Recurring Callback] 解密資料:', decryptedData)

        // 檢查是否為定期定額成功
        if (decryptedData.Status === 'SUCCESS' || decryptedData.Status === '1') {
          // 建立訂閱記錄
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            throw new Error('未找到用戶')
          }

          const subscription = {
            user_id: user.id,
            plan_id: decryptedData.MerOrderNo || decryptedData.MerchantOrderNo, // 訂單編號包含計劃資訊
            period_no: decryptedData.PeriodNo || decryptedData.TradeNo, // 委託編號
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          const { error: dbError } = await supabase
            .from('subscriptions')
            .insert(subscription)

          if (dbError) {
            console.error('[Recurring Callback] 資料庫錯誤:', dbError)
            throw dbError
          }

          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const redirectUrl = `${baseUrl}/dashboard/billing?subscription=success`
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
        } else {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const redirectUrl = `${baseUrl}/dashboard/billing?subscription=failed&error=${encodeURIComponent(decryptedData.Message || '訂閱失敗')}`
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
        console.error('[Recurring Callback] 處理 TradeInfo 失敗:', error)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const redirectUrl = `${baseUrl}/dashboard/billing?subscription=error`
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
  } catch (error) {
    console.error('[API] 處理定期定額回調失敗:', error)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUrl = `${baseUrl}/dashboard/billing?subscription=error`
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
