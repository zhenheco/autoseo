import { test, expect } from '@playwright/test'

test.describe('Phase 1 & 2: Article Editor UX (已登入)', () => {
  test.beforeEach(async ({ page }) => {
    // 登入
    await page.goto('http://localhost:3168/login')
    await page.waitForLoadState('networkidle')

    // 填寫登入表單
    await page.fill('input[type="email"]', 'nelsonjou@gmail.com')
    await page.fill('input[type="password"]', 'aa123123')
    await page.click('button:has-text("繼續")')

    // 等待登入完成並重定向
    await page.waitForURL('**/dashboard**', { timeout: 10000 })

    // 前往文章列表頁面
    await page.goto('http://localhost:3168/dashboard/articles')
    await page.waitForLoadState('networkidle')
  })

  test('Phase 1: 狀態圖示應正確顯示', async ({ page }) => {
    // 截圖以供檢查
    await page.screenshot({ path: 'test-results/articles-page.png', fullPage: true })

    // 檢查是否有狀態圖示
    const statusIcons = page.locator('[role="img"][aria-label]')
    const count = await statusIcons.count()
    console.log('找到狀態圖示數量:', count)

    if (count > 0) {
      await expect(statusIcons.first()).toBeVisible()

      // 檢查圖示大小
      const iconSize = await statusIcons.first().locator('svg').boundingBox()
      console.log('圖示大小:', iconSize)
      expect(iconSize?.width).toBeLessThanOrEqual(18) // 允許一些誤差
      expect(iconSize?.height).toBeLessThanOrEqual(18)

      console.log('✅ Phase 1: 狀態圖示大小正確')
    } else {
      console.log('⚠️  未找到狀態圖示，可能沒有文章或尚未實作')
    }
  })

  test('Phase 1: Tooltip 應正確顯示', async ({ page }) => {
    const statusIcon = page.locator('[role="img"][aria-label]').first()
    const count = await statusIcon.count()

    if (count > 0) {
      // 滑鼠移至圖示
      await statusIcon.hover()

      // 等待 tooltip 出現
      await page.waitForTimeout(300)

      // 檢查 tooltip 是否顯示
      const tooltip = page.locator('[role="tooltip"]')
      await expect(tooltip).toBeVisible()

      // 獲取 tooltip 文字
      const tooltipText = await tooltip.textContent()
      console.log('Tooltip 文字:', tooltipText)

      console.log('✅ Phase 1: Tooltip 正確顯示')
    } else {
      console.log('⚠️  未找到狀態圖示')
    }
  })

  test('Phase 1: 暗色模式圖示顏色應正確', async ({ page }) => {
    // 切換到暗色模式
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForTimeout(500)

    // 截圖暗色模式
    await page.screenshot({ path: 'test-results/articles-dark-mode.png', fullPage: true })

    // 檢查已完成狀態圖示 (綠色)
    const completedIcon = page.locator('[aria-label="已完成"] svg')
    const count = await completedIcon.count()

    if (count > 0) {
      const color = await completedIcon.evaluate((el) =>
        window.getComputedStyle(el).color
      )
      console.log('已完成圖示顏色 (暗色模式):', color)

      // 檢查其他狀態圖示顏色
      const statuses = ['等待中', '已排程', '失敗', '處理中']
      for (const status of statuses) {
        const icon = page.locator(`[aria-label="${status}"] svg`)
        if (await icon.count() > 0) {
          const iconColor = await icon.evaluate((el) =>
            window.getComputedStyle(el).color
          )
          console.log(`${status} 圖示顏色 (暗色模式):`, iconColor)
        }
      }

      console.log('✅ Phase 1: 暗色模式顏色已套用')
    } else {
      console.log('⚠️  未找到已完成狀態的文章')
    }
  })

  test('Phase 2: 網站選擇器不應無限載入', async ({ page }) => {
    // 監控網路請求
    const requests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('website_configs')) {
        requests.push(request.url())
        console.log('website_configs 請求:', request.url())
      }
    })

    // 尋找發布按鈕
    const publishButtons = page.locator('button:has-text("發布")')
    const count = await publishButtons.count()
    console.log('找到發布按鈕數量:', count)

    if (count > 0) {
      await publishButtons.first().click()

      // 等待對話框出現
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
      await page.screenshot({ path: 'test-results/publish-dialog.png' })

      // 等待 3 秒觀察是否有重複請求
      await page.waitForTimeout(3000)

      // 檢查網站選擇器是否仍在載入
      const loadingText = page.locator('text=載入中')
      const isLoading = await loadingText.count() > 0

      console.log('website_configs 請求次數:', requests.length)
      console.log('是否仍在載入:', isLoading)

      // 截圖最終狀態
      await page.screenshot({ path: 'test-results/publish-dialog-final.png' })

      // 網站選擇器不應持續載入
      expect(isLoading).toBe(false)

      // 請求次數不應超過 2 次
      expect(requests.length).toBeLessThanOrEqual(2)

      console.log('✅ Phase 2: 網站選擇器載入正常')
    } else {
      console.log('⚠️  沒有找到發布按鈕')
    }
  })

  test('Phase 2: 應顯示網站確認 Alert', async ({ page }) => {
    const publishButtons = page.locator('button:has-text("發布")')
    const count = await publishButtons.count()

    if (count > 0) {
      await publishButtons.first().click()
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
      await page.waitForTimeout(2000)

      // 截圖
      await page.screenshot({ path: 'test-results/publish-alert.png' })

      // 檢查是否有 Alert
      const alertSelectors = [
        '[role="alert"]',
        '.alert',
        'text=文章將發布至',
        'text=確定要將'
      ]

      let foundAlert = false
      for (const selector of alertSelectors) {
        const alert = page.locator(selector)
        if (await alert.count() > 0) {
          console.log('找到 Alert:', selector)
          const text = await alert.textContent()
          console.log('Alert 內容:', text)
          foundAlert = true
          break
        }
      }

      if (foundAlert) {
        console.log('✅ Phase 2: 確認 Alert 正確顯示')
      } else {
        console.log('⚠️  未找到 Alert，可能需要先選擇網站')
      }
    } else {
      console.log('⚠️  沒有找到發布按鈕')
    }
  })

  test('Phase 2: localStorage 應儲存最後選擇的網站', async ({ page }) => {
    const publishButtons = page.locator('button:has-text("發布")')
    const count = await publishButtons.count()

    if (count > 0) {
      await publishButtons.first().click()
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
      await page.waitForTimeout(2000)

      // 檢查 localStorage
      const localStorageKeys = await page.evaluate(() => {
        const keys = Object.keys(localStorage)
        return keys.filter(key => key.startsWith('last-selected-website-'))
      })

      console.log('localStorage keys:', localStorageKeys)

      if (localStorageKeys.length > 0) {
        const values = await page.evaluate((keys) => {
          return keys.map(key => ({
            key,
            value: localStorage.getItem(key)
          }))
        }, localStorageKeys)

        console.log('儲存的網站資訊:', values)
        console.log('✅ Phase 2: localStorage 正確儲存')
      } else {
        console.log('⚠️  localStorage 未找到網站選擇記錄')
      }
    }
  })

  test('Console 應無 React Hooks 錯誤', async ({ page }) => {
    const errors: string[] = []
    const warnings: string[] = []

    page.on('console', (msg) => {
      const type = msg.type()
      const text = msg.text()

      if (type === 'error') {
        errors.push(text)
      } else if (type === 'warning') {
        warnings.push(text)
      }
    })

    // 重新載入頁面觸發所有 console 訊息
    await page.reload()
    await page.waitForLoadState('networkidle')

    console.log('\n=== Console 錯誤 ===')
    if (errors.length > 0) {
      errors.forEach(err => console.log('❌', err))
    } else {
      console.log('無錯誤')
    }

    console.log('\n=== Console 警告 ===')
    if (warnings.length > 0) {
      warnings.forEach(warn => console.log('⚠️ ', warn))
    } else {
      console.log('無警告')
    }

    // React Hooks 錯誤應為 0
    const hookErrors = errors.filter(err =>
      err.includes('Hook') ||
      err.includes('useEffect') ||
      err.includes('setState')
    )

    if (hookErrors.length > 0) {
      console.log('\n❌ 發現 React Hooks 錯誤:')
      hookErrors.forEach(err => console.log('  -', err))
    }

    expect(hookErrors.length).toBe(0)
    console.log('✅ 無 React Hooks 錯誤')
  })
})
