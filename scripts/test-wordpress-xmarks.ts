import { WordPressClient } from '../src/lib/wordpress/client';

async function testXMarks() {
  console.log('=== 測試 x-marks.com WordPress REST API ===\n');

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
    console.log('步驟 1/5: 測試認證...');

    const categoriesPromise = client.getCategories();
    const tagsPromise = client.getTags();

    const [categories, tags] = await Promise.all([categoriesPromise, tagsPromise]);

    console.log(`✓ 成功獲取 ${categories.length} 個分類`);
    console.log(`✓ 成功獲取 ${tags.length} 個標籤`);
    console.log('');

    console.log('步驟 2/5: 確保測試分類和標籤存在...');
    const { categoryIds, tagIds } = await client.ensureTaxonomies(
      ['測試分類', 'AI 文章'],
      ['測試', '自動化', 'WordPress']
    );
    console.log(`✓ 分類 IDs: ${categoryIds.join(', ')}`);
    console.log(`✓ 標籤 IDs: ${tagIds.join(', ')}`);
    console.log('');

    console.log('步驟 3/5: 建立測試文章 (草稿)...');
    const post = await client.createPost({
      title: `測試文章 - ${new Date().toLocaleString('zh-TW')}`,
      content: `
<h1>WordPress REST API 測試成功</h1>

<p>這是一篇由 Auto-pilot-SEO 系統自動生成的測試文章。</p>

<h2>測試功能</h2>

<ul>
  <li>✓ HTML 標題層級</li>
  <li>✓ 段落格式</li>
  <li>✓ 列表項目</li>
  <li>✓ 分類和標籤</li>
</ul>

<h3>測試時間</h3>

<p>文章建立時間：${new Date().toISOString()}</p>

<table>
  <thead>
    <tr>
      <th>項目</th>
      <th>狀態</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>REST API 連線</td>
      <td>✓ 成功</td>
    </tr>
    <tr>
      <td>認證</td>
      <td>✓ 成功</td>
    </tr>
    <tr>
      <td>文章建立</td>
      <td>✓ 成功</td>
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
    console.log(`  文章連結: ${post.link}`);
    console.log('');

    console.log('步驟 4/5: 測試文章更新...');
    const updatedPost = await client.updatePost(post.id, {
      title: `${post.title.rendered} (已更新)`,
    });
    console.log(`✓ 文章更新成功！新標題: ${updatedPost.title.rendered}`);
    console.log('');

    console.log('步驟 5/5: 測試 Yoast SEO 元數據...');
    const postWithSEO = await client.updatePost(post.id, {
      title: updatedPost.title.rendered,
      content: updatedPost.content.rendered,
      yoastMeta: {
        focusKeyword: 'WordPress REST API 測試',
        metaTitle: '完整的 WordPress REST API 整合測試',
        metaDescription: '這是一篇測試文章，驗證 Auto-pilot-SEO 系統與 WordPress REST API 的整合。',
      },
    });
    console.log('✓ Yoast SEO 元數據設定成功！');
    console.log('');

    console.log('=== 測試完成 ===\n');
    console.log('✅ 所有測試都成功通過！');
    console.log('');
    console.log('測試結果摘要：');
    console.log(`  - WordPress URL: https://x-marks.com`);
    console.log(`  - 認證方式: Application Password`);
    console.log(`  - 分類數量: ${categories.length}`);
    console.log(`  - 標籤數量: ${tags.length}`);
    console.log(`  - 測試文章 ID: ${post.id}`);
    console.log(`  - 測試文章連結: ${post.link}`);
    console.log('');
    console.log('後續步驟：');
    console.log('1. 前往 WordPress 後台查看測試文章');
    console.log('2. 確認 HTML 格式是否正確顯示');
    console.log('3. 確認 SEO 元數據是否正確設定');
    console.log('4. 確認分類和標籤是否正確');
    console.log('5. 如果測試文章沒問題，可以執行完整工作流測試');

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

testXMarks().catch(console.error);
