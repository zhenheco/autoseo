import { chromium, Browser, Page } from 'playwright'

interface ConsoleMessage {
  type: string
  text: string
  location: string
}

interface PageTestResult {
  url: string
  status: 'success' | 'error'
  errors: ConsoleMessage[]
  warnings: ConsoleMessage[]
  pageTitle: string
}

async function testPage(page: Page, url: string): Promise<PageTestResult> {
  const errors: ConsoleMessage[] = []
  const warnings: ConsoleMessage[] = []

  page.on('console', (msg) => {
    const type = msg.type()
    const text = msg.text()
    const location = msg.location()

    if (type === 'error') {
      errors.push({
        type,
        text,
        location: `${location.url}:${location.lineNumber}:${location.columnNumber}`,
      })
    } else if (type === 'warning') {
      warnings.push({
        type,
        text,
        location: `${location.url}:${location.lineNumber}:${location.columnNumber}`,
      })
    }
  })

  page.on('pageerror', (error) => {
    errors.push({
      type: 'pageerror',
      text: error.message,
      location: error.stack || 'unknown',
    })
  })

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)

    const pageTitle = await page.title()

    return {
      url,
      status: errors.length > 0 ? 'error' : 'success',
      errors,
      warnings,
      pageTitle,
    }
  } catch (error) {
    errors.push({
      type: 'navigation',
      text: error instanceof Error ? error.message : String(error),
      location: 'navigation',
    })

    return {
      url,
      status: 'error',
      errors,
      warnings,
      pageTitle: 'Failed to load',
    }
  }
}

async function runTests() {
  console.log('🚀 開始測試所有頁面...\n')

  const browser: Browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  })
  const page = await context.newPage()

  const baseUrl = 'http://localhost:3168'
  const pagesToTest = [
    '/dashboard/articles',
    '/dashboard/articles/new',
    '/dashboard/settings/ai-models',
  ]

  const results: PageTestResult[] = []

  for (const path of pagesToTest) {
    const url = `${baseUrl}${path}`
    console.log(`📄 測試頁面: ${path}`)

    const result = await testPage(page, url)
    results.push(result)

    if (result.status === 'success') {
      console.log(`  ✅ 成功 - ${result.pageTitle}`)
    } else {
      console.log(`  ❌ 錯誤 - ${result.pageTitle}`)
    }

    if (result.errors.length > 0) {
      console.log(`  🔴 錯誤 (${result.errors.length}):`)
      result.errors.forEach((error) => {
        console.log(`     - ${error.text}`)
        console.log(`       位置: ${error.location}`)
      })
    }

    if (result.warnings.length > 0) {
      console.log(`  ⚠️  警告 (${result.warnings.length}):`)
      result.warnings.forEach((warning) => {
        console.log(`     - ${warning.text}`)
      })
    }

    console.log('')
  }

  await browser.close()

  console.log('\n📊 測試總結')
  console.log('='.repeat(50))

  const successCount = results.filter((r) => r.status === 'success').length
  const errorCount = results.filter((r) => r.status === 'error').length
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0)

  console.log(`✅ 成功: ${successCount}/${results.length}`)
  console.log(`❌ 失敗: ${errorCount}/${results.length}`)
  console.log(`🔴 總錯誤數: ${totalErrors}`)
  console.log(`⚠️  總警告數: ${totalWarnings}`)

  if (errorCount > 0) {
    console.log('\n❌ 測試失敗 - 存在錯誤需要修正')
    process.exit(1)
  } else {
    console.log('\n✅ 所有測試通過！')
    process.exit(0)
  }
}

runTests().catch((error) => {
  console.error('測試執行失敗:', error)
  process.exit(1)
})
