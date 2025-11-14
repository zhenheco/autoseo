import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAndEnsureUniqueSlug, assemblePublishURL } from '@/lib/services/slug-generator'

interface PublishPlan {
  id: string
  keyword: string
  websiteId: string
  articleType?: string
  publishTime?: string
  customSlug?: string
}

interface ScheduleConfig {
  mode: 'specific' | 'interval'
  intervalHours?: number
  startTime?: Date
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { plans, scheduleConfig } = body as {
      plans: PublishPlan[]
      scheduleConfig: ScheduleConfig
    }

    if (!plans || plans.length === 0) {
      return NextResponse.json({ error: '沒有有效的計畫' }, { status: 400 })
    }

    const results = []
    const now = new Date()

    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i]

      try {
        const { data: website } = await supabase
          .from('website_configs')
          .select('id, base_url, slug_prefix, default_slug_strategy')
          .eq('id', plan.websiteId)
          .single()

        if (!website) {
          results.push({
            planId: plan.id,
            error: '找不到網站'
          })
          continue
        }

        const slug = await generateAndEnsureUniqueSlug(
          plan.keyword,
          plan.websiteId,
          plan.customSlug ? 'custom' : 'auto',
          plan.customSlug
        )

        const previewUrl = assemblePublishURL(
          website.base_url || '',
          website.slug_prefix || '',
          slug
        )

        let scheduledAt: Date | null = null
        if (plan.publishTime) {
          scheduledAt = new Date(plan.publishTime)
        } else if (scheduleConfig.mode === 'interval' && scheduleConfig.intervalHours) {
          const offset = i * scheduleConfig.intervalHours * 60 * 60 * 1000
          scheduledAt = new Date(now.getTime() + offset)
        }

        const { data: job, error: insertError } = await supabase
          .from('article_jobs')
          .insert({
            company_id: profile.company_id,
            website_id: plan.websiteId,
            keywords: [plan.keyword],
            slug,
            article_type: plan.articleType || null,
            scheduled_publish_at: scheduledAt?.toISOString(),
            status: 'pending',
            metadata: {
              importSource: 'excel',
              previewUrl,
              original_keyword: plan.keyword
            }
          })
          .select()
          .single()

        if (insertError) {
          results.push({
            planId: plan.id,
            error: insertError.message
          })
          continue
        }

        results.push({
          planId: plan.id,
          jobId: job.id,
          slug,
          scheduledAt: scheduledAt?.toISOString(),
          previewUrl
        })
      } catch (error) {
        results.push({
          planId: plan.id,
          error: error instanceof Error ? error.message : '未知錯誤'
        })
      }
    }

    const created = results.filter(r => !r.error).length
    const failed = results.filter(r => r.error).length

    return NextResponse.json({
      created,
      failed,
      results
    })
  } catch (error) {
    console.error('批次匯入錯誤:', error)
    return NextResponse.json(
      { error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
