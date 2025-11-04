import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'
import { canUpgrade, getUpgradeBlockReason, type BillingPeriod } from '../lib/subscription/upgrade-rules'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const testEmail = 'test-upgrade@zhenhe-co.com'

interface TestResult {
  testName: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  expected: string
  actual: string
  details?: string
}

const results: TestResult[] = []

async function getUserAndCompany() {
  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users.users.find(u => u.email === testEmail)

  if (!user) {
    throw new Error('找不到測試用戶')
  }

  const { data: member } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .single()

  if (!member) {
    throw new Error('找不到公司')
  }

  return { userId: user.id, companyId: member.company_id }
}

async function getCurrentMandate(companyId: string) {
  const { data: mandate } = await supabase
    .from('recurring_mandates')
    .select('period_type, subscription_plan_id, subscription_plans(slug, is_lifetime)')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!mandate || !mandate.subscription_plans) {
    return { currentTierSlug: null, currentBillingPeriod: 'monthly' as BillingPeriod }
  }

  const planData = mandate.subscription_plans
  const currentPlan = Array.isArray(planData) ? planData[0] : planData

  if (!currentPlan || typeof currentPlan !== 'object') {
    return { currentTierSlug: null, currentBillingPeriod: 'monthly' as BillingPeriod }
  }

  const currentTierSlug = (currentPlan as { slug: string }).slug
  let currentBillingPeriod: BillingPeriod = 'monthly'

  if ((currentPlan as { is_lifetime: boolean }).is_lifetime) {
    currentBillingPeriod = 'lifetime'
  } else if (mandate.period_type === 'Y') {
    currentBillingPeriod = 'yearly'
  }

  return { currentTierSlug, currentBillingPeriod }
}

async function getAllPlans() {
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('id, slug, name, is_lifetime')
    .order('slug')

  return plans || []
}

async function test1_FreeTierUser() {
  console.log('\n=== Test 1: 無訂閱用戶（Free Tier）===')

  const { companyId } = await getUserAndCompany()
  const { currentTierSlug, currentBillingPeriod } = await getCurrentMandate(companyId)
  const plans = await getAllPlans()

  const starterPlan = plans.find(p => p.slug === 'starter' && !p.is_lifetime)

  if (!starterPlan) {
    results.push({
      testName: 'Test 1: Free Tier User',
      status: 'SKIP',
      expected: 'Should find starter plan',
      actual: 'No starter plan found in database'
    })
    return
  }

  // 測試：無訂閱用戶應該可以訂閱任何方案
  const canSubscribeResult = canUpgrade(currentTierSlug, currentBillingPeriod, 'starter', 'monthly')
  const reason = getUpgradeBlockReason(currentTierSlug, currentBillingPeriod, 'starter', 'monthly')

  const expected = '可以訂閱 (canUpgrade=true, reason=null)'
  const actual = `canUpgrade=${canSubscribeResult}, reason=${reason}`

  if (canSubscribeResult && reason === null) {
    console.log('✅ 無訂閱用戶可以訂閱任何方案')
    results.push({
      testName: 'Test 1: Free Tier User',
      status: 'PASS',
      expected,
      actual
    })
  } else {
    console.log('❌ 無訂閱用戶應該可以訂閱')
    results.push({
      testName: 'Test 1: Free Tier User',
      status: 'FAIL',
      expected,
      actual
    })
  }
}

async function test2_SameTierUpgrade() {
  console.log('\n=== Test 2: 同階層升級（月繳→年繳）===')

  // 測試：月繳可以升級到年繳
  const canUpgradeResult = canUpgrade('starter', 'monthly', 'starter', 'yearly')
  const reason = getUpgradeBlockReason('starter', 'monthly', 'starter', 'yearly')

  const expected = '可以升級 (canUpgrade=true, reason=null)'
  const actual = `canUpgrade=${canUpgradeResult}, reason=${reason}`

  if (canUpgradeResult && reason === null) {
    console.log('✅ 月繳可以升級到年繳')
    results.push({
      testName: 'Test 2: Same Tier Upgrade (Monthly → Yearly)',
      status: 'PASS',
      expected,
      actual
    })
  } else {
    console.log('❌ 月繳應該可以升級到年繳')
    results.push({
      testName: 'Test 2: Same Tier Upgrade (Monthly → Yearly)',
      status: 'FAIL',
      expected,
      actual
    })
  }
}

async function test3_SameTierDowngrade() {
  console.log('\n=== Test 3: 同階層降級（年繳→月繳）===')

  // 測試：年繳無法降級到月繳
  const canDowngrade = canUpgrade('starter', 'yearly', 'starter', 'monthly')
  const reason = getUpgradeBlockReason('starter', 'yearly', 'starter', 'monthly')

  const expected = '無法降級 (canUpgrade=false, reason=年繳無法變更為月繳)'
  const actual = `canUpgrade=${canDowngrade}, reason=${reason}`

  if (!canDowngrade && reason === '年繳無法變更為月繳') {
    console.log('✅ 年繳無法降級到月繳')
    results.push({
      testName: 'Test 3: Same Tier Downgrade (Yearly → Monthly)',
      status: 'PASS',
      expected,
      actual
    })
  } else {
    console.log('❌ 年繳不應該可以降級到月繳')
    results.push({
      testName: 'Test 3: Same Tier Downgrade (Yearly → Monthly)',
      status: 'FAIL',
      expected,
      actual
    })
  }
}

