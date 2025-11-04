/**
 * 升級規則測試
 *
 * 執行方式: npx tsx src/lib/subscription/upgrade-rules.test.ts
 */

import { canUpgrade, getUpgradeBlockReason, TIER_HIERARCHY } from './upgrade-rules'

let testsPassed = 0
let testsFailed = 0

function test(description: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${description}`)
    testsPassed++
  } catch (error) {
    console.error(`✗ ${description}`)
    console.error(`  ${error}`)
    testsFailed++
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${expected}, but got ${actual}`
    )
  }
}

console.log('開始測試升級規則...\n')

console.log('=== 測試階層定義 ===')
test('TIER_HIERARCHY 應包含所有階層', () => {
  assertEqual(TIER_HIERARCHY['free'], 0)
  assertEqual(TIER_HIERARCHY['starter'], 1)
  assertEqual(TIER_HIERARCHY['business'], 2)
  assertEqual(TIER_HIERARCHY['professional'], 3)
  assertEqual(TIER_HIERARCHY['agency'], 4)
})

console.log('\n=== 測試新用戶訂閱 ===')
test('新用戶可以訂閱任何方案（月繳）', () => {
  assertEqual(canUpgrade(null, 'monthly', 'starter', 'monthly'), true)
  assertEqual(canUpgrade(null, 'monthly', 'business', 'monthly'), true)
  assertEqual(canUpgrade(null, 'monthly', 'professional', 'monthly'), true)
  assertEqual(canUpgrade(null, 'monthly', 'agency', 'monthly'), true)
})

test('新用戶可以訂閱任何方案（年繳）', () => {
  assertEqual(canUpgrade(null, 'monthly', 'starter', 'yearly'), true)
  assertEqual(canUpgrade(null, 'monthly', 'business', 'yearly'), true)
})

test('新用戶可以訂閱終身方案', () => {
  assertEqual(canUpgrade(null, 'monthly', 'starter', 'lifetime'), true)
  assertEqual(canUpgrade(null, 'monthly', 'agency', 'lifetime'), true)
})

console.log('\n=== 測試同階層升級：延長計費週期 ===')
test('月繳可以升級到年繳（同階層）', () => {
  assertEqual(canUpgrade('starter', 'monthly', 'starter', 'yearly'), true)
  assertEqual(canUpgrade('business', 'monthly', 'business', 'yearly'), true)
  assertEqual(canUpgrade('agency', 'monthly', 'agency', 'yearly'), true)
})

test('月繳可以升級到終身（同階層）', () => {
  assertEqual(canUpgrade('starter', 'monthly', 'starter', 'lifetime'), true)
  assertEqual(canUpgrade('business', 'monthly', 'business', 'lifetime'), true)
})

test('年繳可以升級到終身（同階層）', () => {
  assertEqual(canUpgrade('starter', 'yearly', 'starter', 'lifetime'), true)
  assertEqual(canUpgrade('business', 'yearly', 'business', 'lifetime'), true)
})

console.log('\n=== 測試同階層降級：無法縮短計費週期 ===')
test('年繳無法降級到月繳（同階層）', () => {
  assertEqual(canUpgrade('starter', 'yearly', 'starter', 'monthly'), false)
  assertEqual(canUpgrade('business', 'yearly', 'business', 'monthly'), false)

  const reason = getUpgradeBlockReason('starter', 'yearly', 'starter', 'monthly')
  assertEqual(reason !== null, true, '應該返回錯誤原因')
})

test('終身無法變更到任何方案（同階層）', () => {
  assertEqual(canUpgrade('starter', 'lifetime', 'starter', 'monthly'), false)
  assertEqual(canUpgrade('starter', 'lifetime', 'starter', 'yearly'), false)

  const reason = getUpgradeBlockReason('starter', 'lifetime', 'starter', 'yearly')
  assertEqual(reason, '終身方案無法變更')
})

