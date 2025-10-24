import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// N8N API 使用 service_role key 繞過 RLS
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
 * 取得舊文章列表（供 N8N "Add internal links" 節點使用）
 *
 * Query parameters:
 * - websiteId: 網站 ID (必填)
 * - limit: 返回數量（預設 20，最大 100）
 * - keyword: 關鍵字（用於相關性過濾，選填）
 *
 * 回傳格式:
 * {
 *   articles: [
 *     {
 *       title: "文章標題",
 *       postId: 42,
 *       url: "/post-42",
 *       publishedAt: "2025-01-24T10:00:00Z",
 *       excerpt: "文章摘要...",
 *       keyword: "主要關鍵字"
 *     }
 *   ],
 *   total: 10
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // 驗證 API Key
    const apiKey = request.headers.get('X-API-Key')
    if (apiKey !== process.env.N8N_API_KEY) {
      console.error('Previous articles API: Authentication failed')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const websiteId = searchParams.get('websiteId')
    const limitParam = searchParams.get('limit')
    const keyword = searchParams.get('keyword')

    // 驗證必要參數
    if (!websiteId) {
      return NextResponse.json(
        { error: 'Missing required parameter: websiteId' },
        { status: 400 }
      )
    }

    // 解析 limit 參數
    let limit = 20 // 預設值
    if (limitParam) {
      const parsedLimit = parseInt(limitParam)
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100) {
        limit = parsedLimit
      }
    }

    const supabase = createServiceRoleClient()

    // 查詢已發布的文章
    let query = supabase
      .from('article_jobs')
      .select('id, article_title, wp_post_id, published_at, input_content, generated_content')
      .eq('website_id', websiteId)
      .eq('status', 'published')
      .not('wp_post_id', 'is', null)
      .order('published_at', { ascending: false })
      .limit(limit)

    const { data: articles, error } = await query

    if (error) {
      console.error('Database query error:', error)
      return NextResponse.json(
        { error: 'Database query failed', details: error.message },
        { status: 500 }
      )
    }

    // 格式化成 N8N 需要的格式
    const formattedArticles = articles.map(article => ({
      title: article.article_title,
      postId: article.wp_post_id,
      url: `/post-${article.wp_post_id}`, // 可以後續改成完整 URL
      publishedAt: article.published_at,
      excerpt: getExcerpt(article),
      keyword: getKeyword(article),
    }))

    // 如果有關鍵字，進行相關性過濾
    let resultArticles = formattedArticles
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase()
      resultArticles = formattedArticles.filter(article => {
        return (
          article.title?.toLowerCase().includes(lowerKeyword) ||
          article.excerpt?.toLowerCase().includes(lowerKeyword) ||
          article.keyword?.toLowerCase().includes(lowerKeyword)
        )
      })
      console.log(`Filtered ${formattedArticles.length} articles to ${resultArticles.length} by keyword: ${keyword}`)
    }

    console.log(`Returning ${resultArticles.length} previous articles for website: ${websiteId}`)

    return NextResponse.json({
      articles: resultArticles,
      total: resultArticles.length,
      websiteId,
      keyword: keyword || null,
    })

  } catch (error: any) {
    console.error('Previous articles API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * 從文章中提取摘要
 */
function getExcerpt(article: any): string {
  // 優先使用生成內容的前 200 字
  if (article.generated_content?.content) {
    const content = article.generated_content.content
    // 移除 HTML 標籤
    const plainText = content.replace(/<[^>]*>/g, '')
    return plainText.substring(0, 200).trim() + (plainText.length > 200 ? '...' : '')
  }

  // 如果沒有生成內容，使用文章標題
  return article.article_title || ''
}

/**
 * 從文章中提取關鍵字
 */
function getKeyword(article: any): string {
  // 從 input_content 中提取關鍵字
  if (article.input_content?.keyword) {
    return article.input_content.keyword
  }

  // 如果是 URL 輸入方式，返回空字串
  return ''
}

/**
 * 健康檢查端點
 * 不需要認證
 */
export async function OPTIONS() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'Previous Articles API',
    version: '1.0',
    description: 'Get previous published articles for internal linking',
    parameters: {
      websiteId: 'required (UUID)',
      limit: 'optional (default: 20, max: 100)',
      keyword: 'optional (for relevance filtering)',
    },
    authentication: 'X-API-Key header required',
  })
}
