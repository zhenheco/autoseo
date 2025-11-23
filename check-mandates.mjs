import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function checkLatestMandates() {
  console.log('🔍 檢查最近的 2 個 active mandates...\n')

  const { data: mandates } = await supabase
    .from('recurring_mandates')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(2)

  if (!mandates || mandates.length === 0) {
    console.log('❌ 沒有找到 active mandates')
    return
  }

  for (const mandate of mandates) {
    console.log(`\n📋 Mandate: ${mandate.mandate_no}`)
    console.log(`  - ID: ${mandate.id}`)
    console.log(`  - Status: ${mandate.status}`)
    console.log(`  - Company ID: ${mandate.company_id}`)
    console.log(`  - Plan ID: ${mandate.plan_id}`)
    console.log(`  - Period Type: ${mandate.period_type}`)
    console.log(`  - Activated At: ${mandate.activated_at}`)
    console.log(`  - Next Payment: ${mandate.next_payment_date}`)

    const { data: company } = await supabase
      .from('companies')
      .select('name, subscription_tier, subscription_ends_at, seo_token_balance')
      .eq('id', mandate.company_id)
      .single()

    if (company) {
      console.log(`\n  公司資料:`)
      console.log(`    - 名稱: ${company.name}`)
      console.log(`    - 方案: ${company.subscription_tier}`)
      console.log(`    - 到期日: ${company.subscription_ends_at || 'NULL'}`)
      console.log(`    - Token 餘額: ${company.seo_token_balance}`)
    }

    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('name, slug, base_tokens')
      .eq('id', mandate.plan_id)
      .single()

    if (plan) {
      console.log(`\n  訂閱方案:`)
      console.log(`    - 名稱: ${plan.name}`)
      console.log(`    - Slug: ${plan.slug}`)
      console.log(`    - Token 配額: ${plan.base_tokens}`)
    }
  }
}

checkLatestMandates()
  .catch(console.error)
  .finally(() => process.exit(0))
