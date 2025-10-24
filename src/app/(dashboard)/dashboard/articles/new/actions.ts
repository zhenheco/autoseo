'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'

/**
 * 觸發 N8N Workflow 的函數
 */
async function triggerN8NWorkflow(article: any, website: any) {
  const n8nWebhookUrl = website.n8n_webhook_url || process.env.N8N_WEBHOOK_BASE_URL

  if (!n8nWebhookUrl) {
    throw new Error('N8N Webhook URL 未設定')
  }

  const payload = {
    // 文章資訊
    articleId: article.id,
    websiteId: article.website_id,
    companyId: article.company_id,

    // 輸入資料
    inputType: article.input_type,
    inputContent: article.input_content,

    // 網站配置
    websiteConfig: {
      siteUrl: website.site_url,
      siteName: website.site_name,
      wpUsername: website.wp_username,
      wpAppPassword: website.wp_app_password, // TODO: 解密
    },

    // 品牌聲音
    brandVoice: website.brand_voice || {},

    // Workflow 設定
    workflowSettings: website.workflow_settings || {
      serp_analysis_enabled: true,
      competitor_count: 10,
      quality_threshold: 80,
      auto_publish: true,
      internal_links_count: "3-5",
      image_generation_enabled: false, // 暫時關閉圖片生成
    },

    // Callback URL
    callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/callback`,
  }

  const response = await fetch(n8nWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.N8N_API_KEY || '', // 驗證用
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`N8N Workflow 觸發失敗: ${error}`)
  }

  return await response.json()
}

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
      processing_stages: {
        created: { status: 'completed', completed_at: new Date().toISOString() }
      },
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
      processing_stages: {
        created: { status: 'completed', completed_at: new Date().toISOString() }
      },
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
      processing_stages: {
        created: { status: 'completed', completed_at: new Date().toISOString() }
      },
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

  // 🔥 觸發 N8N Workflow（逐一處理每篇文章）
  const errors: string[] = []

  for (const article of insertedArticles) {
    try {
      // 更新狀態為 processing
      await supabase
        .from('article_jobs')
        .update({
          status: 'processing',
          processing_stages: {
            ...article.processing_stages,
            workflow_triggered: {
              status: 'in_progress',
              started_at: new Date().toISOString()
            }
          }
        })
        .eq('id', article.id)

      // 觸發 N8N
      await triggerN8NWorkflow(article, website)

    } catch (error: any) {
      errors.push(`文章 "${article.article_title}" 觸發失敗: ${error.message}`)

      // 更新為失敗狀態
      await supabase
        .from('article_jobs')
        .update({
          status: 'failed',
          error_message: error.message,
          processing_stages: {
            ...article.processing_stages,
            workflow_triggered: {
              status: 'failed',
              failed_at: new Date().toISOString(),
              error: error.message
            }
          }
        })
        .eq('id', article.id)
    }
  }

  revalidatePath('/dashboard/articles')

  // 如果有錯誤，顯示部分成功訊息
  if (errors.length > 0) {
    const successCount = insertedArticles.length - errors.length
    redirect(
      `/dashboard/articles?warning=${encodeURIComponent(
        `${successCount} 篇文章已觸發，${errors.length} 篇失敗。錯誤: ${errors.join('; ')}`
      )}`
    )
  }

  redirect(
    `/dashboard/articles?success=${encodeURIComponent(
      articles.length === 1
        ? '文章生成 Workflow 已觸發'
        : `${articles.length} 篇文章生成 Workflow 已觸發`
    )}`
  )
}
