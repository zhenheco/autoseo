import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.company_id) {
      return NextResponse.json({ error: '找不到公司資料' }, { status: 404 })
    }

    const { data: websites, error } = await supabase
      .from('website_configs')
      .select('id, name, base_url, slug_prefix')
      .eq('company_id', profile.company_id)
      .order('name')

    if (error) {
      throw error
    }

    return NextResponse.json(websites || [])
  } catch (error) {
    console.error('獲取網站列表錯誤:', error)
    return NextResponse.json(
      { error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
