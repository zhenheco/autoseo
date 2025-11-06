import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function resetAceToFree() {
  const targetEmail = 'ace@zhenhe-co.com'

  console.log(`查詢用戶: ${targetEmail}...`)

  // 1. 查找用戶
  const { data: authUser, error: userError } = await supabase.auth.admin.listUsers()

  if (userError) {
    console.error('查詢用戶失敗:', userError)
    return
  }

  const user = authUser.users.find(u => u.email === targetEmail)

  if (!user) {
    console.error('找不到用戶:', targetEmail)
    return
  }

  console.log('✓ 找到用戶:', user.id)

  // 2. 查找公司
  const { data: membership, error: membershipError } = await supabase
    .from('company_members')
    .select('company_id, companies(id, name, subscription_tier)')
    .eq('user_id', user.id)
    .single()

  if (membershipError) {
    console.error('查詢公司成員失敗:', membershipError)
    return
  }

  const company = membership.companies as any
  console.log('✓ 找到公司:', company.name, `(${company.id})`)
  console.log('  當前方案:', company.subscription_tier)

  // 3. 查找 FREE 方案
  const { data: freePlan, error: planError } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('slug', 'free')
    .single()

  if (planError || !freePlan) {
    console.error('找不到 FREE 方案:', planError)
    return
  }

  console.log('✓ 找到 FREE 方案:', freePlan.name)

  // 4. 查看當前訂閱狀態
  const { data: currentSub, error: subError } = await supabase
    .from('company_subscriptions')
    .select('*')
    .eq('company_id', company.id)
    .eq('status', 'active')
    .single()

  if (subError && subError.code !== 'PGRST116') {
    console.error('查詢訂閱失敗:', subError)
    return
  }

  if (currentSub) {
    console.log('\n當前訂閱狀態:')
    console.log('  方案:', currentSub.subscription_plan_id)
    console.log('  月配額:', currentSub.monthly_token_quota)
    console.log('  月餘額:', currentSub.monthly_quota_balance)
    console.log('  購買餘額:', currentSub.purchased_token_balance)
  }

  // 5. 更新或創建訂閱為 FREE 方案
  console.log('\n開始重置為 FREE 方案...')

  if (currentSub) {
    // 更新現有訂閱
    const { data: updatedSub, error: updateError } = await supabase
      .from('company_subscriptions')
      .update({
        subscription_plan_id: freePlan.id,
        monthly_token_quota: 0, // FREE 方案沒有月配額
        monthly_quota_balance: 0,
        purchased_token_balance: 20000, // 一次性 20k tokens
        current_period_start: null,
        current_period_end: null,
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', currentSub.id)
      .select()
      .single()

    if (updateError) {
      console.error('更新訂閱失敗:', updateError)
      return
    }

    console.log('✓ 訂閱已更新')
  } else {
    // 創建新訂閱
    const { data: newSub, error: insertError } = await supabase
      .from('company_subscriptions')
      .insert({
        company_id: company.id,
        subscription_plan_id: freePlan.id,
        monthly_token_quota: 0,
        monthly_quota_balance: 0,
        purchased_token_balance: 20000,
        current_period_start: null,
        current_period_end: null,
        status: 'active'
      })
      .select()
      .single()

    if (insertError) {
      console.error('創建訂閱失敗:', insertError)
      return
    }

    console.log('✓ 訂閱已創建')
  }

  // 6. 更新 companies 表的 subscription_tier
  const { error: companyUpdateError } = await supabase
    .from('companies')
    .update({ subscription_tier: 'free' })
    .eq('id', company.id)

  if (companyUpdateError) {
    console.error('更新公司方案失敗:', companyUpdateError)
    return
  }

  console.log('✓ 公司方案已更新為 free')

  // 7. 驗證最終狀態
  const { data: finalSub } = await supabase
    .from('company_subscriptions')
    .select('*')
    .eq('company_id', company.id)
    .eq('status', 'active')
    .single()

  console.log('\n✅ 重置完成！最終狀態:')
  console.log('  方案: FREE')
  console.log('  月配額:', finalSub?.monthly_token_quota || 0)
  console.log('  月餘額:', finalSub?.monthly_quota_balance || 0)
  console.log('  購買餘額 (一次性):', finalSub?.purchased_token_balance || 0)
  console.log('  總餘額:', (finalSub?.monthly_quota_balance || 0) + (finalSub?.purchased_token_balance || 0))
}

resetAceToFree().catch(console.error)
