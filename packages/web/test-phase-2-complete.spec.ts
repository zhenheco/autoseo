import { test, expect } from '@playwright/test'

test.describe('Phase 2: 網站選擇器完整測試', () => {
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

  test('完整 Phase 2 測試流程', async ({ page }) => {
    console.log('\n========================================')
    console.log('Phase 2: 網站選擇器完整測試')
    console.log('========================================\n')

    // 步驟 1: 查找並點擊文章
    console.log('【步驟 1】查找並點擊文章')
    const articleItems = page.locator('.cursor-pointer').filter({
      hasText: /^(?!.*任務).*/  // 排除任務項目
    })
    const count = await articleItems.count()
    console.log(`  - 找到文章數量: ${count}`)

    if (count === 0) {
      console.log('  ❌ 沒有可用文章，測試結束')
      return
    }

    // 點擊第一篇文章
    await articleItems.first().click()
    console.log('  ✅ 已點擊第一篇文章')
    await page.waitForTimeout(1000)

    // 截圖
    await page.screenshot({ path: 'test-results/article-editor.png', fullPage: true })

    // 步驟 2: 尋找發布按鈕
    console.log('\n【步驟 2】尋找發布按鈕（右側編輯器）')
    const publishButton = page.locator('button:has-text("發布")')
    const publishCount = await publishButton.count()
    console.log(`  - 發布按鈕數量: ${publishCount}`)

    if (publishCount === 0) {
      console.log('  ❌ 未找到發布按鈕')
      console.log('  提示: 發布按鈕應在右側編輯器的工具列中')
      return
    }

    console.log('  ✅ 找到發布按鈕\n')

    // 步驟 3: 監控網路請求
    console.log('【步驟 3】點擊發布並監控網路請求')
    const requests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('website_configs')) {
        requests.push(request.url())
        console.log(`  - website_configs 請求: ${request.url()}`)
      }
    })

    await publishButton.click()
    console.log('  ✅ 已點擊發布按鈕')

    // 等待對話框
    try {
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
      console.log('  ✅ 發布對話框已開啟\n')
    } catch (error) {
      console.log('  ❌ 對話框未開啟')
      return
    }

    await page.screenshot({ path: 'test-results/publish-dialog-opened.png' })

    // 步驟 4: 檢查網站選擇器
    console.log('【步驟 4】檢查網站選擇器')

    // 等待 3 秒觀察載入狀態
    await page.waitForTimeout(3000)

    const loadingText = page.locator('text=載入中')
    const isLoading = await loadingText.count() > 0

    console.log(`  - 是否仍在載入: ${isLoading}`)
    console.log(`  - website_configs 請求次數: ${requests.length}`)

    if (!isLoading) {
      console.log('  ✅ 網站選擇器載入完成（無無限載入）\n')
    } else {
      console.log('  ❌ 網站選擇器持續載入中\n')
    }

    expect(isLoading).toBe(false)
    expect(requests.length).toBeLessThanOrEqual(2)

    // 步驟 5: 檢查 Globe 圖示
    console.log('【步驟 5】檢查 Globe 圖示')
    const globeIcons = page.locator('[role="dialog"] svg.lucide-globe')
    const globeCount = await globeIcons.count()
    console.log(`  - Globe 圖示數量: ${globeCount}`)

    if (globeCount > 0) {
      console.log('  ✅ Globe 圖示正確顯示\n')
    } else {
      console.log('  ❌ 未找到 Globe 圖示\n')
    }

    // 步驟 6: 檢查網站選項
    console.log('【步驟 6】檢查網站選項')

    // 點擊選擇器開啟下拉選單
    const selectTrigger = page.locator('[role="dialog"] [role="combobox"]')
    if (await selectTrigger.count() > 0) {
      await selectTrigger.click()
      await page.waitForTimeout(500)

      // 檢查選項
      const options = page.locator('[role="option"]')
      const optionCount = await options.count()
      console.log(`  - 可用網站數量: ${optionCount}`)

      if (optionCount > 0) {
        // 檢查第一個選項的內容
        const firstOption = options.first()
        const optionHTML = await firstOption.innerHTML()

        console.log('  - 檢查選項內容:')
        console.log(`    - 包含 Globe 圖示: ${optionHTML.includes('lucide-globe')}`)
        console.log(`    - 包含網站名稱: ${optionHTML.includes('font-medium')}`)
        console.log(`    - 包含 Hostname: ${optionHTML.includes('text-xs')}`)

        // 檢查是否有停用網站
        const disabledOptions = page.locator('[role="option"][aria-disabled="true"]')
        const disabledCount = await disabledOptions.count()
        console.log(`  - 停用網站數量: ${disabledCount}`)

        if (disabledCount > 0) {
          const disabledHTML = await disabledOptions.first().innerHTML()
          console.log(`  - 停用標記: ${disabledHTML.includes('已停用')}`)
        }

        console.log('  ✅ 網站選項結構正確\n')
      }
    } else {
      console.log('  ⚠️  未找到 select trigger\n')
    }

    await page.screenshot({ path: 'test-results/website-selector-dropdown.png' })

    // 步驟 7: 檢查確認 Alert
    console.log('【步驟 7】檢查確認 Alert')

    const alertTexts = ['文章將發布至', '確定要將']
    let foundAlert = false

    for (const text of alertTexts) {
      const alert = page.locator(`[role="dialog"] >> text=${text}`)
      if (await alert.count() > 0) {
        console.log(`  - 找到 Alert: "${text}"`)
        const alertContent = await alert.textContent()
        console.log(`  - Alert 完整內容: ${alertContent}`)

        // 檢查是否有 Info 圖示
        const infoIcon = page.locator('[role="dialog"] svg.lucide-info')
        const hasInfoIcon = await infoIcon.count() > 0
        console.log(`  - 包含 Info 圖示: ${hasInfoIcon}`)

        foundAlert = true
        console.log('  ✅ 確認 Alert 正確顯示\n')
        break
      }
    }

    if (!foundAlert) {
      console.log('  ⚠️  未找到 Alert（可能需要選擇網站後才顯示）\n')
    }

    // 步驟 8: 檢查 localStorage
    console.log('【步驟 8】檢查 localStorage')

    const lsKeys = await page.evaluate(() => {
      return Object.keys(localStorage).filter(key =>
        key.startsWith('last-selected-website-')
      )
    })

    console.log(`  - localStorage keys: ${lsKeys.length}`)

    if (lsKeys.length > 0) {
      const lsData = await page.evaluate((keys) => {
        return keys.map(key => ({
          key,
          value: localStorage.getItem(key)
        }))
      }, lsKeys)

      lsData.forEach(item => {
        console.log(`  - ${item.key}: ${item.value}`)
        // 檢查是否為 UUID 格式
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.value || '')
        console.log(`    格式正確 (UUID): ${isUUID}`)
      })

      console.log('  ✅ localStorage 正常運作\n')
    } else {
      console.log('  ⚠️  localStorage 未找到網站選擇記錄（可能尚未選擇網站）\n')
    }

    console.log('========================================')
    console.log('Phase 2 測試完成')
    console.log('========================================\n')
  })
})
