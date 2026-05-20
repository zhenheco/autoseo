import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function fixFreePlanBalance() {
  console.log('=== 修正免費方案 Token 餘額 ===\n')

  // 1. 查詢免費方案 ID
  const { data: freePlan } = await supabase
    .from('subscription_plans')
    .select('id, name, slug')
    .eq('slug', 'free')
    .single()

  if (!freePlan) {
    console.log('❌ 找不到免費方案')
    return
  }

  console.log(`找到免費方案: ${freePlan.name} (${freePlan.id})\n`)

  // 2. 查詢需要修正的訂閱
  const { data: subscriptions } = await supabase
    .from('company_subscriptions')
    .select('id, company_id, purchased_token_balance')
    .eq('plan_id', freePlan.id)
    .eq('status', 'active')
    .neq('purchased_token_balance', 10000)

  if (!subscriptions || subscriptions.length === 0) {
    console.log('✅ 所有免費方案的 Token 餘額都正確（10,000）')
    return
  }

  console.log(`找到 ${subscriptions.length} 個需要修正的訂閱:\n`)
  subscriptions.forEach((sub, i) => {
    console.log(`  [${i + 1}] Company ID: ${sub.company_id}`)
    console.log(`      目前餘額: ${sub.purchased_token_balance}`)
  })

  console.log('\n開始修正...\n')

  // 3. 逐一修正
  let successCount = 0
  let failCount = 0

  for (const sub of subscriptions) {
    const { error } = await supabase
      .from('company_subscriptions')
      .update({ purchased_token_balance: 10000 })
      .eq('id', sub.id)

    if (error) {
      console.log(`❌ 修正失敗 (Company ID: ${sub.company_id}): ${error.message}`)
      failCount++
    } else {
      console.log(`✅ 修正成功 (Company ID: ${sub.company_id}): ${sub.purchased_token_balance} → 10000`)
      successCount++
    }
  }

  console.log('\n=== 修正完成 ===')
  console.log(`成功: ${successCount}`)
  console.log(`失敗: ${failCount}`)
  console.log(`總計: ${subscriptions.length}`)
}

fixFreePlanBalance().catch(console.error)
