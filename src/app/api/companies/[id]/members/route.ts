import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendCompanyInvitationEmail } from '@/lib/email'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { data: currentMember } = await supabase
      .from('company_members')
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .single()

    if (!currentMember) {
      return NextResponse.json({ error: '您不是此公司的成員' }, { status: 403 })
    }

    const canInvite = ['owner', 'admin'].includes(currentMember.role) ||
      (currentMember.role === 'editor' && ['writer', 'viewer'].includes(currentMember.role))

    if (!canInvite) {
      return NextResponse.json({ error: '沒有邀請權限' }, { status: 403 })
    }

    const body = await request.json()
    const { email, role } = body

    if (!email || !role) {
      return NextResponse.json({ error: '電子郵件和角色為必填' }, { status: 400 })
    }

    const validRoles = ['admin', 'editor', 'writer', 'viewer']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: '無效的角色' }, { status: 400 })
    }

    if (currentMember.role === 'admin' && role === 'admin') {
      return NextResponse.json({ error: '管理員無法邀請其他管理員' }, { status: 403 })
    }

    if (currentMember.role === 'editor' && !['writer', 'viewer'].includes(role)) {
      return NextResponse.json({ error: '編輯者只能邀請 Writer 或 Viewer' }, { status: 403 })
    }

    // 使用 Admin API 查詢 auth.users
    const adminClient = createAdminClient()
    const { data: { users: authUsers }, error: getUserError } = await adminClient.auth.admin.listUsers()

    if (getUserError) {
      console.error('查詢使用者失敗:', getUserError)
    }

    const inviteeUser = authUsers?.find(u => u.email === email)

    let userId: string | null = null
    let memberStatus: 'active' | 'pending' = 'pending'

    if (inviteeUser) {
      userId = inviteeUser.id
      memberStatus = 'active'

      const { data: existingMember } = await supabase
        .from('company_members')
        .select('id')
        .eq('company_id', companyId)
        .eq('user_id', userId)
        .maybeSingle()

      if (existingMember) {
        return NextResponse.json({ error: '此使用者已是公司成員' }, { status: 400 })
      }
    }

    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single()

    const invitationData = {
      company_id: companyId,
      user_id: userId,
      invited_email: !inviteeUser ? email : null,
      role,
      status: memberStatus,
      invited_by: user.id,
      invited_at: new Date().toISOString(),
      joined_at: memberStatus === 'active' ? new Date().toISOString() : null,
    }

    const { data: newMember, error } = await adminClient
      .from('company_members')
      .insert(invitationData)
      .select()
      .single()

    if (error) {
      console.error('邀請成員失敗:', error)
      return NextResponse.json({ error: '邀請成員失敗' }, { status: 500 })
    }

    if (!inviteeUser) {
      const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/register?invitation=${newMember.id}&email=${encodeURIComponent(email)}`

      // 使用當前登入使用者的 email (已從 auth.getUser() 取得)
      const emailSent = await sendCompanyInvitationEmail({
        toEmail: email,
        companyName: company?.name || '',
        inviterName: user.email || '團隊成員',
        role,
        inviteLink,
      })

      if (!emailSent) {
        console.error('郵件發送失敗，但邀請已創建')
      }
    }

    return NextResponse.json(
      {
        ...newMember,
        message: inviteeUser
          ? '成員已成功加入公司'
          : `邀請已發送至 ${email}，待用戶註冊後生效`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('邀請成員錯誤:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
