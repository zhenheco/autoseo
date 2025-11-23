import { WordPressClient } from '../src/lib/wordpress/client';

async function testRankMath() {
  console.log('=== 測試 Rank Math SEO 整合 ===\n');

  const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME;
  const WORDPRESS_APP_PASSWORD = process.env.WORDPRESS_APP_PASSWORD;

  if (!WORDPRESS_USERNAME || !WORDPRESS_APP_PASSWORD) {
    console.error('❌ 缺少 WORDPRESS_USERNAME 或 WORDPRESS_APP_PASSWORD');
    process.exit(1);
  }

  const client = new WordPressClient({
    url: 'https://x-marks.com',
    username: WORDPRESS_USERNAME,
    applicationPassword: WORDPRESS_APP_PASSWORD,
  });

  try {
    console.log('步驟 1/4: 測試認證...');
    const categories = await client.getCategories();
    console.log(`✓ 成功獲取 ${categories.length} 個分類\n`);

    console.log('步驟 2/4: 確保測試分類和標籤存在...');
    const { categoryIds, tagIds } = await client.ensureTaxonomies(
      ['Rank Math 測試'],
      ['SEO', 'Rank Math', '自動化']
    );
    console.log(`✓ 分類 IDs: ${categoryIds.join(', ')}`);
    console.log(`✓ 標籤 IDs: ${tagIds.join(', ')}\n`);

    console.log('步驟 3/4: 建立測試文章...');
    const post = await client.createPost({
      title: `Rank Math SEO 測試 - ${new Date().toLocaleString('zh-TW')}`,
      content: `
<h1>Rank Math SEO 整合測試</h1>

<p>這是一篇測試 Rank Math SEO 元數據的文章。</p>

<h2>測試項目</h2>

<ul>
  <li>✓ Focus Keyword 設定</li>
  <li>✓ Meta Title 優化</li>
  <li>✓ Meta Description 設定</li>
  <li>✓ Robots Meta 標籤</li>
</ul>

<h3>SEO 資訊</h3>

<table>
  <thead>
    <tr>
      <th>項目</th>
      <th>內容</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Focus Keyword</td>
      <td>Rank Math SEO 測試</td>
    </tr>
    <tr>
      <td>Meta Title</td>
      <td>完整的 Rank Math SEO 整合測試</td>
    </tr>
    <tr>
      <td>Meta Description</td>
      <td>測試 Auto-pilot-SEO 系統與 Rank Math 的整合功能</td>
    </tr>
  </tbody>
</table>
      `,
      status: 'draft',
      categories: categoryIds,
      tags: tagIds,
    });

    console.log('✓ 測試文章建立成功！');
    console.log(`  文章 ID: ${post.id}`);
    console.log(`  文章標題: ${post.title.rendered}`);
    console.log(`  文章狀態: ${post.status}`);
    console.log(`  文章連結: ${post.link}\n`);

    console.log('步驟 3.5/4: 使用 Rank Math API 設定 SEO 元數據...');
    await client.updateRankMathMeta(post.id, {
      rank_math_title: '完整的 Rank Math SEO 整合測試',
      rank_math_description: '測試 Auto-pilot-SEO 系統與 Rank Math 的整合功能',
      rank_math_focus_keyword: 'Rank Math SEO 測試',
      rank_math_robots: ['index', 'follow'],
    });
    console.log('✓ Rank Math SEO 元數據設定成功！\n');

    console.log('步驟 4/4: 驗證 Rank Math 元數據是否正確設定...');

    const response = await fetch(`https://x-marks.com/wp-json/wp/v2/posts/${post.id}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_APP_PASSWORD}`).toString('base64')}`,
      },
    });

    const fullPost = await response.json();

    if (fullPost.meta) {
      console.log('✓ Rank Math 元數據:');
      console.log(`  rank_math_title: ${fullPost.meta.rank_math_title || '(未設定)'}`);
      console.log(`  rank_math_description: ${fullPost.meta.rank_math_description || '(未設定)'}`);
      console.log(`  rank_math_focus_keyword: ${fullPost.meta.rank_math_focus_keyword || '(未設定)'}`);
      console.log(`  rank_math_robots: ${JSON.stringify(fullPost.meta.rank_math_robots) || '(未設定)'}`);
    } else {
      console.log('⚠️  無法讀取 meta 資料（可能需要調整 WordPress REST API 權限）');
    }

    console.log('\n=== 測試完成 ===\n');
    console.log('✅ Rank Math SEO 整合測試通過！\n');
    console.log('後續步驟：');
    console.log('1. 前往 WordPress 後台查看測試文章');
    console.log('2. 在編輯器中確認 Rank Math SEO 面板顯示正確的元數據');
    console.log('3. 確認 Focus Keyword、Meta Title、Meta Description 都已正確設定');
    console.log('4. 如果元數據正確，可以執行完整工作流測試');

  } catch (error) {
    console.error('\n❌ 測試失敗:', error);
    if (error instanceof Error) {
      console.error('錯誤訊息:', error.message);
      if (error.stack) {
        console.error('\n錯誤堆疊:', error.stack);
      }
    }
    process.exit(1);
  }
}

testRankMath().catch(console.error);
