import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { scheduled_time, auto_publish } = body

  if (!scheduled_time) {
    return NextResponse.json(
      { error: '排程時間為必填欄位' },
      { status: 400 }
    )
  }

  const scheduleDate = new Date(scheduled_time)
  if (scheduleDate <= new Date()) {
    return NextResponse.json(
      { error: '排程時間必須是未來的時間' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: article, error: articleError } = await supabase
    .from('generated_articles')
    .select('*, article_jobs(*)')
    .eq('id', id)
    .eq('company_id', membership.company_id)
    .single()

  if (articleError || !article) {
    return NextResponse.json(
      { error: '文章不存在或無權限訪問' },
      { status: 404 }
    )
  }

  try {
    const { error: updateArticleError } = await supabase
      .from('generated_articles')
      .update({
        wordpress_status: 'scheduled',
        status: 'scheduled',
      })
      .eq('id', id)
      .eq('company_id', membership.company_id)

    if (updateArticleError) {
      throw new Error(updateArticleError.message)
    }

    if (article.article_jobs && article.article_jobs.length > 0) {
      const { error: updateJobError } = await supabase
        .from('article_jobs')
        .update({
          scheduled_publish_at: scheduled_time,
          auto_publish: auto_publish ?? true,
          status: 'scheduled',
        })
        .eq('article_id', id)

      if (updateJobError) {
        throw new Error(updateJobError.message)
      }
    }

    return NextResponse.json({
      success: true,
      scheduled_time,
    })
  } catch (error) {
    console.error('Error scheduling article:', error)
    return NextResponse.json(
      { error: '設定排程失敗：' + (error instanceof Error ? error.message : '未知錯誤') },
      { status: 500 }
    )
  }
}