async function test4_CrossTierUpgrade() {
  console.log('\n=== Test 4: 跨階層升級（Starter→Business）===')

  // 測試：可以升級到更高階層
  const canUpgradeResult = canUpgrade('starter', 'monthly', 'business', 'monthly')
  const reason = getUpgradeBlockReason('starter', 'monthly', 'business', 'monthly')

  const expected = '可以升級 (canUpgrade=true, reason=null)'
  const actual = `canUpgrade=${canUpgradeResult}, reason=${reason}`

  if (canUpgradeResult && reason === null) {
    console.log('✅ 可以升級到更高階層')
    results.push({
      testName: 'Test 4: Cross-Tier Upgrade (Starter → Business)',
      status: 'PASS',
      expected,
      actual
    })
  } else {
    console.log('❌ 應該可以升級到更高階層')
    results.push({
      testName: 'Test 4: Cross-Tier Upgrade (Starter → Business)',
      status: 'FAIL',
      expected,
      actual
    })
  }
}

async function test5_CrossTierDowngrade() {
  console.log('\n=== Test 5: 跨階層降級（Business→Starter）===')

  // 測試：無法降級到低階層
  const canDowngrade = canUpgrade('business', 'monthly', 'starter', 'monthly')
  const reason = getUpgradeBlockReason('business', 'monthly', 'starter', 'monthly')

  const expected = '無法降級 (canUpgrade=false, reason=無法降級到低階層方案)'
  const actual = `canUpgrade=${canDowngrade}, reason=${reason}`

  if (!canDowngrade && reason === '無法降級到低階層方案') {
    console.log('✅ 無法降級到低階層')
    results.push({
      testName: 'Test 5: Cross-Tier Downgrade (Business → Starter)',
      status: 'PASS',
      expected,
      actual
    })
  } else {
    console.log('❌ 不應該可以降級到低階層')
    results.push({
      testName: 'Test 5: Cross-Tier Downgrade (Business → Starter)',
      status: 'FAIL',
      expected,
      actual
    })
  }
}

async function test6_LifetimeRestrictions() {
  console.log('\n=== Test 6: 終身方案限制 ===')

  // 測試：終身方案無法變更到任何方案
  const canChangeToYearly = canUpgrade('agency', 'lifetime', 'agency', 'yearly')
  const reasonYearly = getUpgradeBlockReason('agency', 'lifetime', 'agency', 'yearly')

  const canDowngrade = canUpgrade('agency', 'lifetime', 'starter', 'monthly')
  const reasonDowngrade = getUpgradeBlockReason('agency', 'lifetime', 'starter', 'monthly')

  const expectedYearly = '無法變更 (canUpgrade=false, reason=終身方案無法變更)'
  const actualYearly = `canUpgrade=${canChangeToYearly}, reason=${reasonYearly}`

  const expectedDowngrade = '無法變更 (canUpgrade=false, reason=終身方案無法變更)'
  const actualDowngrade = `canDowngrade=${canDowngrade}, reason=${reasonDowngrade}`

  if (!canChangeToYearly && reasonYearly === '終身方案無法變更' &&
      !canDowngrade && reasonDowngrade === '終身方案無法變更') {
    console.log('✅ 終身方案無法變更到任何方案')
    results.push({
      testName: 'Test 6: Lifetime Restrictions',
      status: 'PASS',
      expected: `${expectedYearly}, ${expectedDowngrade}`,
      actual: `${actualYearly}, ${actualDowngrade}`
    })
  } else {
    console.log('❌ 終身方案應該無法變更')
    results.push({
      testName: 'Test 6: Lifetime Restrictions',
      status: 'FAIL',
      expected: `${expectedYearly}, ${expectedDowngrade}`,
      actual: `${actualYearly}, ${actualDowngrade}`
    })
  }
}

async function runAllTests() {
  try {
    console.log('=== 開始升級規則測試 ===')
    console.log('測試用戶:', testEmail)

    await test1_FreeTierUser()
    await test2_SameTierUpgrade()
    await test3_SameTierDowngrade()
    await test4_CrossTierUpgrade()
    await test5_CrossTierDowngrade()
    await test6_LifetimeRestrictions()

    console.log('\n=== 測試結果總結 ===')
    const passed = results.filter(r => r.status === 'PASS').length
    const failed = results.filter(r => r.status === 'FAIL').length
    const skipped = results.filter(r => r.status === 'SKIP').length

    console.log(`總計: ${results.length} 個測試`)
    console.log(`✅ 通過: ${passed}`)
    console.log(`❌ 失敗: ${failed}`)
    console.log(`⏭️  跳過: ${skipped}`)

    if (failed > 0) {
      console.log('\n失敗的測試:')
      results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`  - ${r.testName}`)
        console.log(`    預期: ${r.expected}`)
        console.log(`    實際: ${r.actual}`)
      })
    }

    if (failed === 0 && skipped === 0) {
      console.log('\n🎉 所有測試通過！')
    }

  } catch (error) {
    console.error('測試執行失敗:', error)
    process.exit(1)
  }
}

runAllTests()
