'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'

/**
 * 更新帳戶資訊
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

  // 檢查使用者是否有權限編輯
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'owner') {
    redirect('/dashboard/settings?error=' + encodeURIComponent('您沒有權限編輯帳戶資訊'))
  }

  // 更新帳戶名稱
  const { error } = await supabase
    .from('companies')
    .update({ name: companyName })
    .eq('id', companyId)

  if (error) {
    redirect('/dashboard/settings?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/dashboard/settings')
  redirect('/dashboard/settings?success=' + encodeURIComponent('帳戶資訊已更新'))
}
