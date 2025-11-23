/**
 * 更新文章 HTML，插入圖片
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const ARTICLE_ID = 'c5a3ef4e-49b9-4bf5-8868-c2c313f59d3f';

interface GeneratedImage {
  url: string;
  altText: string;
  width: number;
  height: number;
}

function insertImagesToHtml(
  html: string,
  featuredImage: GeneratedImage | null,
  contentImages: GeneratedImage[]
): string {
  let modifiedHtml = html;

  // 1. 在第一個 <p> 標籤之後插入精選圖片
  if (featuredImage) {
    const featuredImageHtml = `<figure class="wp-block-image size-large">
  <img src="${featuredImage.url}" alt="${featuredImage.altText}" width="${featuredImage.width}" height="${featuredImage.height}" />
  <figcaption>${featuredImage.altText}</figcaption>
</figure>\n\n`;

    const firstPTagIndex = modifiedHtml.indexOf('</p>');
    if (firstPTagIndex !== -1) {
      modifiedHtml =
        modifiedHtml.slice(0, firstPTagIndex + 4) +
        '\n\n' +
        featuredImageHtml +
        modifiedHtml.slice(firstPTagIndex + 4);
    }
  }

  // 2. 在每個 H2 標籤之後插入內文圖片
  if (contentImages.length > 0) {
    const h2Regex = /<h2[^>]*>.*?<\/h2>/g;
    let match;
    const h2Positions: number[] = [];

    while ((match = h2Regex.exec(modifiedHtml)) !== null) {
      h2Positions.push(match.index + match[0].length);
    }

    // 從後往前插入，避免位置偏移
    for (let i = Math.min(h2Positions.length, contentImages.length) - 1; i >= 0; i--) {
      const image = contentImages[i];
      const imageHtml = `\n\n<figure class="wp-block-image size-large">
  <img src="${image.url}" alt="${image.altText}" width="${image.width}" height="${image.height}" />
  <figcaption>${image.altText}</figcaption>
</figure>\n\n`;

      const position = h2Positions[i];
      modifiedHtml =
        modifiedHtml.slice(0, position) +
        imageHtml +
        modifiedHtml.slice(position);
    }
  }

  return modifiedHtml;
}

async function main() {
  console.log(`[更新文章] 開始處理文章: ${ARTICLE_ID}`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. 讀取文章
  const { data: article, error: fetchError } = await supabase
    .from('generated_articles')
    .select('*')
    .eq('id', ARTICLE_ID)
    .single();

  if (fetchError || !article) {
    console.error('[錯誤] 無法讀取文章:', fetchError);
    process.exit(1);
  }

  console.log('[✓] 文章讀取成功');
  console.log(`   - 標題: ${article.title}`);
  console.log(`   - 精選圖片: ${article.featured_image_url ? '有' : '無'}`);
  console.log(`   - 當前 HTML 長度: ${article.html_content?.length || 0} 字元`);

  // 2. 準備圖片資料
  const featuredImage = article.featured_image_url ? {
    url: article.featured_image_url,
    altText: article.featured_image_alt || article.title,
    width: article.featured_image_width || 1024,
    height: article.featured_image_height || 1024,
  } : null;

  const contentImages: GeneratedImage[] = [];

  if (article.content_images && Array.isArray(article.content_images)) {
    article.content_images.forEach((img: { url: string; alt_text?: string; width?: number; height?: number; suggested_section?: string }) => {
      contentImages.push({
        url: img.url,
        altText: img.alt_text || img.suggested_section || '內文圖片',
        width: img.width || 1024,
        height: img.height || 1024,
      });
    });
  }

  console.log(`[✓] 找到 ${contentImages.length} 張內文圖片`);

  // 3. 插入圖片到 HTML
  if (!article.html_content) {
    console.error('[錯誤] 文章沒有 HTML 內容');
    process.exit(1);
  }

  const updatedHtml = insertImagesToHtml(
    article.html_content,
    featuredImage,
    contentImages
  );

  console.log(`[✓] HTML 更新完成`);
  console.log(`   - 原始長度: ${article.html_content.length} 字元`);
  console.log(`   - 更新後長度: ${updatedHtml.length} 字元`);
  console.log(`   - 增加: ${updatedHtml.length - article.html_content.length} 字元`);

  // 4. 更新資料庫
  const { error: updateError } = await supabase
    .from('generated_articles')
    .update({
      html_content: updatedHtml,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ARTICLE_ID);

  if (updateError) {
    console.error('[錯誤] 更新失敗:', updateError);
    process.exit(1);
  }

  console.log('[✅] 文章更新成功！');
  console.log(`\n你現在可以在預覽頁面看到圖片了：`);
  console.log(`http://localhost:3000/dashboard/articles/${ARTICLE_ID}/preview`);
}

main();
