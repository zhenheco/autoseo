/**
 * 測試 HTMLAgent 的 parseHTML 錯誤處理
 */

async function testHTMLAgent() {
  console.log('開始測試 HTMLAgent...\n');

  // 測試案例 1: 正常的 HTML
  console.log('測試案例 1: 正常的 HTML');
  try {
    const { parseHTML } = await import('linkedom');
    const normalHTML = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>測試</title>
</head>
<body>
  <h1>標題</h1>
  <p>內容</p>
</body>
</html>`;

    const { document } = parseHTML(normalHTML);
    console.log('✅ 正常 HTML 解析成功');
    console.log('  - document.body存在:', !!document.body);
    console.log('  - body.innerHTML:', document.body?.innerHTML.substring(0, 50));
  } catch (error) {
    console.error('❌ 正常 HTML 解析失敗:', error);
  }

  // 測試案例 2: 空字符串
  console.log('\n測試案例 2: 空字符串');
  try {
    const { parseHTML } = await import('linkedom');
    const { document } = parseHTML('');

    try {
      const bodyElement = document.body;
      console.log('  - document.body存在:', !!bodyElement);
      if (bodyElement) {
        console.log('✅ 空字符串處理成功（有 body）');
      } else {
        console.log('⚠️  空字符串沒有 body，需要 fallback');
      }
    } catch (bodyError) {
      console.log('✅ 正確捕獲 body getter 錯誤，使用 fallback');
    }
  } catch (error) {
    console.error('❌ 空字符串解析失敗:', error);
  }

  // 測試案例 3: 無效的 HTML
  console.log('\n測試案例 3: 無效/不完整的 HTML');
  try {
    const { parseHTML } = await import('linkedom');
    const invalidHTML = '<div>測試</div>';
    const { document } = parseHTML(invalidHTML);
    console.log('  - document.body存在:', !!document.body);
    if (document.body) {
      console.log('✅ 片段 HTML 處理成功');
    } else {
      console.log('⚠️  片段 HTML 沒有 body，需要 fallback');
    }
  } catch (error) {
    console.error('❌ 片段 HTML 解析失敗:', error);
  }

  // 測試案例 4: 包含特殊字符的 HTML
  console.log('\n測試案例 4: 包含特殊字符的 HTML');
  try {
    const { parseHTML } = await import('linkedom');
    const specialHTML = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
</head>
<body>
  <p>特殊字符: " ' & < > 中文測試</p>
</body>
</html>`;

    const { document } = parseHTML(specialHTML);
    console.log('✅ 特殊字符 HTML 解析成功');
    console.log('  - document.body存在:', !!document.body);
  } catch (error) {
    console.error('❌ 特殊字符 HTML 解析失敗:', error);
  }

  // 測試案例 5: 測試 document.body getter 在 documentElement 為 null 時的行為
  console.log('\n測試案例 5: 測試 documentElement null 的情況');
  try {
    const { parseHTML } = await import('linkedom');
    // 嘗試創造一個會導致 documentElement 為 null 的情況
    const { document } = parseHTML('');

    // 使用 nested try-catch 捕獲 getter 錯誤
    try {
      const body = document.body;
      if (body) {
        console.log('  - body.innerHTML:', body.innerHTML);
      } else {
        console.log('  - body 不存在，documentElement:', document.documentElement);
      }
    } catch (bodyError) {
      console.log('✅ Null 檢查成功（正確捕獲 body getter 錯誤）');
    }

    console.log('✅ Nested try-catch 正常運作');
  } catch (error) {
    console.error('❌ Null 檢查失敗:', (error as Error).message);
  }

  console.log('\n測試完成！');
}

testHTMLAgent().catch(console.error);
