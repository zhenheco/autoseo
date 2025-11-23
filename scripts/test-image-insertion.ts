/**
 * 測試圖片插入功能
 */

const sampleHtml = `<p>這是導言段落。</p>
<h2>第一個章節</h2>
<p>第一個章節的內容。</p>
<h2>第二個章節</h2>
<p>第二個章節的內容。</p>
<h2>第三個章節</h2>
<p>第三個章節的內容。</p>`;

const featuredImage = {
  url: 'https://drive.google.com/uc?export=view&id=FEATURED_IMAGE_ID',
  altText: '精選圖片描述',
  width: 1024,
  height: 1024,
  model: 'gpt-image-1-mini',
  prompt: 'Featured image prompt',
};

const contentImages = [
  {
    url: 'https://drive.google.com/uc?export=view&id=CONTENT_IMAGE_1',
    altText: '第一個內文圖片',
    width: 1024,
    height: 1024,
    model: 'gpt-image-1-mini',
    prompt: 'Content image 1 prompt',
    suggestedSection: '第一個章節',
  },
  {
    url: 'https://drive.google.com/uc?export=view&id=CONTENT_IMAGE_2',
    altText: '第二個內文圖片',
    width: 1024,
    height: 1024,
    model: 'gpt-image-1-mini',
    prompt: 'Content image 2 prompt',
    suggestedSection: '第二個章節',
  },
];

function insertImagesToHtml(
  html: string,
  featuredImage: typeof featuredImage | null,
  contentImages: typeof contentImages
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

// 執行測試
console.log('=== 原始 HTML ===');
console.log(sampleHtml);
console.log('\n=== 插入圖片後 ===');
const result = insertImagesToHtml(sampleHtml, featuredImage, contentImages);
console.log(result);

// 驗證結果
const checks = [
  { name: '精選圖片在導言段落後', test: result.includes('</p>\n\n<figure') },
  { name: '第一個內文圖片在第一個 H2 後', test: result.includes('第一個章節</h2>\n\n<figure') },
  { name: '第二個內文圖片在第二個 H2 後', test: result.includes('第二個章節</h2>\n\n<figure') },
  { name: '總共有 3 個 figure 標籤', test: (result.match(/<figure/g) || []).length === 3 },
];

console.log('\n=== 驗證結果 ===');
checks.forEach(check => {
  console.log(`${check.test ? '✅' : '❌'} ${check.name}`);
});

const allPassed = checks.every(check => check.test);
console.log(`\n${allPassed ? '✅ 所有測試通過' : '❌ 部分測試失敗'}`);
process.exit(allPassed ? 0 : 1);
