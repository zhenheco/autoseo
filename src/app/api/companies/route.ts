import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function generateSlug(name: string): string {
  const random = Math.random().toString(36).substring(2, 8)
  const slug = name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 20)
  return `${slug}-${random}`
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: '公司名稱為必填' }, { status: 400 })
    }

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name,
        slug: generateSlug(name),
        owner_id: user.id,
        subscription_tier: 'free',
      })
      .select()
      .single()

    if (companyError) {
      console.error('建立公司失敗:', companyError)
      return NextResponse.json({ error: '建立公司失敗' }, { status: 500 })
    }

    const { error: memberError } = await supabase
      .from('company_members')
      .insert({
        company_id: company.id,
        user_id: user.id,
        role: 'owner',
        status: 'active',
        joined_at: new Date().toISOString(),
      })

    if (memberError) {
      await supabase.from('companies').delete().eq('id', company.id)
      console.error('新增成員記錄失敗:', memberError)
      return NextResponse.json({ error: '建立公司失敗' }, { status: 500 })
    }

    const periodStart = new Date()
    const periodEnd = new Date()
    periodEnd.setDate(periodEnd.getDate() + 30)

    await supabase.from('subscriptions').insert({
      company_id: company.id,
      plan_name: 'free',
      status: 'active',
      monthly_article_limit: 5,
      articles_used_this_month: 0,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
    })

    return NextResponse.json(company, { status: 201 })
  } catch (error) {
    console.error('建立公司錯誤:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
