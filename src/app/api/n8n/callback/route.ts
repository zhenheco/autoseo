import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// N8N callback 使用 service_role key 繞過 RLS
function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

/**
 * N8N Workflow 回調端點
 *
 * N8N 在完成各個階段時會呼叫此端點更新狀態
 *
 * 支援的處理階段 (stage):
 * - serp_analysis: SERP 數據分析
 * - competitor_analysis: 競爭對手分析
 * - content_plan: 內容策略規劃
 * - content_generation: 文章內容生成
 * - quality_check: 品質檢查
 * - wordpress_publish: WordPress 發布
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 驗證 API Key
    const apiKey = request.headers.get('X-API-Key')
    if (apiKey !== process.env.N8N_API_KEY) {
      console.error('Callback authentication failed: Invalid API Key')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const {
      articleId,
      stage, // 'serp_analysis' | 'competitor_analysis' | 'content_plan' | 'content_generation' | 'quality_check' | 'wordpress_publish'
      status, // 'completed' | 'failed'
      data, // 階段資料
      error, // 錯誤訊息（如果失敗）
    } = body

    // 驗證必要欄位
    if (!articleId || !stage || !status) {
      console.error('Callback validation failed:', { articleId, stage, status })
      return NextResponse.json(
        { error: 'Missing required fields: articleId, stage, status' },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()

    // 取得當前文章資料
    const { data: article, error: fetchError } = await supabase
      .from('article_jobs')
      .select('*')
      .eq('id', articleId)
      .single()

    if (fetchError || !article) {
      console.error('Article not found:', articleId, fetchError)
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      )
    }

    // 更新處理階段
    const updatedStages = {
      ...(article.processing_stages || {}),
      [stage]: {
        status,
        ...(status === 'completed'
          ? { completed_at: new Date().toISOString() }
          : { failed_at: new Date().toISOString(), error }
        ),
      },
    }

    // 準備更新資料
    const updateData: any = {
      processing_stages: updatedStages,
    }

    // 根據不同階段儲存不同資料
    switch (stage) {
      case 'serp_analysis':
        if (status === 'completed' && data) {
          updateData.serp_analysis = data
          updateData.workflow_data = {
            ...(article.workflow_data || {}),
            serp_analysis: data,
          }
          console.log('SERP analysis completed for article:', articleId)
        }
        break

      case 'competitor_analysis':
        if (status === 'completed' && data) {
          updateData.competitor_analysis = data
          updateData.workflow_data = {
            ...(article.workflow_data || {}),
            competitor_analysis: data,
          }
          console.log('Competitor analysis completed for article:', articleId)
        }
        break

      case 'content_plan':
        if (status === 'completed' && data) {
          updateData.content_plan = data
          updateData.workflow_data = {
            ...(article.workflow_data || {}),
            content_plan: data,
          }
          // 更新文章標題（使用 AI 建議的標題）
          if (data.title_suggestions && data.title_suggestions.length > 0) {
            updateData.article_title = data.title_suggestions[0]
            console.log('Article title updated:', data.title_suggestions[0])
          }
          console.log('Content plan completed for article:', articleId)
        }
        break

      case 'content_generation':
        if (status === 'completed' && data) {
          updateData.generated_content = data
          updateData.workflow_data = {
            ...(article.workflow_data || {}),
            content_generation: data,
          }
          console.log('Content generation completed for article:', articleId)
        }
        break

      case 'quality_check':
        if (status === 'completed' && data) {
          updateData.quality_score = data.score
          updateData.quality_report = data
          updateData.workflow_data = {
            ...(article.workflow_data || {}),
            quality_check: data,
          }
          console.log('Quality check completed for article:', articleId, 'Score:', data.score)
        }
        break

      case 'wordpress_publish':
        if (status === 'completed' && data) {
          updateData.status = 'published'
          updateData.wp_post_id = data.wp_post_id
          updateData.published_at = new Date().toISOString()
          updateData.workflow_data = {
            ...(article.workflow_data || {}),
            wordpress_publish: data,
          }
          console.log('WordPress published for article:', articleId, 'Post ID:', data.wp_post_id)
        } else if (status === 'failed') {
          updateData.status = 'failed'
          updateData.error_message = error || 'WordPress 發布失敗'
          console.error('WordPress publish failed for article:', articleId, error)
        }
        break

      default:
        console.warn('Unknown stage:', stage)
    }

    // 如果任何階段失敗，更新整體狀態
    if (status === 'failed' && stage !== 'wordpress_publish') {
      updateData.status = 'failed'
      updateData.error_message = error || `${stage} 階段失敗`
      console.error('Stage failed for article:', articleId, 'Stage:', stage, 'Error:', error)
    }

    // 更新資料庫
    const { error: updateError } = await supabase
      .from('article_jobs')
      .update(updateData)
      .eq('id', articleId)

    if (updateError) {
      console.error('Database update error:', updateError)
      return NextResponse.json(
        { error: 'Database update failed', details: updateError.message },
        { status: 500 }
      )
    }

    console.log('Callback processed successfully:', {
      articleId,
      stage,
      status,
    })

    return NextResponse.json({
      success: true,
      message: `Article ${articleId} ${stage} updated to ${status}`,
    })

  } catch (error: any) {
    console.error('Callback error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * 健康檢查端點
 * GET /api/n8n/callback
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'N8N Callback API',
    version: '1.0',
    timestamp: new Date().toISOString(),
    supported_stages: [
      'serp_analysis',
      'competitor_analysis',
      'content_plan',
      'content_generation',
      'quality_check',
      'wordpress_publish',
    ],
  })
}
