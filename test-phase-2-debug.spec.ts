import { test, expect } from '@playwright/test'

test.describe('Phase 2: Debug WebsiteSelector', () => {
  test('Capture console logs and debug loading state', async ({ page }) => {
    // Capture ALL console logs
    const consoleLogs: string[] = []
    page.on('console', (msg) => {
      const text = msg.text()
      consoleLogs.push(text)
      if (text.includes('[WebsiteSelector]')) {
        console.log(`  📋 ${text}`)
      }
    })

    // Login
    await page.goto('http://localhost:3168/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', 'nelsonjou@gmail.com')
    await page.fill('input[type="password"]', 'aa123123')
    await page.click('button:has-text("繼續")')
    await page.waitForURL('**/dashboard**', { timeout: 10000 })

    // Go to articles
    await page.goto('http://localhost:3168/dashboard/articles')
    await page.waitForLoadState('networkidle')

    // Click first article
    console.log('\n========== Clicking Article ==========')
    const articleItems = page.locator('.cursor-pointer').filter({
      hasText: /^(?!.*任務).*/
    })
    await articleItems.first().click()
    await page.waitForTimeout(1000)

    // Click publish button
    console.log('\n========== Clicking Publish ==========')
    const publishButton = page.locator('button:has-text("發布")')
    await publishButton.click()

    // Wait for dialog
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
    console.log('✅ Dialog opened')

    // Wait and capture state
    console.log('\n========== Waiting 5 seconds ==========')
    await page.waitForTimeout(5000)

    // Check loading state
    const loadingText = page.locator('text=載入中')
    const isLoading = await loadingText.count() > 0

    console.log(`\n========== Final State ==========`)
    console.log(`  Loading state: ${isLoading ? '❌ TRUE (stuck)' : '✅ FALSE (working)'}`)

    // Print all WebsiteSelector logs
    const websiteSelectorLogs = consoleLogs.filter(log => log.includes('[WebsiteSelector]'))
    console.log(`\n========== WebsiteSelector Logs (${websiteSelectorLogs.length}) ==========`)
    websiteSelectorLogs.forEach(log => console.log(`  ${log}`))

    // Analysis
    const hasFetchStarted = websiteSelectorLogs.some(log => log.includes('fetchWebsites called'))
    const hasFetchedData = websiteSelectorLogs.some(log => log.includes('Fetched websites:'))
    const hasSetLoadingFalse = websiteSelectorLogs.some(log => log.includes('Set loading to false'))
    const hasRenderedLoaded = websiteSelectorLogs.some(log => log.includes('Rendering with loading: false'))

    console.log(`\n========== Analysis ==========`)
    console.log(`  Fetch started: ${hasFetchStarted ? '✅' : '❌'}`)
    console.log(`  Data fetched: ${hasFetchedData ? '✅' : '❌'}`)
    console.log(`  setLoading(false) called: ${hasSetLoadingFalse ? '✅' : '❌'}`)
    console.log(`  Re-rendered with loading=false: ${hasRenderedLoaded ? '✅' : '❌'}`)

    if (hasFetchStarted && hasFetchedData && hasSetLoadingFalse && !hasRenderedLoaded) {
      console.log(`\n⚠️  DIAGNOSIS: setState called but component not re-rendering`)
      console.log(`  Possible causes:`)
      console.log(`  1. Component unmounting before re-render`)
      console.log(`  2. Parent blocking state updates`)
      console.log(`  3. Multiple instances, wrong one being checked`)
    }

    // Don't fail test, just report
    console.log(`\n========================================\n`)
  })
})
