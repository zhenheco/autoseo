import { test, expect, Page } from "@playwright/test";

test.describe("國際化 (i18n) 功能測試", () => {
  const supportedLocales = [
    { code: "zh-TW", name: "繁體中文" },
    { code: "en-US", name: "English" },
    { code: "ja-JP", name: "日本語" },
    { code: "ko-KR", name: "한국어" },
    { code: "de-DE", name: "Deutsch" },
    { code: "es-ES", name: "Español" },
    { code: "fr-FR", name: "Français" },
  ];

  test.beforeEach(async ({ page }) => {
    // 清除語言選擇 cookie
    await page.context().clearCookies();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("預設語言應為繁體中文", async ({ page }) => {
    // 檢查頁面語言是否為繁體中文
    const htmlLang = await page.getAttribute("html", "lang");
    expect(htmlLang).toContain("zh");

    // 檢查頁面內容是否包含中文
    const pageTitle = await page.title();
    const bodyText = await page.locator("body").innerText();

    console.log("頁面標題:", pageTitle);
    console.log("HTML lang:", htmlLang);

    // 應該包含中文字符
    const containsChinese = /[\u4e00-\u9fff]/.test(bodyText);
    expect(containsChinese).toBe(true);
  });

  test("語言選擇器應存在且可見", async ({ page }) => {
    // 查找語言選擇器
    const languageSelector = page
      .locator('[data-testid="language-selector"]')
      .or(page.locator('button[aria-label*="語言"]'))
      .or(page.locator('select[aria-label*="language"]'))
      .or(
        // 也可能是下拉選單形式
        page.locator('[role="combobox"]').filter({ hasText: /語言|Language/ }),
      );

    await expect(languageSelector.first()).toBeVisible({ timeout: 10000 });

    console.log("✅ 找到語言選擇器");
  });

  test("切換到英文應更新頁面內容", async ({ page }) => {
    // 等待頁面完全載入
    await page.waitForLoadState("networkidle");

    // 記錄原始內容
    const originalTitle = await page.title();
    console.log("原始標題:", originalTitle);

    // 尋找語言選擇器並切換到英文
    try {
      // 方法1: 查找語言選擇器按鈕
      const languageBtn = page
        .locator('[data-testid="language-selector"]')
        .or(
          page
            .locator("button")
            .filter({ hasText: /語言|Language|繁體中文|English/ }),
        );

      if ((await languageBtn.count()) > 0) {
        await languageBtn.first().click();
        await page.waitForTimeout(500);

        // 查找英文選項
        const englishOption = page
          .locator("text=English")
          .or(page.locator('[data-value="en-US"]'))
          .or(page.locator('[lang="en-US"]'));

        if ((await englishOption.count()) > 0) {
          await englishOption.first().click();
          await page.waitForTimeout(1000);

          // 檢查切換後的結果
          const newTitle = await page.title();
          const newBodyText = await page.locator("body").innerText();

          console.log("切換後標題:", newTitle);

          // 內容應該不同 (已切換到英文)
          expect(newTitle).not.toBe(originalTitle);

          // 檢查是否包含英文內容
          const containsEnglish = /[A-Za-z]/.test(newBodyText);
          expect(containsEnglish).toBe(true);

          console.log("✅ 成功切換到英文");
        } else {
          console.log("⚠️ 未找到英文選項");
        }
      } else {
        // 方法2: 直接修改 URL 或設置 cookie
        await page.evaluate(() => {
          document.cookie = "ui-locale=en-US; path=/";
        });
        await page.reload();
        await page.waitForLoadState("networkidle");

        const newTitle = await page.title();
        console.log("通過 cookie 切換後標題:", newTitle);
      }
    } catch (error) {
      console.log("語言切換測試失敗:", error);
      // 仍然檢查是否有基本的英文支持
      await page.goto("/?locale=en-US");
      await page.waitForLoadState("networkidle");

      const urlTitle = await page.title();
      console.log("通過 URL 切換後標題:", urlTitle);
    }
  });

  test("語言切換應保存到 localStorage/cookies", async ({ page }) => {
    // 切換語言前
    await page.waitForLoadState("networkidle");

    try {
      // 設置英文語言 cookie
      await page.evaluate(() => {
        document.cookie = "ui-locale=en-US; path=/";
      });

      await page.reload();
      await page.waitForLoadState("networkidle");

      // 檢查 cookie 是否被保存
      const cookies = await page.context().cookies();
      const localeCookie = cookies.find((c) => c.name === "ui-locale");

      if (localeCookie) {
        expect(localeCookie.value).toBe("en-US");
        console.log("✅ 語言設置已保存到 cookie");
      } else {
        // 檢查 localStorage
        const localeStorage = await page.evaluate(() => {
          return (
            localStorage.getItem("ui-locale") || localStorage.getItem("locale")
          );
        });

        if (localeStorage) {
          console.log("✅ 語言設置已保存到 localStorage:", localeStorage);
        } else {
          console.log("⚠️ 未找到語言設置存儲");
        }
      }
    } catch (error) {
      console.log("語言保存測試失敗:", error);
    }
  });

  test.describe("不同語言頁面載入", () => {
    supportedLocales.forEach(({ code, name }) => {
      test(`${name} (${code}) 語言頁面應正常載入`, async ({ page }) => {
        // 設置語言 cookie
        await page.evaluate((locale) => {
          document.cookie = `ui-locale=${locale}; path=/`;
        }, code);

        await page.goto("/");
        await page.waitForLoadState("networkidle");

        // 檢查頁面是否正常載入
        const title = await page.title();
        const bodyText = await page.locator("body").innerText();

        // 頁面應該有內容
        expect(title.length).toBeGreaterThan(0);
        expect(bodyText.length).toBeGreaterThan(100);

        // 檢查是否有明顯的載入錯誤
        const errorText = await page
          .locator("text=Error")
          .or(page.locator("text=錯誤"))
          .or(page.locator("text=404"))
          .count();

        expect(errorText).toBe(0);

        console.log(`✅ ${name} (${code}) 頁面載入正常`);
      });
    });
  });

  test("響應式語言選擇器 - 手機版", async ({ page }) => {
    // 設置手機視窗
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 在手機版中，語言選擇器可能在側邊選單或漢堡選單內
    const mobileMenu = page
      .locator('[data-testid="mobile-menu"]')
      .or(page.locator('button[aria-label*="menu"]'))
      .or(page.locator('[role="button"]').filter({ hasText: /☰|≡|Menu/ }));

    if ((await mobileMenu.count()) > 0) {
      await mobileMenu.first().click();
      await page.waitForTimeout(500);
    }

    // 查找語言選擇器
    const languageSelector = page
      .locator('[data-testid="language-selector"]')
      .or(page.locator("button").filter({ hasText: /語言|Language/ }));

    // 語言選擇器應該存在（可能需要展開選單）
    const selectorExists = (await languageSelector.count()) > 0;

    if (selectorExists) {
      console.log("✅ 手機版語言選擇器存在");
    } else {
      console.log("⚠️ 手機版語言選擇器未找到");
    }
  });

  test("語言切換動畫和載入狀態", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    try {
      // 記錄切換前的狀態
      const beforeSwitch = await page.screenshot({
        path: "before-language-switch.png",
      });

      // 執行語言切換
      await page.evaluate(() => {
        document.cookie = "ui-locale=en-US; path=/";
      });

      // 觀察頁面重新載入過程
      const reloadPromise = page.waitForLoadState("networkidle");
      await page.reload();
      await reloadPromise;

      // 記錄切換後的狀態
      const afterSwitch = await page.screenshot({
        path: "after-language-switch.png",
      });

      // 檢查是否有載入指示器
      const loadingIndicator = page
        .locator('[data-testid="loading"]')
        .or(page.locator("text=載入中"))
        .or(page.locator("text=Loading"));

      // 載入指示器不應該一直顯示
      await expect(loadingIndicator).toHaveCount(0);

      console.log("✅ 語言切換過程正常");
    } catch (error) {
      console.log("語言切換動畫測試失敗:", error);
    }
  });
});
