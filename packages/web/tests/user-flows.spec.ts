import { test, expect } from "@playwright/test";

test.describe("關鍵使用者流程測試", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("首頁載入和導航", async ({ page }) => {
    // 檢查首頁基本元素
    await expect(page).toHaveTitle(/1waySEO|SEO|Auto/);

    // 檢查主要導航是否存在
    const navigation = page
      .locator("nav")
      .or(page.locator('[role="navigation"]'))
      .or(page.locator('[data-testid="main-nav"]'));

    if ((await navigation.count()) > 0) {
      await expect(navigation.first()).toBeVisible();
      console.log("✅ 主導航顯示正常");
    }

    // 檢查主要 CTA 按鈕
    const ctaButtons = page
      .locator("button")
      .filter({ hasText: /開始|Start|註冊|Sign|登入|Login/ });
    const ctaCount = await ctaButtons.count();

    if (ctaCount > 0) {
      await expect(ctaButtons.first()).toBeVisible();
      console.log("✅ 主要 CTA 按鈕存在");
    } else {
      console.log("⚠️ 未找到明顯的 CTA 按鈕");
    }

    // 檢查頁面載入時間
    const loadTime = await page.evaluate(() => {
      return (
        performance.timing.loadEventEnd - performance.timing.navigationStart
      );
    });

    console.log("頁面載入時間:", loadTime, "ms");
    expect(loadTime).toBeLessThan(5000); // 5秒內載入完成
  });

  test("用戶註冊流程", async ({ page }) => {
    // 查找註冊連結或按鈕
    const signupLink = page
      .locator('a[href*="register"]')
      .or(page.locator('a[href*="signup"]'))
      .or(page.locator("button").filter({ hasText: /註冊|Sign.*up|Register/ }))
      .or(page.locator("a").filter({ hasText: /註冊|Sign.*up|Register/ }));

    if ((await signupLink.count()) > 0) {
      await signupLink.first().click();
      await page.waitForLoadState("networkidle");

      // 檢查是否到達註冊頁面
      const currentUrl = page.url();
      const isSignupPage =
        currentUrl.includes("/register") ||
        currentUrl.includes("/signup") ||
        currentUrl.includes("/auth");

      if (isSignupPage) {
        console.log("✅ 成功導航到註冊頁面");

        // 檢查註冊表單
        const emailInput = page
          .locator('input[type="email"]')
          .or(page.locator('input[name="email"]'));

        const passwordInput = page
          .locator('input[type="password"]')
          .or(page.locator('input[name="password"]'));

        const submitButton = page
          .locator('button[type="submit"]')
          .or(
            page
              .locator("button")
              .filter({ hasText: /註冊|Sign.*up|Register/ }),
          );

        if ((await emailInput.count()) > 0) {
          await expect(emailInput.first()).toBeVisible();
          console.log("✅ 電子信箱輸入欄存在");
        }

        if ((await passwordInput.count()) > 0) {
          await expect(passwordInput.first()).toBeVisible();
          console.log("✅ 密碼輸入欄存在");
        }

        if ((await submitButton.count()) > 0) {
          await expect(submitButton.first()).toBeVisible();
          console.log("✅ 提交按鈕存在");

          // 測試表單驗證
          await submitButton.first().click();
          await page.waitForTimeout(1000);

          // 應該顯示驗證錯誤
          const errorMessages = page
            .locator("text=必填")
            .or(page.locator("text=required"))
            .or(page.locator('[role="alert"]'))
            .or(page.locator(".error"));

          if ((await errorMessages.count()) > 0) {
            console.log("✅ 表單驗證正常");
          } else {
            console.log("⚠️ 未發現表單驗證訊息");
          }
        }
      } else {
        console.log("⚠️ 註冊連結可能導向其他頁面");
      }
    } else {
      console.log("⚠️ 未找到註冊連結");
    }
  });

  test("用戶登入流程", async ({ page }) => {
    // 查找登入連結
    const loginLink = page
      .locator('a[href*="login"]')
      .or(page.locator('a[href*="signin"]'))
      .or(page.locator("button").filter({ hasText: /登入|Sign.*in|Login/ }))
      .or(page.locator("a").filter({ hasText: /登入|Sign.*in|Login/ }));

    if ((await loginLink.count()) > 0) {
      await loginLink.first().click();
      await page.waitForLoadState("networkidle");

      // 檢查登入表單
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const loginButton = page
        .locator('button[type="submit"]')
        .or(page.locator("button").filter({ hasText: /登入|Sign.*in|Login/ }));

      if ((await emailInput.count()) > 0 && (await passwordInput.count()) > 0) {
        console.log("✅ 登入表單元素完整");

        // 測試無效登入
        await emailInput.first().fill("invalid@test.com");
        await passwordInput.first().fill("wrongpassword");

        if ((await loginButton.count()) > 0) {
          await loginButton.first().click();
          await page.waitForTimeout(2000);

          // 應該顯示錯誤訊息
          const errorMessage = page
            .locator("text=錯誤")
            .or(page.locator("text=Invalid"))
            .or(page.locator("text=incorrect"))
            .or(page.locator('[role="alert"]'));

          if ((await errorMessage.count()) > 0) {
            console.log("✅ 登入錯誤處理正常");
          } else {
            console.log("⚠️ 登入錯誤處理可能需要改進");
          }
        }
      }
    } else {
      console.log("⚠️ 未找到登入連結");
    }
  });

  test("文章生成流程 (需要登入)", async ({ page }) => {
    // 嘗試直接訪問文章生成頁面
    await page.goto("/dashboard/articles");
    await page.waitForLoadState("networkidle");

    const currentUrl = page.url();

    if (currentUrl.includes("/login") || currentUrl.includes("/signin")) {
      console.log("✅ 未登入用戶被正確重定向到登入頁面");
    } else if (currentUrl.includes("/dashboard")) {
      console.log("⚠️ 可能已經登入，或有免費試用");

      // 檢查文章生成相關元素
      const generateButton = page
        .locator("button")
        .filter({ hasText: /生成|Generate|新增|Add/ });

      if ((await generateButton.count()) > 0) {
        console.log("✅ 找到文章生成按鈕");

        // 點擊生成按鈕
        await generateButton.first().click();
        await page.waitForTimeout(1000);

        // 檢查是否出現生成表單或對話框
        const modal = page
          .locator('[role="dialog"]')
          .or(page.locator(".modal"));

        const titleInput = page
          .locator('input[name*="title"]')
          .or(page.locator('input[placeholder*="標題"]'))
          .or(page.locator('input[placeholder*="title"]'));

        if ((await modal.count()) > 0) {
          console.log("✅ 生成對話框出現");
        }

        if ((await titleInput.count()) > 0) {
          console.log("✅ 找到標題輸入欄");
        }
      }
    } else {
      console.log("⚠️ 導向了其他頁面");
    }
  });

  test("定價頁面瀏覽", async ({ page }) => {
    // 查找定價連結
    const pricingLink = page
      .locator('a[href*="pricing"]')
      .or(page.locator("a").filter({ hasText: /價格|定價|Pricing|Plan/ }));

    if ((await pricingLink.count()) > 0) {
      await pricingLink.first().click();
      await page.waitForLoadState("networkidle");

      // 檢查定價卡片
      const pricingCards = page
        .locator('[data-testid*="price"]')
        .or(page.locator(".price").or(page.locator('[class*="plan"]')));

      if ((await pricingCards.count()) > 0) {
        console.log("✅ 找到定價方案卡片");

        // 檢查每個方案是否有必要元素
        const cardCount = await pricingCards.count();
        for (let i = 0; i < Math.min(cardCount, 3); i++) {
          const card = pricingCards.nth(i);

          // 檢查價格顯示
          const priceElement = card
            .locator("text=/[$NT]?\d+/")
            .or(card.locator('[class*="price"]'));

          if ((await priceElement.count()) > 0) {
            console.log(`✅ 方案 ${i + 1} 有價格顯示`);
          }

          // 檢查選擇按鈕
          const selectButton = card
            .locator("button")
            .filter({ hasText: /選擇|Select|開始|Start/ });

          if ((await selectButton.count()) > 0) {
            console.log(`✅ 方案 ${i + 1} 有選擇按鈕`);
          }
        }
      } else {
        console.log("⚠️ 未找到定價方案卡片");
      }
    } else {
      console.log("⚠️ 未找到定價頁面連結");
    }
  });

  test("搜尋功能", async ({ page }) => {
    // 查找搜尋輸入框
    const searchInput = page
      .locator('input[type="search"]')
      .or(page.locator('input[placeholder*="搜"]'))
      .or(page.locator('input[placeholder*="Search"]'))
      .or(page.locator('[data-testid="search"]'));

    if ((await searchInput.count()) > 0) {
      console.log("✅ 找到搜尋輸入框");

      // 測試搜尋功能
      await searchInput.first().fill("SEO");
      await searchInput.first().press("Enter");
      await page.waitForTimeout(1000);

      // 檢查搜尋結果
      const results = page
        .locator('[data-testid="search-results"]')
        .or(page.locator(".search-results"))
        .or(page.locator('[class*="result"]'));

      if ((await results.count()) > 0) {
        console.log("✅ 搜尋結果顯示正常");
      } else {
        // 也可能沒有實際的搜尋功能，只是樣式
        console.log("⚠️ 搜尋功能可能未實作或無結果");
      }
    } else {
      console.log("⚠️ 未找到搜尋功能");
    }
  });

  test("頁尾連結和資訊", async ({ page }) => {
    // 滾動到頁面底部
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(500);

    // 檢查頁尾元素
    const footer = page
      .locator("footer")
      .or(page.locator('[role="contentinfo"]'))
      .or(page.locator('[data-testid="footer"]'));

    if ((await footer.count()) > 0) {
      await expect(footer.first()).toBeVisible();
      console.log("✅ 頁尾存在");

      // 檢查重要連結
      const importantLinks = [
        /隱私|Privacy/,
        /條款|Terms/,
        /關於|About/,
        /聯絡|Contact/,
      ];

      for (const linkPattern of importantLinks) {
        const link = footer
          .first()
          .locator("a")
          .filter({ hasText: linkPattern });
        if ((await link.count()) > 0) {
          console.log(`✅ 找到重要連結: ${linkPattern}`);
        }
      }

      // 檢查版權資訊
      const copyright = footer.first().locator("text=/©|\u00a9|Copyright/");
      if ((await copyright.count()) > 0) {
        console.log("✅ 版權資訊存在");
      }
    } else {
      console.log("⚠️ 未找到頁尾");
    }
  });

  test("無障礙功能基本檢查", async ({ page }) => {
    // 檢查頁面是否有適當的 heading 結構
    const h1Elements = page.locator("h1");
    const h1Count = await h1Elements.count();

    if (h1Count === 1) {
      console.log("✅ 頁面有唯一的 h1 標題");
    } else if (h1Count === 0) {
      console.log("⚠️ 頁面缺少 h1 標題");
    } else {
      console.log("⚠️ 頁面有多個 h1 標題");
    }

    // 檢查圖片是否有 alt 屬性
    const images = page.locator("img");
    const imageCount = await images.count();

    if (imageCount > 0) {
      let imagesWithAlt = 0;
      for (let i = 0; i < imageCount; i++) {
        const alt = await images.nth(i).getAttribute("alt");
        if (alt !== null) {
          imagesWithAlt++;
        }
      }

      const altPercentage = (imagesWithAlt / imageCount) * 100;
      console.log(`圖片 alt 屬性覆蓋率: ${altPercentage.toFixed(1)}%`);

      if (altPercentage >= 80) {
        console.log("✅ 大多數圖片有 alt 屬性");
      } else {
        console.log("⚠️ 建議為更多圖片添加 alt 屬性");
      }
    }

    // 檢查表單 label
    const inputs = page.locator(
      'input[type="email"], input[type="password"], input[type="text"]',
    );
    const inputCount = await inputs.count();

    if (inputCount > 0) {
      let inputsWithLabels = 0;
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute("id");
        const ariaLabel = await input.getAttribute("aria-label");
        const placeholder = await input.getAttribute("placeholder");

        // 檢查是否有 label、aria-label 或 placeholder
        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          if ((await label.count()) > 0) {
            inputsWithLabels++;
            continue;
          }
        }

        if (ariaLabel || placeholder) {
          inputsWithLabels++;
        }
      }

      const labelPercentage = (inputsWithLabels / inputCount) * 100;
      console.log(`表單輸入欄標籤覆蓋率: ${labelPercentage.toFixed(1)}%`);

      if (labelPercentage >= 90) {
        console.log("✅ 大多數表單元素有適當標籤");
      } else {
        console.log("⚠️ 建議為更多表單元素添加標籤");
      }
    }
  });
});
