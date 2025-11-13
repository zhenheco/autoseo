import 'dotenv/config';

async function testDirectAuth() {
  console.log('=== 直接測試 WordPress 認證 ===\n');

  const url = 'https://x-marks.com';
  const username = process.env.WORDPRESS_USERNAME;
  const password = process.env.WORDPRESS_APP_PASSWORD;

  console.log('WordPress URL:', url);
  console.log('Username:', username);
  console.log('Password 長度:', password?.length || 0);
  console.log('Password 格式檢查:', password?.includes(' ') ? '包含空格' : '不包含空格');
  console.log('');

  if (!username || !password) {
    console.error('❌ 缺少 WORDPRESS_USERNAME 或 WORDPRESS_APP_PASSWORD');
    process.exit(1);
  }

  const authString = `${username}:${password}`;
  const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;

  console.log('步驟 1: 測試認證（獲取當前使用者資訊）');
  console.log('URL: https://x-marks.com/wp-json/wp/v2/users/me');
  console.log('');

  try {
    const response = await fetch('https://x-marks.com/wp-json/wp/v2/users/me', {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    console.log('回應狀態:', response.status, response.statusText);
    console.log('Content-Type:', response.headers.get('content-type'));
    console.log('');

    if (response.ok) {
      const user = await response.json();
      console.log('✅ 認證成功！');
      console.log('');
      console.log('使用者資訊:');
      console.log('  ID:', user.id);
      console.log('  名稱:', user.name);
      console.log('  用戶名:', user.slug);
      console.log('  Email:', user.email || '(未提供)');
      console.log('  角色:', user.roles?.join(', ') || '未知');
      console.log('');
      console.log('✅ WordPress REST API 認證測試通過！');
      console.log('可以繼續執行完整測試：');
      console.log('  npx tsx scripts/test-wordpress-xmarks.ts');
    } else {
      const errorText = await response.text();
      console.log('❌ 認證失敗！');
      console.log('');
      console.log('錯誤回應:', errorText);
      console.log('');

      let errorData;
      try {
        errorData = JSON.parse(errorText);
        console.log('錯誤代碼:', errorData.code);
        console.log('錯誤訊息:', errorData.message);
      } catch {
        console.log('無法解析錯誤訊息');
      }

      console.log('');
      console.log('可能的問題：');
      console.log('1. Application Password 不正確或已過期');
      console.log('2. 使用者名稱不正確');
      console.log('3. 密碼格式有問題（請確認沒有引號）');
      console.log('');
      console.log('請檢查 .env.local 中的設定：');
      console.log('  WORDPRESS_URL=https://x-marks.com');
      console.log('  WORDPRESS_USERNAME=實際的使用者名稱');
      console.log('  WORDPRESS_APP_PASSWORD=實際的應用程式密碼');
      console.log('');
      console.log('注意：密碼可以包含空格，但不要加引號');
    }

  } catch (error) {
    console.error('❌ 連線錯誤:', error);
    if (error instanceof Error) {
      console.error('錯誤訊息:', error.message);
    }
  }
}

testDirectAuth().catch(console.error);
