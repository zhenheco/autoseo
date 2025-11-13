import { NextResponse } from 'next/server'
import { sendCompanyInvitationEmail } from '@/lib/email'

export async function GET() {
  try {
    const success = await sendCompanyInvitationEmail({
      toEmail: 'acejou27@gmail.com',
      companyName: '測試公司',
      inviterName: 'Claude測試',
      role: 'editor',
      inviteLink: 'http://localhost:3168/register?invitation=test123'
    })

    if (success) {
      return NextResponse.json({ message: '✅ 郵件發送成功' })
    } else {
      return NextResponse.json({ error: '❌ 郵件發送失敗' }, { status: 500 })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
