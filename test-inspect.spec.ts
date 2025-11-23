import { test } from '@playwright/test'

test('檢查頁面實際狀態', async ({ page }) => {
  await page.goto('http://localhost:3168/dashboard/articles')
  await page.waitForLoadState('networkidle')

  // 截圖看看實際頁面
  await page.screenshot({ path: 'test-screenshot.png', fullPage: true })

  // 獲取頁面 HTML
  const html = await page.content()
  console.log('頁面 URL:', page.url())

  // 檢查是否需要登入
  const hasLoginForm = await page.locator('input[type="email"], input[type="password"]').count()
  console.log('是否在登入頁:', hasLoginForm > 0)

  // 檢查頁面標題
  const title = await page.title()
  console.log('頁面標題:', title)

  // 檢查是否有文章表格
  const hasTable = await page.locator('table, [role="table"]').count()
  console.log('是否有表格:', hasTable > 0)

  // 列出所有可見的按鈕
  const buttons = await page.locator('button').allTextContents()
  console.log('可見按鈕:', buttons.slice(0, 10))

  // 檢查是否有任何 role="img" 元素
  const imgRoles = await page.locator('[role="img"]').count()
  console.log('role="img" 元素數量:', imgRoles)

  // 檢查是否有 aria-label 的元素
  const ariaLabels = await page.locator('[aria-label]').count()
  console.log('aria-label 元素數量:', ariaLabels)

  // 列出前 5 個 aria-label
  const labels = await page.locator('[aria-label]').allTextContents()
  console.log('前 5 個 aria-label:', labels.slice(0, 5))
})
