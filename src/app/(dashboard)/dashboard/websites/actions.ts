'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'

/**
 * 刪除 WordPress 網站
 */
export async function deleteWebsite(formData: FormData) {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }

  const websiteId = formData.get('websiteId') as string

  if (!websiteId) {
    redirect('/dashboard/websites?error=' + encodeURIComponent('缺少網站 ID'))
  }

  const supabase = await createClient()

  // 取得網站資訊以檢查權限
  const { data: website } = await supabase
    .from('website_configs')
    .select('company_id')
    .eq('id', websiteId)
    .single()

  if (!website) {
    redirect('/dashboard/websites?error=' + encodeURIComponent('找不到該網站'))
  }

  // 檢查使用者是否有權限刪除
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', website.company_id)
    .eq('user_id', user.id)
    .single()

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    redirect('/dashboard/websites?error=' + encodeURIComponent('您沒有權限刪除網站'))
  }

  // 刪除網站
  const { error } = await supabase
    .from('website_configs')
    .delete()
    .eq('id', websiteId)

  if (error) {
    redirect('/dashboard/websites?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/dashboard/websites')
  redirect('/dashboard/websites?success=' + encodeURIComponent('網站已刪除'))
}

/**
 * 更新 Brand Voice 設定
 */
export async function updateBrandVoice(formData: FormData) {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }

  const websiteId = formData.get('websiteId') as string
  const toneOfVoice = formData.get('toneOfVoice') as string
  const targetAudience = formData.get('targetAudience') as string
  const keywords = formData.get('keywords') as string

  if (!websiteId) {
    redirect('/dashboard/websites?error=' + encodeURIComponent('缺少網站 ID'))
  }

  const supabase = await createClient()

  // 建立 brand_voice JSON 物件
  const brandVoice = {
    tone_of_voice: toneOfVoice || '',
    target_audience: targetAudience || '',
    keywords: keywords ? keywords.split(',').map(k => k.trim()) : [],
  }

  // 更新網站的 brand_voice
  const { error } = await supabase
    .from('website_configs')
    .update({ brand_voice: brandVoice })
    .eq('id', websiteId)

  if (error) {
    redirect('/dashboard/websites?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/dashboard/websites')
  redirect('/dashboard/websites?success=' + encodeURIComponent('Brand Voice 已更新'))
}
