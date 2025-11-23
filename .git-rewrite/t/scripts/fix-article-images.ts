import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const ARTICLE_ID = 'c5a3ef4e-49b9-4bf5-8868-c2c313f59d3f';

// 轉換 Google Drive URL 格式
function fixGoogleDriveUrl(url: string): string {
  const match = url.match(/[?&]id=([^&]+)/);
  if (match) {
    const fileId = match[1];
    return `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
  }
  return url;
}

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

  // 2. 智能分配內文圖片到 H2/H3 標題
  if (contentImages.length > 0) {
    const h2Regex = /<h2[^>]*>.*?<\/h2>/g;
    const h3Regex = /<h3[^>]*>.*?<\/h3>/g;
    let match;
    const h2Positions: number[] = [];
    const h3Positions: number[] = [];

    while ((match = h2Regex.exec(modifiedHtml)) !== null) {
      h2Positions.push(match.index + match[0].length);
    }

    while ((match = h3Regex.exec(modifiedHtml)) !== null) {
      h3Positions.push(match.index + match[0].length);
    }

    const h2Count = h2Positions.length;
    const imageCount = contentImages.length;

    let insertPositions: number[] = [];

    if (imageCount <= Math.ceil(h2Count / 2)) {
      // 每兩個 H2 放一張
      const step = Math.max(1, Math.floor(h2Count / imageCount));
      for (let i = 0; i < imageCount && i * step < h2Count; i++) {
        insertPositions.push(h2Positions[i * step]);
      }
    } else if (imageCount <= h2Count) {
      // 每個 H2 放一張
      insertPositions = h2Positions.slice(0, imageCount);
    } else {
      // H2 填滿後放到 H3
      insertPositions = [...h2Positions];
      const remainingImages = imageCount - h2Count;
      const h3ToUse = h3Positions.slice(0, remainingImages);
      insertPositions = [...insertPositions, ...h3ToUse].sort((a, b) => a - b);
    }

    // 從後往前插入
    for (let i = Math.min(insertPositions.length, imageCount) - 1; i >= 0; i--) {
      const image = contentImages[i];
      const imageHtml = `\n\n<figure class="wp-block-image size-large">
  <img src="${image.url}" alt="${image.altText}" width="${image.width}" height="${image.height}" />
  <figcaption>${image.altText}</figcaption>
</figure>\n\n`;

      const position = insertPositions[i];
      modifiedHtml =
        modifiedHtml.slice(0, position) +
        imageHtml +
        modifiedHtml.slice(position);
    }
  }

  return modifiedHtml;
}

async function main() {
  console.log(`[修正文章] 開始處理: ${ARTICLE_ID}`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 讀取文章
  const { data: article, error: fetchError } = await supabase
    .from('generated_articles')
    .select('*')
    .eq('id', ARTICLE_ID)
    .single();

  if (fetchError || !article) {
    console.error('[錯誤]', fetchError);
    process.exit(1);
  }

  console.log('[✓] 文章讀取成功');

  // 修正 URL 格式
  const fixedFeaturedUrl = article.featured_image_url
    ? fixGoogleDriveUrl(article.featured_image_url)
    : null;

  const fixedContentImages = (article.content_images || []).map((img: any) => ({
    ...img,
    url: fixGoogleDriveUrl(img.url),
  }));

  console.log('[✓] URL 格式已修正');
  console.log(`   - 精選圖片: ${fixedFeaturedUrl}`);
  console.log(`   - 內文圖片: ${fixedContentImages.length} 張`);

  // 準備圖片資料
  const featuredImage = fixedFeaturedUrl ? {
    url: fixedFeaturedUrl,
    altText: article.featured_image_alt || article.title,
    width: article.featured_image_width || 1024,
    height: article.featured_image_height || 1024,
  } : null;

  const contentImages: GeneratedImage[] = fixedContentImages.map((img: any) => ({
    url: img.url,
    altText: img.alt_text || img.altText || img.suggested_section || '內文圖片',
    width: img.width || 1024,
    height: img.height || 1024,
  }));

  // 重新生成 HTML（使用原始HTML去除舊圖片）
  const cleanHtml = article.markdown_content; // 使用 markdown 重新轉換，或者手動清理

  // 這裡簡化：直接使用當前 HTML 並移除現有 figure 標籤
  const htmlWithoutImages = article.html_content.replace(/<figure[^>]*>[\s\S]*?<\/figure>/g, '');

  const updatedHtml = insertImagesToHtml(
    htmlWithoutImages,
    featuredImage,
    contentImages
  );

  console.log('[✓] HTML 已重新生成');
  console.log(`   - 原始長度: ${article.html_content.length}`);
  console.log(`   - 更新後長度: ${updatedHtml.length}`);

  // 更新資料庫
  const updateData: any = {
    html_content: updatedHtml,
    updated_at: new Date().toISOString(),
  };

  // 也更新 URL 欄位
  if (fixedFeaturedUrl) {
    updateData.featured_image_url = fixedFeaturedUrl;
  }
  if (fixedContentImages.length > 0) {
    updateData.content_images = fixedContentImages;
  }

  const { error: updateError } = await supabase
    .from('generated_articles')
    .update(updateData)
    .eq('id', ARTICLE_ID);

  if (updateError) {
    console.error('[錯誤]', updateError);
    process.exit(1);
  }

  console.log('[✅] 文章修正完成！');
  console.log(`\n預覽：http://localhost:3000/dashboard/articles/${ARTICLE_ID}/preview`);
}

main();
