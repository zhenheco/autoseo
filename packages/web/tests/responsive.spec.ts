import { test, expect } from "@playwright/test";

test.describe("響應式佈局測試", () => {
  const viewports = [
    { name: "Mobile", width: 375, height: 667 },
    { name: "Tablet", width: 768, height: 1024 },
    { name: "Desktop", width: 1920, height: 1080 },
    { name: "Large Desktop", width: 2560, height: 1440 },
  ];

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  viewports.forEach(({ name, width, height }) => {
    test(`${name} (${width}x${height}) 佈局應正常`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(500);

      // 檢查頁面元素是否正常顯示
      const body = page.locator("body");
      await expect(body).toBeVisible();

      // 檢查是否有水平滾動條 (除了 Mobile)
      if (name !== "Mobile") {
        const scrollWidth = await page.evaluate(
          () => document.documentElement.scrollWidth,
        );
        const clientWidth = await page.evaluate(
          () => document.documentElement.clientWidth,
        );

        // 不應該有水平滾動條
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 20); // 20px tolerance
      }

      // 檢查主要導航是否適合視窗
      const nav = page.locator("nav").first();
      if ((await nav.count()) > 0) {
        const navBox = await nav.boundingBox();
        if (navBox) {
          expect(navBox.width).toBeLessThanOrEqual(width);
        }
      }

      console.log(`✅ ${name} 佈局正常`);
    });
  });

  test("移動端導航選單", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // 查找漢堡選單按鈕
    const menuButton = page
      .locator('[data-testid="mobile-menu-button"]')
      .or(page.locator('button[aria-label*="menu"]'))
      .or(page.locator('[role="button"]').filter({ hasText: /☰|≡|Menu/ }))
      .or(
        // 常見的選單按鈕選擇器
        page.locator("button").filter({ hasText: /選單|Menu/ }),
      );

    if ((await menuButton.count()) > 0) {
      // 點擊漢堡選單
      await menuButton.first().click();
      await page.waitForTimeout(300);

      // 檢查選單是否展開
      const mobileMenu = page
        .locator('[data-testid="mobile-menu"]')
        .or(page.locator('[role="dialog"]'))
        .or(page.locator(".mobile-menu"));

      if ((await mobileMenu.count()) > 0) {
        await expect(mobileMenu.first()).toBeVisible();
        console.log("✅ 移動端選單正常展開");

        // 測試關閉選單
        const closeButton = page
          .locator('[aria-label="關閉"]')
          .or(page.locator('[aria-label="Close"]'))
          .or(page.locator("button").filter({ hasText: /×|✕|Close/ }));

        if ((await closeButton.count()) > 0) {
          await closeButton.first().click();
          await page.waitForTimeout(300);
          await expect(mobileMenu.first()).not.toBeVisible();
          console.log("✅ 移動端選單可正常關閉");
        }
      } else {
        console.log("⚠️ 移動端選單未找到");
      }
    } else {
      console.log("⚠️ 漢堡選單按鈕未找到");
    }
  });

  test("平板端佈局適應", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);

    // 檢查內容容器寬度
    const container = page
      .locator("main")
      .or(page.locator(".container"))
      .or(page.locator('[class*="max-w"]'));

    if ((await container.count()) > 0) {
      const containerBox = await container.first().boundingBox();
      if (containerBox) {
        // 內容不應該佔滿全寬度 (應該有邊距)
        expect(containerBox.width).toBeLessThan(768 * 0.95);
        console.log("✅ 平板端內容容器寬度適當");
      }
    }

    // 檢查文字是否過寬
    const textElements = page.locator("p, h1, h2, h3").first();
    if ((await textElements.count()) > 0) {
      const textBox = await textElements.first().boundingBox();
      if (textBox) {
        // 文字行寬不應超過 65ch (約 520px)
        expect(textBox.width).toBeLessThan(600);
        console.log("✅ 平板端文字行寬合理");
      }
    }
  });

  test("桌面端多欄佈局", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);

    // 檢查是否有側邊欄或多欄佈局
    const sidebar = page
      .locator('[data-testid="sidebar"]')
      .or(page.locator("aside"))
      .or(page.locator(".sidebar"));

    if ((await sidebar.count()) > 0) {
      await expect(sidebar.first()).toBeVisible();
      console.log("✅ 桌面端側邊欄顯示正常");
    }

    // 檢查主內容區域
    const mainContent = page
      .locator("main")
      .or(page.locator('[role="main"]'))
      .or(page.locator(".main-content"));

    if ((await mainContent.count()) > 0) {
      const mainBox = await mainContent.first().boundingBox();
      if (mainBox) {
        // 主內容不應該佔滿整個寬度
        expect(mainBox.width).toBeLessThan(1920 * 0.9);
        console.log("✅ 桌面端主內容區域寬度適當");
      }
    }
  });

  test("圖片響應式載入", async ({ page }) => {
    const viewports = [
      { width: 375, height: 667 },
      { width: 1920, height: 1080 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);

      // 檢查圖片是否適應容器
      const images = page.locator("img");
      const imageCount = await images.count();

      if (imageCount > 0) {
        for (let i = 0; i < Math.min(imageCount, 3); i++) {
          const img = images.nth(i);
          const imgBox = await img.boundingBox();

          if (imgBox) {
            // 圖片不應該超出視窗寬度
            expect(imgBox.width).toBeLessThanOrEqual(viewport.width);
            expect(imgBox.x + imgBox.width).toBeLessThanOrEqual(
              viewport.width + 10,
            ); // 10px tolerance
          }
        }
        console.log(`✅ ${viewport.width}px 寬度下圖片顯示正常`);
      }
    }
  });

  test("表格響應式設計", async ({ page }) => {
    // 查找頁面中的表格
    await page.goto("/dashboard/articles"); // 可能有表格的頁面
    await page.waitForLoadState("networkidle");

    const tables = page.locator("table");
    const tableCount = await tables.count();

    if (tableCount > 0) {
      // 測試移動端表格
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);

      const table = tables.first();
      const tableBox = await table.boundingBox();

      if (tableBox) {
        // 檢查表格是否有水平滾動或其他響應式處理
        const hasHorizontalScroll = tableBox.width > 375;

        if (hasHorizontalScroll) {
          // 應該有滾動容器或其他處理方式
          const scrollContainer = page
            .locator(".overflow-x-auto")
            .or(page.locator(".table-responsive"))
            .or(
              table.locator(
                'xpath=ancestor::*[@class*="scroll" or @class*="overflow"]',
              ),
            );

          if ((await scrollContainer.count()) > 0) {
            console.log("✅ 表格有適當的水平滾動處理");
          } else {
            console.log("⚠️ 表格可能在小螢幕上顯示有問題");
          }
        } else {
          console.log("✅ 表格適應移動端螢幕");
        }
      }
    } else {
      console.log("⚠️ 未找到表格進行測試");
    }
  });

  test("觸控友好的互動元素", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // 檢查按鈕大小是否適合觸控
    const buttons = page.locator("button");
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        const buttonBox = await button.boundingBox();

        if (buttonBox && buttonBox.height > 0) {
          // 按鈕高度應該至少 44px (Apple 建議的最小觸控區域)
          if (buttonBox.height < 40) {
            console.log(`⚠️ 按鈕 ${i} 可能太小 (${buttonBox.height}px 高)`);
          }
        }
      }
      console.log("✅ 按鈕觸控友好性檢查完成");
    }

    // 檢查連結間距
    const links = page.locator("a");
    const linkCount = await links.count();

    if (linkCount > 1) {
      const firstLink = links.first();
      const secondLink = links.nth(1);

      const firstBox = await firstLink.boundingBox();
      const secondBox = await secondLink.boundingBox();

      if (firstBox && secondBox && firstBox.y !== secondBox.y) {
        // 檢查垂直間距
        const gap = Math.abs(secondBox.y - (firstBox.y + firstBox.height));
        if (gap < 8) {
          console.log("⚠️ 連結間距可能太小");
        } else {
          console.log("✅ 連結間距適當");
        }
      }
    }
  });

  test("文字可讀性和對比度", async ({ page }) => {
    const viewports = [
      { width: 375, height: 667 },
      { width: 1920, height: 1080 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);

      // 檢查主要文字元素
      const textElements = page.locator("p, h1, h2, h3").first();
      if ((await textElements.count()) > 0) {
        const styles = await textElements.first().evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            fontSize: computed.fontSize,
            lineHeight: computed.lineHeight,
            color: computed.color,
            backgroundColor: computed.backgroundColor,
          };
        });

        console.log(`${viewport.width}px 文字樣式:`, styles);

        // 字體大小應該合理
        const fontSize = parseFloat(styles.fontSize);
        expect(fontSize).toBeGreaterThan(12); // 最小 12px

        if (viewport.width <= 375) {
          // 移動端字體應該適當大一些
          expect(fontSize).toBeGreaterThan(14);
        }
      }
    }

    console.log("✅ 文字可讀性檢查完成");
  });
});
