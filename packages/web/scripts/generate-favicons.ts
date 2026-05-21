/**
 * Favicon 生成腳本
 * 從 SVG 圖標生成各種尺寸的 favicon 和 PNG 圖片
 */
import sharp from "sharp";
import pngToIco from "png-to-ico";
import * as fs from "fs";
import * as path from "path";

const SVG_SOURCE = path.join(__dirname, "../src/app/icon.svg");
const OUTPUT_DIR = path.join(__dirname, "../public");

/**
 * 需要生成的圖片尺寸配置
 */
const sizes = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "android-chrome-192x192.png", size: 192 },
  { name: "android-chrome-512x512.png", size: 512 },
];

/**
 * 主函數：生成所有 favicon 和 PNG 圖片
 */
async function generateFavicons() {
  console.log("開始生成 favicon...\n");

  // 讀取 SVG 源文件
  const svgBuffer = fs.readFileSync(SVG_SOURCE);
  console.log(`✓ 讀取 SVG 源文件: ${SVG_SOURCE}\n`);

  // 生成各尺寸 PNG
  for (const { name, size } of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(OUTPUT_DIR, name));
    console.log(`✅ 已生成: ${name} (${size}x${size})`);
  }

  // 生成 favicon.ico（包含 16x16 和 32x32）
  console.log("\n正在生成 favicon.ico...");
  const ico16 = await sharp(svgBuffer).resize(16, 16).png().toBuffer();
  const ico32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  const icoBuffer = await pngToIco([ico16, ico32]);
  fs.writeFileSync(path.join(OUTPUT_DIR, "favicon.ico"), icoBuffer);
  console.log("✅ 已生成: favicon.ico (包含 16x16 和 32x32)");

  console.log("\n🎉 所有 favicon 生成完成！");
}

generateFavicons().catch((error) => {
  console.error("❌ 生成 favicon 時發生錯誤:", error);
  process.exit(1);
});
