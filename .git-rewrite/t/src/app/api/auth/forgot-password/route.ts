import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: '請提供電子郵件地址' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://seo.zhenhe-dm.com'}/reset-password`,
    })

    if (error) {
      console.error('Reset password error:', error)
      return NextResponse.json(
        { error: '發送重設密碼郵件失敗' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: '密碼重設郵件已發送' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Forgot password API error:', error)
    return NextResponse.json(
      { error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
