import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{
    id: string
    memberId: string
  }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId, memberId } = await params
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

    if (!['owner', 'admin'].includes(currentMember.role)) {
      return NextResponse.json({ error: '沒有修改權限' }, { status: 403 })
    }

    const body = await request.json()
    const { role } = body

    if (!role) {
      return NextResponse.json({ error: '角色為必填' }, { status: 400 })
    }

    const validRoles = ['owner', 'admin', 'editor', 'writer', 'viewer']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: '無效的角色' }, { status: 400 })
    }

    const { data: targetMember } = await supabase
      .from('company_members')
      .select('role, user_id')
      .eq('id', memberId)
      .eq('company_id', companyId)
      .single()

    if (!targetMember) {
      return NextResponse.json({ error: '找不到此成員' }, { status: 404 })
    }

    if (currentMember.role === 'admin' && (role === 'owner' || targetMember.role === 'owner')) {
      return NextResponse.json({ error: '管理員無法修改擁有者角色' }, { status: 403 })
    }

    if (targetMember.user_id === user.id) {
      return NextResponse.json({ error: '無法修改自己的角色' }, { status: 400 })
    }

    const { error } = await supabase
      .from('company_members')
      .update({ role })
      .eq('id', memberId)
      .eq('company_id', companyId)

    if (error) {
      console.error('更新成員角色失敗:', error)
      return NextResponse.json({ error: '更新成員角色失敗' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('更新成員角色錯誤:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId, memberId } = await params
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

    if (!['owner', 'admin'].includes(currentMember.role)) {
      return NextResponse.json({ error: '沒有移除權限' }, { status: 403 })
    }

    const { data: targetMember } = await supabase
      .from('company_members')
      .select('role, user_id')
      .eq('id', memberId)
      .eq('company_id', companyId)
      .single()

    if (!targetMember) {
      return NextResponse.json({ error: '找不到此成員' }, { status: 404 })
    }

    if (currentMember.role === 'admin' && targetMember.role === 'owner') {
      return NextResponse.json({ error: '管理員無法移除擁有者' }, { status: 403 })
    }

    if (targetMember.user_id === user.id) {
      return NextResponse.json({ error: '無法移除自己' }, { status: 400 })
    }

    const { error } = await supabase
      .from('company_members')
      .delete()
      .eq('id', memberId)
      .eq('company_id', companyId)

    if (error) {
      console.error('移除成員失敗:', error)
      return NextResponse.json({ error: '移除成員失敗' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('移除成員錯誤:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
