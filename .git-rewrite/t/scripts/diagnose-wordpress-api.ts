import 'dotenv/config';

async function diagnoseWordPressAPI() {
  console.log('=== WordPress REST API 診斷工具 ===\n');

  const WORDPRESS_URL = process.env.WORDPRESS_URL;
  const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME;
  const WORDPRESS_APP_PASSWORD = process.env.WORDPRESS_APP_PASSWORD;

  if (!WORDPRESS_URL || !WORDPRESS_USERNAME || !WORDPRESS_APP_PASSWORD) {
    console.error('❌ 缺少必要的環境變數');
    process.exit(1);
  }

  console.log(`WordPress URL: ${WORDPRESS_URL}\n`);

  const baseUrl = `${WORDPRESS_URL}/wp-json/wp/v2`;
  const authHeader = `Basic ${Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_APP_PASSWORD}`).toString('base64')}`;

  const endpoints = [
    { name: 'REST API Root', url: `${WORDPRESS_URL}/wp-json` },
    { name: 'WP API Root', url: `${WORDPRESS_URL}/wp-json/wp/v2` },
    { name: 'Categories', url: `${baseUrl}/categories` },
    { name: 'Tags', url: `${baseUrl}/tags` },
    { name: 'Posts', url: `${baseUrl}/posts` },
    { name: 'Users (需認證)', url: `${baseUrl}/users/me`, needsAuth: true },
  ];

  console.log('測試 1: 檢查 REST API 是否可用\n');

  for (const endpoint of endpoints) {
    console.log(`測試: ${endpoint.name}`);
    console.log(`URL: ${endpoint.url}`);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (endpoint.needsAuth) {
        headers['Authorization'] = authHeader;
      }

      const response = await fetch(endpoint.url, {
        method: 'GET',
        headers,
      });

      console.log(`狀態碼: ${response.status} ${response.statusText}`);
      console.log(`Content-Type: ${response.headers.get('content-type')}`);

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        if (response.ok) {
          const data = await response.json();
          console.log(`✓ 成功 - 回傳 JSON 資料`);
          if (Array.isArray(data)) {
            console.log(`  資料數量: ${data.length}`);
          } else {
            console.log(`  資料類型: ${typeof data}`);
            console.log(`  資料鍵值: ${Object.keys(data).slice(0, 5).join(', ')}`);
          }
        } else {
          const error = await response.json();
          console.log(`✗ 失敗 - ${error.message || JSON.stringify(error)}`);
        }
      } else if (contentType.includes('text/html')) {
        const html = await response.text();
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
        console.log(`✗ 返回 HTML 頁面: ${titleMatch ? titleMatch[1] : '未知'}`);
        console.log(`  這通常表示 REST API 未啟用或被重定向`);
      } else {
        const text = await response.text();
        console.log(`✗ 返回未知格式: ${text.substring(0, 100)}`);
      }

    } catch (error) {
      if (error instanceof Error) {
        console.log(`✗ 連線錯誤: ${error.message}`);
      } else {
        console.log(`✗ 未知錯誤: ${String(error)}`);
      }
    }

    console.log('');
  }

  console.log('\n測試 2: 檢查 Application Password 認證\n');

  try {
    const response = await fetch(`${baseUrl}/users/me`, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    console.log(`狀態碼: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const user = await response.json();
      console.log(`✓ 認證成功！`);
      console.log(`  使用者 ID: ${user.id}`);
      console.log(`  使用者名稱: ${user.name}`);
      console.log(`  使用者角色: ${user.roles?.join(', ') || '未知'}`);
    } else {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const error = await response.json();
        console.log(`✗ 認證失敗: ${error.message}`);
        console.log(`  錯誤代碼: ${error.code}`);
      } else {
        console.log(`✗ 認證失敗 - 返回非 JSON 回應`);
      }

      console.log('\n可能的問題：');
      console.log('1. Application Password 未啟用或無效');
      console.log('2. 使用者權限不足');
      console.log('3. WordPress REST API 被停用或限制');
      console.log('4. 代管服務商封鎖了 REST API');
    }

  } catch (error) {
    console.log(`✗ 連線失敗: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('\n測試 3: 檢查是否需要其他認證方式\n');

  console.log('如果以上測試都失敗，可能需要：');
  console.log('1. 使用 JWT 認證 (需安裝 JWT Authentication plugin)');
  console.log('2. 使用 OAuth 2.0 認證');
  console.log('3. 聯絡代管服務商確認 REST API 是否可用');
  console.log('4. 檢查 WordPress 是否安裝了 REST API 限制外掛');
  console.log('5. 確認網站沒有被 Cloudflare 或 WAF 保護');

  console.log('\n診斷完成！');
}

diagnoseWordPressAPI().catch(console.error);
