/**
 * 生成 Favicon PNG 檔案
 * 使用 sharp 將 SVG 轉換為各種尺寸的 PNG
 */

import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');

// 讀取 favicon SVG
const faviconSvg = readFileSync(join(publicDir, 'favicon.svg'));

// 定義要生成的尺寸
const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
];

async function generateFavicons() {
  console.log('開始生成 Favicon PNG 檔案...\n');

  for (const { name, size } of sizes) {
    try {
      await sharp(faviconSvg)
        .resize(size, size)
        .png()
        .toFile(join(publicDir, name));
      console.log(`✅ ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`❌ ${name} 生成失敗:`, error.message);
    }
  }

  // 生成 favicon.ico（使用 16x16 和 32x32 PNG）
  try {
    const ico = await pngToIco([
      join(publicDir, 'favicon-16x16.png'),
      join(publicDir, 'favicon-32x32.png'),
    ]);
    writeFileSync(join(publicDir, 'favicon.ico'), ico);
    console.log(`\n✅ favicon.ico (16x16 + 32x32)`);
  } catch (error) {
    console.error(`❌ favicon.ico 生成失敗:`, error.message);
  }

  console.log('\n🎉 Favicon 生成完成！');
}

generateFavicons();
