const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'light'
  });
  const page = await context.newPage();

  console.log('正在訪問首頁...');
  await page.goto('http://localhost:3168', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'current-homepage.png', fullPage: false });
  console.log('✅ 截圖已保存: current-homepage.png');

  // 檢查 HTML 元素的實際顏色
  const bgColor = await page.evaluate(() => {
    const html = document.documentElement;
    return {
      htmlClass: html.className,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      primaryColor: getComputedStyle(document.documentElement).getPropertyValue('--primary')
    };
  });
  
  console.log('當前狀態:', bgColor);

  await browser.close();
})();
