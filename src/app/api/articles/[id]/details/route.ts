import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }

  const { data: article, error } = await supabase
    .from('generated_articles')
    .select('id, title, html_content, word_count, reading_time, status')
    .eq('id', id)
    .eq('company_id', membership.company_id)
    .single()

  if (error || !article) {
    return NextResponse.json(
      { error: '文章不存在或無權限訪問' },
      { status: 404 }
    )
  }

  return NextResponse.json(article)
}
