'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'

/**
 * 建立文章生成任務
 */
export async function createArticle(formData: FormData) {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }

  const companyId = formData.get('companyId') as string
  const websiteId = formData.get('websiteId') as string
  const inputType = formData.get('inputType') as string

  if (!companyId || !websiteId || !inputType) {
    redirect('/dashboard/articles/new?error=' + encodeURIComponent('缺少必要欄位'))
  }

  const supabase = await createClient()

  // 檢查使用者權限
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    redirect('/dashboard/articles?error=' + encodeURIComponent('您沒有權限生成文章'))
  }

  // 取得網站資訊
  const { data: website } = await supabase
    .from('website_configs')
    .select('*')
    .eq('id', websiteId)
    .single()

  if (!website) {
    redirect('/dashboard/articles/new?error=' + encodeURIComponent('找不到指定的網站'))
  }

  // 根據輸入方式處理
  let articles: any[] = []

  if (inputType === 'keyword') {
    const keyword = formData.get('keyword') as string
    if (!keyword) {
      redirect('/dashboard/articles/new?error=' + encodeURIComponent('請輸入關鍵字'))
    }

    articles.push({
      company_id: companyId,
      website_id: websiteId,
      input_type: 'keyword',
      input_content: { keyword },
      article_title: `${keyword} - SEO 文章`,
      status: 'pending',
      scheduled_time: new Date().toISOString(),
    })
  } else if (inputType === 'url') {
    const url = formData.get('url') as string
    if (!url) {
      redirect('/dashboard/articles/new?error=' + encodeURIComponent('請輸入 URL'))
    }

    // 驗證 URL 格式
    try {
      new URL(url)
    } catch {
      redirect('/dashboard/articles/new?error=' + encodeURIComponent('無效的 URL 格式'))
    }

    articles.push({
      company_id: companyId,
      website_id: websiteId,
      input_type: 'url',
      input_content: { url },
      article_title: `URL 參考文章`,
      status: 'pending',
      scheduled_time: new Date().toISOString(),
    })
  } else if (inputType === 'batch') {
    const keywords = formData.get('keywords') as string
    if (!keywords) {
      redirect('/dashboard/articles/new?error=' + encodeURIComponent('請輸入關鍵字列表'))
    }

    const keywordList = keywords.split('\n').map(k => k.trim()).filter(k => k.length > 0)

    if (keywordList.length === 0) {
      redirect('/dashboard/articles/new?error=' + encodeURIComponent('請至少輸入一個關鍵字'))
    }

    if (keywordList.length > 10) {
      redirect('/dashboard/articles/new?error=' + encodeURIComponent('最多只能輸入 10 個關鍵字'))
    }

    articles = keywordList.map(keyword => ({
      company_id: companyId,
      website_id: websiteId,
      input_type: 'keyword',
      input_content: { keyword },
      article_title: `${keyword} - SEO 文章`,
      status: 'pending',
      scheduled_time: new Date().toISOString(),
    }))
  }

  // 插入文章任務
  const { data: insertedArticles, error: insertError } = await supabase
    .from('article_jobs')
    .insert(articles)
    .select()

  if (insertError) {
    redirect('/dashboard/articles/new?error=' + encodeURIComponent(insertError.message))
  }

  // TODO: 觸發 N8N Workflow
  // 這裡應該呼叫 N8N webhook 來處理文章生成
  // const n8nWebhookUrl = process.env.N8N_WEBHOOK_BASE_URL
  // for (const article of insertedArticles) {
  //   await fetch(`${n8nWebhookUrl}/article-generation`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({
  //       articleId: article.id,
  //       websiteId: article.website_id,
  //       inputType: article.input_type,
  //       inputContent: article.input_content,
  //     }),
  //   })
  // }

  revalidatePath('/dashboard/articles')
  redirect(
    `/dashboard/articles?success=${encodeURIComponent(
      articles.length === 1 ? '文章已加入生成佇列' : `${articles.length} 篇文章已加入生成佇列`
    )}`
  )
}
