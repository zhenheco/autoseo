import 'dotenv/config';
import { WordPressClient } from '../src/lib/wordpress/client';

const TEST_HTML = `
<h1 id="test-article">測試文章標題</h1>
<h2 id="introduction">導言</h2>
<p>這是一個測試段落，用來驗證 <strong>WordPress</strong> 發布功能是否正常運作。</p>
<p>我們將測試以下功能：</p>
<ul>
  <li>HTML 格式顯示</li>
  <li>圖片上傳和嵌入</li>
  <li>標題層級</li>
  <li>內部和外部連結</li>
</ul>

<h2 id="main-content">主要內容</h2>
<h3 id="feature-1">功能一：HTML 支援</h3>
<p>WordPress REST API 支援 HTML 內容，可以直接將生成的 HTML 發布到網站。</p>

<h3 id="feature-2">功能二：圖片處理</h3>
<p>圖片可以通過以下方式處理：</p>
<ol>
  <li>上傳到 WordPress Media Library</li>
  <li>設定為 featured image</li>
  <li>嵌入文章內容中</li>
</ol>

<h2 id="conclusion">結論</h2>
<p>通過完整的測試，我們可以確保文章發布流程穩定可靠。</p>

<table class="wp-table">
  <thead>
    <tr>
      <th>測試項目</th>
      <th>預期結果</th>
      <th>實際結果</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>HTML 格式</td>
      <td>正確顯示</td>
      <td>✓</td>
    </tr>
    <tr>
      <td>圖片上傳</td>
      <td>成功上傳</td>
      <td>✓</td>
    </tr>
    <tr>
      <td>分類標籤</td>
      <td>正確設定</td>
      <td>✓</td>
    </tr>
  </tbody>
</table>
`;

async function main() {
  console.log('=== WordPress REST API 發布測試 ===\n');

  const requiredEnvVars = {
    WORDPRESS_URL: process.env.WORDPRESS_URL,
    WORDPRESS_USERNAME: process.env.WORDPRESS_USERNAME,
    WORDPRESS_APP_PASSWORD: process.env.WORDPRESS_APP_PASSWORD,
  };

  const missingVars = Object.entries(requiredEnvVars)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    console.error('❌ 缺少必要的環境變數:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\n請在 .env 檔案中設定這些變數');
    process.exit(1);
  }

  console.log('✓ 環境變數檢查通過\n');

  const client = new WordPressClient({
    url: process.env.WORDPRESS_URL!,
    username: process.env.WORDPRESS_USERNAME!,
    applicationPassword: process.env.WORDPRESS_APP_PASSWORD!,
  });

  try {
    console.log('步驟 1/4: 測試分類和標籤獲取...');
    const [categories, tags] = await Promise.all([
      client.getCategories(),
      client.getTags(),
    ]);
    console.log(`✓ 找到 ${categories.length} 個分類`);
    console.log(`✓ 找到 ${tags.length} 個標籤\n`);

    console.log('步驟 2/4: 確保測試分類和標籤存在...');
    const { categoryIds, tagIds } = await client.ensureTaxonomies(
      ['測試分類', 'AI 文章'],
      ['測試', '自動化', 'WordPress']
    );
    console.log(`✓ 分類 IDs: ${categoryIds.join(', ')}`);
    console.log(`✓ 標籤 IDs: ${tagIds.join(', ')}\n`);

    console.log('步驟 3/4: 創建草稿文章（測試 HTML 格式）...');
    const post = await client.createPost({
      title: `測試文章 - ${new Date().toISOString()}`,
      content: TEST_HTML,
      excerpt: '這是一篇用來測試 WordPress REST API 發布功能的文章',
      status: 'draft',
      categories: categoryIds,
      tags: tagIds,
    });
    console.log(`✓ 文章創建成功！`);
    console.log(`  - 文章 ID: ${post.id}`);
    console.log(`  - 文章連結: ${post.link}`);
    console.log(`  - 狀態: ${post.status}\n`);

    console.log('步驟 4/4: 驗證 HTML 內容...');
    const contentPreview = post.content.rendered.substring(0, 200);
    console.log(`✓ HTML 內容前 200 字元:\n${contentPreview}...\n`);

    console.log('=== 測試成功完成 ===');
    console.log(`\n請前往 WordPress 查看草稿文章：\n${post.link}`);
    console.log('\n檢查以下項目：');
    console.log('  1. HTML 標題（h1, h2, h3）是否正確顯示');
    console.log('  2. 列表（ul, ol）格式是否正確');
    console.log('  3. 表格是否正確顯示');
    console.log('  4. 粗體和其他格式是否保留');
    console.log('  5. 分類和標籤是否正確設定');

    return post;

  } catch (error) {
    console.error('❌ 測試失敗:', error);
    if (error instanceof Error) {
      console.error('錯誤訊息:', error.message);
      if (error.stack) {
        console.error('\n錯誤堆疊:');
        console.error(error.stack);
      }
    }
    process.exit(1);
  }
}

main().catch(console.error);
