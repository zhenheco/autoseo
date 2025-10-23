'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'

/**
 * 更新公司資訊
 */
export async function updateCompany(formData: FormData) {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }

  const companyId = formData.get('companyId') as string
  const companyName = formData.get('companyName') as string

  if (!companyId || !companyName) {
    redirect('/dashboard/settings?error=' + encodeURIComponent('缺少必要欄位'))
  }

  const supabase = await createClient()

  // 檢查使用者是否有權限編輯此公司
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .single()

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    redirect('/dashboard/settings?error=' + encodeURIComponent('您沒有權限編輯公司資訊'))
  }

  // 更新公司名稱
  const { error } = await supabase
    .from('companies')
    .update({ name: companyName })
    .eq('id', companyId)

  if (error) {
    redirect('/dashboard/settings?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/dashboard/settings')
  redirect('/dashboard/settings?success=' + encodeURIComponent('公司資訊已更新'))
}

/**
 * 邀請成員
 */
export async function inviteMember(formData: FormData) {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }

  const companyId = formData.get('companyId') as string
  const email = formData.get('email') as string
  const role = (formData.get('role') as string) || 'viewer'

  if (!companyId || !email) {
    redirect('/dashboard/settings?error=' + encodeURIComponent('缺少必要欄位'))
  }

  const supabase = await createClient()

  // 檢查使用者是否有權限邀請成員
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .single()

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    redirect('/dashboard/settings?error=' + encodeURIComponent('您沒有權限邀請成員'))
  }

  // TODO: 實際的邀請流程應該：
  // 1. 建立邀請記錄
  // 2. 發送邀請 Email
  // 3. 受邀者點擊連結後註冊/加入

  // 暫時簡化：假設受邀者已經註冊，直接將其加入公司
  // 實際應用中需要實作完整的邀請流程

  redirect('/dashboard/settings?info=' + encodeURIComponent('邀請功能即將推出'))
}

/**
 * 更新成員角色
 */
export async function updateMemberRole(formData: FormData) {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }

  const memberId = formData.get('memberId') as string
  const newRole = formData.get('role') as string

  if (!memberId || !newRole) {
    redirect('/dashboard/settings?error=' + encodeURIComponent('缺少必要欄位'))
  }

  const supabase = await createClient()

  // 取得該成員的資訊
  const { data: targetMember } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('id', memberId)
    .single()

  if (!targetMember) {
    redirect('/dashboard/settings?error=' + encodeURIComponent('找不到該成員'))
  }

  // 檢查當前使用者是否有權限修改角色
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', targetMember.company_id)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'owner') {
    redirect('/dashboard/settings?error=' + encodeURIComponent('只有擁有者可以修改成員角色'))
  }

  // 不允許修改擁有者的角色
  if (targetMember.role === 'owner') {
    redirect('/dashboard/settings?error=' + encodeURIComponent('無法修改擁有者的角色'))
  }

  // 更新角色
  const { error } = await supabase
    .from('company_members')
    .update({ role: newRole })
    .eq('id', memberId)

  if (error) {
    redirect('/dashboard/settings?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/dashboard/settings')
  redirect('/dashboard/settings?success=' + encodeURIComponent('成員角色已更新'))
}

/**
 * 移除成員
 */
export async function removeMember(formData: FormData) {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }

  const memberId = formData.get('memberId') as string

  if (!memberId) {
    redirect('/dashboard/settings?error=' + encodeURIComponent('缺少成員 ID'))
  }

  const supabase = await createClient()

  // 取得該成員的資訊
  const { data: targetMember } = await supabase
    .from('company_members')
    .select('company_id, role, user_id')
    .eq('id', memberId)
    .single()

  if (!targetMember) {
    redirect('/dashboard/settings?error=' + encodeURIComponent('找不到該成員'))
  }

  // 檢查當前使用者是否有權限移除成員
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', targetMember.company_id)
    .eq('user_id', user.id)
    .single()

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    redirect('/dashboard/settings?error=' + encodeURIComponent('您沒有權限移除成員'))
  }

  // 不允許移除擁有者
  if (targetMember.role === 'owner') {
    redirect('/dashboard/settings?error=' + encodeURIComponent('無法移除擁有者'))
  }

  // 不允許自己移除自己
  if (targetMember.user_id === user.id) {
    redirect('/dashboard/settings?error=' + encodeURIComponent('無法移除自己'))
  }

  // 將成員狀態設為 inactive
  const { error } = await supabase
    .from('company_members')
    .update({ status: 'inactive' })
    .eq('id', memberId)

  if (error) {
    redirect('/dashboard/settings?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/dashboard/settings')
  redirect('/dashboard/settings?success=' + encodeURIComponent('成員已移除'))
}