test('相同方案和計費週期（無變更）', () => {
  assertEqual(canUpgrade('starter', 'monthly', 'starter', 'monthly'), false)
  assertEqual(canUpgrade('business', 'yearly', 'business', 'yearly'), false)

  const reason = getUpgradeBlockReason('starter', 'monthly', 'starter', 'monthly')
  assertEqual(reason, '目前方案')
})

console.log('\n=== 測試跨階層升級：可以升級到更高階層 ===')
test('starter 可以升級到 business（任何計費週期）', () => {
  assertEqual(canUpgrade('starter', 'monthly', 'business', 'monthly'), true)
  assertEqual(canUpgrade('starter', 'monthly', 'business', 'yearly'), true)
  assertEqual(canUpgrade('starter', 'monthly', 'business', 'lifetime'), true)
  assertEqual(canUpgrade('starter', 'yearly', 'business', 'monthly'), true)
  assertEqual(canUpgrade('starter', 'yearly', 'business', 'yearly'), true)
})

test('business 可以升級到 professional（任何計費週期）', () => {
  assertEqual(canUpgrade('business', 'monthly', 'professional', 'monthly'), true)
  assertEqual(canUpgrade('business', 'monthly', 'professional', 'yearly'), true)
  assertEqual(canUpgrade('business', 'yearly', 'professional', 'monthly'), true)
})

test('professional 可以升級到 agency（任何計費週期）', () => {
  assertEqual(canUpgrade('professional', 'monthly', 'agency', 'monthly'), true)
  assertEqual(canUpgrade('professional', 'monthly', 'agency', 'yearly'), true)
  assertEqual(canUpgrade('professional', 'yearly', 'agency', 'monthly'), true)
})

test('starter 可以直接升級到 agency（跨多階層）', () => {
  assertEqual(canUpgrade('starter', 'monthly', 'agency', 'monthly'), true)
  assertEqual(canUpgrade('starter', 'monthly', 'agency', 'yearly'), true)
})

console.log('\n=== 測試跨階層降級：無法降級到低階層 ===')
test('business 無法降級到 starter', () => {
  assertEqual(canUpgrade('business', 'monthly', 'starter', 'monthly'), false)
  assertEqual(canUpgrade('business', 'yearly', 'starter', 'yearly'), false)

  const reason = getUpgradeBlockReason('business', 'monthly', 'starter', 'monthly')
  assertEqual(reason, '無法降級到低階層方案')
})

test('professional 無法降級到 business', () => {
  assertEqual(canUpgrade('professional', 'monthly', 'business', 'monthly'), false)
  assertEqual(canUpgrade('professional', 'yearly', 'business', 'yearly'), false)
})

test('agency 無法降級到任何低階層', () => {
  assertEqual(canUpgrade('agency', 'monthly', 'professional', 'monthly'), false)
  assertEqual(canUpgrade('agency', 'monthly', 'business', 'monthly'), false)
  assertEqual(canUpgrade('agency', 'monthly', 'starter', 'monthly'), false)
})

console.log('\n=== 測試終身方案限制 ===')
test('終身方案無法變更到任何方案（包含升級）', () => {
  assertEqual(canUpgrade('starter', 'lifetime', 'business', 'monthly'), false)
  assertEqual(canUpgrade('starter', 'lifetime', 'business', 'yearly'), false)
  assertEqual(canUpgrade('starter', 'lifetime', 'business', 'lifetime'), false)

  const reason = getUpgradeBlockReason('starter', 'lifetime', 'business', 'monthly')
  assertEqual(reason, '終身方案無法變更')
})

test('終身方案無法變更到年繳或月繳（相同階層）', () => {
  assertEqual(canUpgrade('agency', 'lifetime', 'agency', 'yearly'), false)
  assertEqual(canUpgrade('agency', 'lifetime', 'agency', 'monthly'), false)
})

console.log('\n=== 測試總結 ===')
console.log(`通過: ${testsPassed}`)
console.log(`失敗: ${testsFailed}`)

if (testsFailed > 0) {
  process.exit(1)
}
