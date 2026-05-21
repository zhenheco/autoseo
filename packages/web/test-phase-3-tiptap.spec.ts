import { test, expect } from '@playwright/test'

test.describe('Phase 3: TipTap WYSIWYG Editor', () => {
  test('驗證 TipTap 編輯器載入和功能', async ({ page }) => {
    const consoleLogs: string[] = []
    const consoleErrors: string[] = []

    page.on('console', (msg) => {
      const text = msg.text()
      consoleLogs.push(text)
      if (msg.type() === 'error') {
        consoleErrors.push(text)
        console.log(`  ❌ Console Error: ${text}`)
      }
    })

    page.on('pageerror', (error) => {
      console.log(`  ❌ Page Error: ${error.message}`)
      consoleErrors.push(error.message)
    })

    // 登入
    console.log('\n========== 登入 ==========')
    await page.goto('http://localhost:3168/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', 'nelsonjou@gmail.com')
    await page.fill('input[type="password"]', 'aa123123')
    await page.click('button:has-text("繼續")')
    await page.waitForURL('**/dashboard**', { timeout: 10000 })
    console.log('✅ 登入成功')

    // 前往文章頁面
    console.log('\n========== 前往文章頁面 ==========')
    await page.goto('http://localhost:3168/dashboard/articles')
    await page.waitForLoadState('networkidle')
    console.log('✅ 文章頁面載入完成')

    // 選擇第一篇文章
    console.log('\n========== 選擇文章 ==========')
    const articleItems = page.locator('.cursor-pointer').filter({
      hasText: /^(?!.*任務).*/
    })
    await articleItems.first().click()
    await page.waitForTimeout(2000)
    console.log('✅ 文章已選擇')

    // 檢查 TipTap 編輯器是否存在
    console.log('\n========== 檢查 TipTap 編輯器 ==========')

    // 等待編輯器載入
    const editor = page.locator('.ProseMirror')
    await editor.waitFor({ timeout: 5000 })
    console.log('✅ TipTap 編輯器已載入')

    // 先截圖查看 DOM 結構
    await page.screenshot({
      path: 'test-results/tiptap-editor-dom.png',
      fullPage: true
    })
    console.log('📸 截圖已保存: test-results/tiptap-editor-dom.png')

    // 檢查工具列按鈕
    const boldButton = page.locator('button[aria-label="粗體"]')
    const italicButton = page.locator('button[aria-label="斜體"]')
    const h1Button = page.locator('button[aria-label="標題 1"]')
    const h2Button = page.locator('button[aria-label="標題 2"]')
    const bulletListButton = page.locator('button[aria-label="項目符號清單"]')
    const orderedListButton = page.locator('button[aria-label="編號清單"]')
    const linkButton = page.locator('button[aria-label="插入連結"]')
    const undoButton = page.locator('button[aria-label="復原"]')
    const redoButton = page.locator('button[aria-label="重做"]')

    console.log('\n========== 檢查工具列按鈕 ==========')
    await expect(boldButton).toBeVisible()
    console.log('✅ 粗體按鈕存在')
    await expect(italicButton).toBeVisible()
    console.log('✅ 斜體按鈕存在')
    await expect(h1Button).toBeVisible()
    console.log('✅ 標題 1 按鈕存在')
    await expect(h2Button).toBeVisible()
    console.log('✅ 標題 2 按鈕存在')
    await expect(bulletListButton).toBeVisible()
    console.log('✅ 項目符號清單按鈕存在')
    await expect(orderedListButton).toBeVisible()
    console.log('✅ 編號清單按鈕存在')
    await expect(linkButton).toBeVisible()
    console.log('✅ 插入連結按鈕存在')
    await expect(undoButton).toBeVisible()
    console.log('✅ 復原按鈕存在')
    await expect(redoButton).toBeVisible()
    console.log('✅ 重做按鈕存在')

    // 測試編輯功能
    console.log('\n========== 測試編輯功能 ==========')

    // 點擊編輯器
    await editor.click()
    await page.waitForTimeout(500)

    // 輸入文字
    await page.keyboard.type('測試 TipTap 編輯器')
    await page.waitForTimeout(1000)
    console.log('✅ 文字輸入成功')

    // 檢查文字是否出現在編輯器中
    const editorContent = await editor.textContent()
    if (editorContent && editorContent.includes('測試')) {
      console.log('✅ 編輯器內容更新成功')
    }

    // 測試工具列按鈕是否可點擊
    await boldButton.click()
    await page.waitForTimeout(300)
    console.log('✅ 粗體按鈕可點擊')

    await italicButton.click()
    await page.waitForTimeout(300)
    console.log('✅ 斜體按鈕可點擊')

    // 測試復原功能
    await undoButton.click()
    await page.waitForTimeout(300)
    console.log('✅ 復原按鈕可點擊')

    // 檢查 Console 錯誤
    console.log('\n========== Console 檢查 ==========')
    if (consoleErrors.length > 0) {
      console.log(`❌ 發現 ${consoleErrors.length} 個 console 錯誤:`)
      consoleErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`)
      })
    } else {
      console.log('✅ 無 console 錯誤')
    }

    // 檢查是否有 React 錯誤
    const reactErrors = consoleLogs.filter(log =>
      log.includes('Warning:') ||
      log.includes('Error:') ||
      log.includes('Uncaught')
    )

    if (reactErrors.length > 0) {
      console.log(`⚠️  發現 ${reactErrors.length} 個 React 警告:`)
      reactErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`)
      })
    }

    // 截圖
    await page.screenshot({
      path: 'test-results/tiptap-editor.png',
      fullPage: true
    })
    console.log('\n✅ 截圖已保存: test-results/tiptap-editor.png')

    console.log('\n========== 測試完成 ==========')
    expect(consoleErrors.length).toBe(0)
  })
})
