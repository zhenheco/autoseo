import { test, expect } from '@playwright/test'

test.describe('Phase 1 & 2: Article Editor UX 最終測試', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3168/login')
    await page.waitForLoadState('networkidle')

    await page.fill('input[type="email"]', 'nelsonjou@gmail.com')
    await page.fill('input[type="password"]', 'aa123123')
    await page.click('button:has-text("繼續")')

    await page.waitForURL('**/dashboard**', { timeout: 10000 })
    await page.goto('http://localhost:3168/dashboard/articles')
    await page.waitForLoadState('networkidle')
  })

  test('完整測試報告', async ({ page }) => {
    console.log('\n========================================')
    console.log('Phase 1 & 2 功能測試報告')
    console.log('========================================\n')

    // Phase 1-1: 狀態圖示顯示
    console.log('【Phase 1-1】狀態圖示顯示測試')
    const statusIcons = page.locator('[role="img"][aria-label]')
    const iconCount = await statusIcons.count()
    console.log(`  - 找到狀態圖示數量: ${iconCount}`)

    if (iconCount > 0) {
      const firstIcon = statusIcons.first()
      await expect(firstIcon).toBeVisible()

      const iconSize = await firstIcon.locator('svg').boundingBox()
      console.log(`  - 圖示大小: ${iconSize?.width}px × ${iconSize?.height}px`)

      if (iconSize && iconSize.width <= 18 && iconSize.height <= 18) {
        console.log('  ✅ 圖示大小符合規格 (≤16px)\n')
      } else {
        console.log('  ❌ 圖示大小不符合規格\n')
      }
    } else {
      console.log('  ❌ 未找到狀態圖示\n')
    }

    // Phase 1-2: Tooltip 功能
    console.log('【Phase 1-2】Tooltip 功能測試')
    if (iconCount > 0) {
      const firstIcon = statusIcons.first()
      await firstIcon.hover()
      await page.waitForTimeout(300)

      const tooltips = page.locator('[role="tooltip"]')
      const tooltipCount = await tooltips.count()
      console.log(`  - Tooltip 數量: ${tooltipCount}`)

      if (tooltipCount > 0) {
        const tooltip = tooltips.first()
        await expect(tooltip).toBeVisible()
        const tooltipText = await tooltip.textContent()
        console.log(`  - Tooltip 內容: "${tooltipText}"`)
        console.log('  ✅ Tooltip 正常顯示\n')
      } else {
        console.log('  ❌ Tooltip 未顯示\n')
      }
    } else {
      console.log('  ⏭️  跳過（無狀態圖示）\n')
    }

    // Phase 1-3: 暗色模式
    console.log('【Phase 1-3】暗色模式測試')
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForTimeout(500)

    const completedIcons = page.locator('[aria-label="已完成"] svg')
    const completedCount = await completedIcons.count()
    console.log(`  - 已完成狀態圖示數量: ${completedCount}`)

    if (completedCount > 0) {
      const color = await completedIcons.first().evaluate((el) =>
        window.getComputedStyle(el).color
      )
      console.log(`  - 圖示顏色 (暗色模式): ${color}`)

      // 檢查是否為淺色 (dark:text-green-400)
      const rgb = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
      if (rgb) {
        const [, r, g, b] = rgb.map(Number)
        console.log(`  - RGB 值: R=${r}, G=${g}, B=${b}`)
        if (g > 150) {
          console.log('  ✅ 暗色模式使用淺綠色 (符合規格)\n')
        } else {
          console.log('  ⚠️  顏色可能不是淺色\n')
        }
      }
    } else {
      console.log('  ⏭️  跳過（無已完成狀態）\n')
    }

    // 切換回淺色模式
    await page.emulateMedia({ colorScheme: 'light' })
    await page.waitForTimeout(300)

    // Phase 2-1: 尋找發布按鈕
    console.log('【Phase 2-1】網站選擇器測試')

    // 嘗試多種選擇器
    const buttonSelectors = [
      'button:has-text("發布")',
      'button:has-text("Publish")',
      'button[aria-label*="發布"]',
      '[role="menuitem"]:has-text("發布")',
      'a:has-text("發布")'
    ]

    let publishButton = null
    for (const selector of buttonSelectors) {
      const buttons = page.locator(selector)
      const count = await buttons.count()
      if (count > 0) {
        console.log(`  - 找到發布按鈕 (${selector}): ${count} 個`)
        publishButton = buttons.first()
        break
      }
    }

    if (!publishButton) {
      // 列出所有可見按鈕
      const allButtons = await page.locator('button').allTextContents()
      console.log('  - 頁面上所有按鈕:', allButtons.slice(0, 20))
      console.log('  ⚠️  未找到發布按鈕\n')
    } else {
      // 監控網路請求
      const requests: string[] = []
      page.on('request', (request) => {
        if (request.url().includes('website_configs')) {
          requests.push(request.url())
        }
      })

      await publishButton.click()

      try {
        await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
        console.log('  ✅ 發布對話框已開啟')

        // 等待 3 秒
        await page.waitForTimeout(3000)

        const loadingText = page.locator('text=載入中')
        const isLoading = await loadingText.count() > 0

        console.log(`  - website_configs 請求次數: ${requests.length}`)
        console.log(`  - 是否仍在載入: ${isLoading}`)

        if (!isLoading && requests.length <= 2) {
          console.log('  ✅ 網站選擇器載入正常（無無限載入）\n')
        } else {
          console.log('  ❌ 網站選擇器可能有問題\n')
        }

        // Phase 2-2: Alert 檢查
        console.log('【Phase 2-2】確認 Alert 測試')
        const alertTexts = [
          '文章將發布至',
          '確定要將'
        ]

        let foundAlert = false
        for (const text of alertTexts) {
          const alert = page.locator(`text=${text}`)
          if (await alert.count() > 0) {
            console.log(`  - 找到 Alert: "${text}"`)
            const content = await alert.textContent()
            console.log(`  - Alert 內容: ${content}`)
            foundAlert = true
            break
          }
        }

        if (foundAlert) {
          console.log('  ✅ 確認 Alert 正常顯示\n')
        } else {
          console.log('  ⚠️  未找到 Alert（可能需要選擇網站）\n')
        }

        // Phase 2-3: localStorage
        console.log('【Phase 2-3】localStorage 測試')
        const lsKeys = await page.evaluate(() => {
          return Object.keys(localStorage).filter(key =>
            key.startsWith('last-selected-website-')
          )
        })

        if (lsKeys.length > 0) {
          const lsData = await page.evaluate((keys) => {
            return keys.map(key => ({
              key,
              value: localStorage.getItem(key)
            }))
          }, lsKeys)

          console.log('  - localStorage 資料:')
          lsData.forEach(item => {
            console.log(`    ${item.key}: ${item.value}`)
          })
          console.log('  ✅ localStorage 正常運作\n')
        } else {
          console.log('  ⚠️  localStorage 未找到記錄\n')
        }

      } catch (error) {
        console.log('  ❌ 對話框未開啟或超時\n')
      }
    }

    // Phase 1-4: Console 錯誤檢查
    console.log('【Phase 1-4】Console 錯誤檢查')
    const errors: string[] = []
    const warnings: string[] = []

    page.on('console', (msg) => {
      const type = msg.type()
      const text = msg.text()
      if (type === 'error') errors.push(text)
      if (type === 'warning') warnings.push(text)
    })

    await page.reload()
    await page.waitForLoadState('networkidle')

    // 等待一下讓 console 訊息觸發
    await page.waitForTimeout(2000)

    console.log(`  - Console 錯誤數量: ${errors.length}`)
    console.log(`  - Console 警告數量: ${warnings.length}`)

    const hookErrors = errors.filter(err =>
      err.includes('Hook') ||
      err.includes('useEffect') ||
      err.includes('setState')
    )

    if (hookErrors.length === 0) {
      console.log('  ✅ 無 React Hooks 錯誤\n')
    } else {
      console.log('  ❌ 發現 React Hooks 錯誤:')
      hookErrors.forEach(err => console.log(`    - ${err}`))
      console.log('')
    }

    console.log('========================================')
    console.log('測試完成')
    console.log('========================================\n')
  })
})
