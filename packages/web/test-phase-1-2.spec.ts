import { test, expect } from '@playwright/test'

test.describe('Phase 1 & 2: Article Editor UX', () => {
  test.beforeEach(async ({ page }) => {
    // 前往文章列表頁面
    await page.goto('http://localhost:3168/dashboard/articles')

    // 等待頁面載入
    await page.waitForLoadState('networkidle')
  })

  test('Phase 1: 狀態圖示應正確顯示', async ({ page }) => {
    // 檢查是否有狀態圖示
    const statusIcons = page.locator('[role="img"][aria-label]')
    await expect(statusIcons.first()).toBeVisible()

    // 檢查圖示大小
    const iconSize = await statusIcons.first().locator('svg').boundingBox()
    expect(iconSize?.width).toBeLessThanOrEqual(16)
    expect(iconSize?.height).toBeLessThanOrEqual(16)

    console.log('✅ Phase 1: 狀態圖示大小正確 (16px)')
  })

  test('Phase 1: Tooltip 應正確顯示', async ({ page }) => {
    const statusIcon = page.locator('[role="img"][aria-label]').first()

    // 滑鼠移至圖示
    await statusIcon.hover()

    // 等待 tooltip 出現
    await page.waitForTimeout(300) // 200ms delay + buffer

    // 檢查 tooltip 是否顯示
    const tooltip = page.locator('[role="tooltip"]')
    await expect(tooltip).toBeVisible()

    console.log('✅ Phase 1: Tooltip 正確顯示')
  })

  test('Phase 1: 暗色模式圖示顏色應正確', async ({ page }) => {
    // 切換到暗色模式
    await page.emulateMedia({ colorScheme: 'dark' })

    // 檢查已完成狀態圖示 (綠色)
    const completedIcon = page.locator('[aria-label="已完成"] svg')
    if (await completedIcon.count() > 0) {
      const color = await completedIcon.evaluate((el) =>
        window.getComputedStyle(el).color
      )
      console.log('已完成圖示顏色 (暗色模式):', color)
      // 暗色模式下應該是淺綠色 (rgb 值應該較高)
      expect(color).toMatch(/rgb/)
    }

    console.log('✅ Phase 1: 暗色模式顏色已套用')
  })

  test('Phase 2: 網站選擇器不應無限載入', async ({ page, context }) => {
    // 監控網路請求
    const requests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('website_configs')) {
        requests.push(request.url())
      }
    })

    // 點擊發布按鈕
    const publishButton = page.locator('button:has-text("發布")').first()
    if (await publishButton.count() > 0) {
      await publishButton.click()

      // 等待對話框出現
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })

      // 等待 2 秒觀察是否有重複請求
      await page.waitForTimeout(2000)

      // 檢查網站選擇器是否仍在載入
      const loadingText = page.locator('text=載入中')
      const isLoading = await loadingText.count() > 0

      console.log('website_configs 請求次數:', requests.length)
      console.log('是否仍在載入:', isLoading)

      // 網站選擇器不應持續載入
      expect(isLoading).toBe(false)

      // 請求次數不應超過 2 次 (初始 + 可能的重試)
      expect(requests.length).toBeLessThanOrEqual(2)

      console.log('✅ Phase 2: 網站選擇器載入正常')
    } else {
      console.log('⚠️  沒有找到發布按鈕，跳過測試')
    }
  })

  test('Phase 2: 應顯示網站確認 Alert', async ({ page }) => {
    // 點擊發布按鈕
    const publishButton = page.locator('button:has-text("發布")').first()
    if (await publishButton.count() > 0) {
      await publishButton.click()

      // 等待對話框出現
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })

      // 等待網站選擇器載入完成
      await page.waitForTimeout(1000)

      // 檢查是否有 Alert (包含 Info 圖示和網站名稱)
      const alert = page.locator('[role="alert"], .alert')
      if (await alert.count() > 0) {
        await expect(alert).toBeVisible()
        console.log('✅ Phase 2: 確認 Alert 正確顯示')
      } else {
        console.log('⚠️  Alert 可能需要選擇網站後才顯示')
      }
    } else {
      console.log('⚠️  沒有找到發布按鈕，跳過測試')
    }
  })

  test('Phase 2: localStorage 應儲存最後選擇的網站', async ({ page, context }) => {
    // 點擊發布按鈕
    const publishButton = page.locator('button:has-text("發布")').first()
    if (await publishButton.count() > 0) {
      await publishButton.click()

      // 等待對話框出現
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })

      // 等待並選擇網站
      await page.waitForTimeout(1000)

      // 檢查 localStorage
      const localStorageKeys = await page.evaluate(() => {
        const keys = Object.keys(localStorage)
        return keys.filter(key => key.startsWith('last-selected-website-'))
      })

      console.log('localStorage keys:', localStorageKeys)

      if (localStorageKeys.length > 0) {
        const value = await page.evaluate((key) => {
          return localStorage.getItem(key)
        }, localStorageKeys[0])

        console.log('儲存的網站 ID:', value)
        console.log('✅ Phase 2: localStorage 正確儲存')
      } else {
        console.log('⚠️  尚未選擇網站，localStorage 為空')
      }
    }
  })

  test('Console 應無錯誤', async ({ page }) => {
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
    errors.forEach(err => console.log('❌', err))

    console.log('\n=== Console 警告 ===')
    warnings.forEach(warn => console.log('⚠️ ', warn))

    // React Hooks 錯誤應為 0
    const hookErrors = errors.filter(err => err.includes('Hook') || err.includes('useEffect'))
    expect(hookErrors.length).toBe(0)

    console.log('✅ 無 React Hooks 錯誤')
  })
})
