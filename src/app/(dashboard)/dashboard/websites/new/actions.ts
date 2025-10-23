'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'

/**
 * 新增 WordPress 網站
 */
export async function createWebsite(formData: FormData) {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }

  const companyId = formData.get('companyId') as string
  const siteName = formData.get('siteName') as string
  const siteUrl = formData.get('siteUrl') as string
  const wpUsername = formData.get('wpUsername') as string
  const wpPassword = formData.get('wpPassword') as string

  if (!companyId || !siteName || !siteUrl || !wpUsername || !wpPassword) {
    redirect('/dashboard/websites/new?error=' + encodeURIComponent('缺少必要欄位'))
  }

  // 檢查 URL 格式
  try {
    new URL(siteUrl)
  } catch {
    redirect('/dashboard/websites/new?error=' + encodeURIComponent('無效的網站 URL'))
  }

  const supabase = await createClient()

  // 檢查使用者是否有權限新增網站
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    redirect('/dashboard/websites?error=' + encodeURIComponent('您沒有權限新增網站'))
  }

  // TODO: 驗證 WordPress 連線
  // 這裡應該測試 WordPress REST API 連線是否成功

  // 建立網站記錄
  const { error } = await supabase
    .from('website_configs')
    .insert({
      company_id: companyId,
      site_name: siteName,
      site_url: siteUrl.replace(/\/$/, ''), // 移除尾部斜線
      wp_username: wpUsername,
      wp_app_password: wpPassword, // TODO: 應該加密儲存
      is_active: true,
      cname_verified: false,
    })

  if (error) {
    redirect('/dashboard/websites/new?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/dashboard/websites')
  redirect('/dashboard/websites?success=' + encodeURIComponent('網站已成功新增'))
}
