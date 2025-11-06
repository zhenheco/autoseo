import { GoogleDriveClient } from '../src/lib/storage/google-drive-client';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

async function testGoogleDrive() {
  console.log('🔍 檢查 Google Drive Service Account 配置...\n');

  const requiredVars = [
    'GOOGLE_DRIVE_FOLDER_ID',
    'GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY',
  ];

  console.log('📋 環境變數檢查：');
  const missingVars = requiredVars.filter((v) => !process.env[v]);

  if (missingVars.length > 0) {
    console.error('❌ 缺少環境變數:', missingVars.join(', '));
    process.exit(1);
  }

  requiredVars.forEach((v) => {
    const value = process.env[v]!;
    const display = v.includes('KEY')
      ? value.substring(0, 30) + '...'
      : value;
    console.log(`   ✅ ${v}: ${display}`);
  });

  console.log('\n🔧 初始化 Google Drive 客戶端...');
  const client = new GoogleDriveClient({
    clientEmail: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL!,
    privateKey: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY!.replace(/\\n/g, '\n'),
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID!,
  });

  try {
    console.log('\n📸 測試 1: 建立測試圖片');
    const testImagePath = path.join(__dirname, 'test-image.jpg');

    const testImageBuffer = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
      0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
      0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C,
      0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D,
      0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
      0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
      0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34,
      0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4,
      0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x03, 0xFF, 0xDA, 0x00, 0x08,
      0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x37, 0xFF,
      0xD9
    ]);

    fs.writeFileSync(testImagePath, testImageBuffer);
    console.log('   ✅ 測試圖片已建立:', testImagePath);

    console.log('\n📤 測試 2: 上傳圖片到 Google Drive');
    const startTime = Date.now();

    const imageBuffer = fs.readFileSync(testImagePath);
    const uploadResult = await client.uploadImage(imageBuffer, 'test-upload-sa.jpg', 'image/jpeg');

    const uploadTime = Date.now() - startTime;

    if (uploadResult && uploadResult.url) {
      console.log(`   ✅ 上傳成功！(${(uploadTime / 1000).toFixed(2)}s)`);
      console.log(`   📎 URL: ${uploadResult.url}`);
      console.log(`   🆔 File ID: ${uploadResult.fileId}`);

      if (uploadResult.url.includes('drive.google.com')) {
        console.log('   ✅ URL 格式正確');
      } else {
        console.log('   ⚠️  URL 格式可能不正確');
      }
    } else {
      console.log('   ❌ 上傳失敗：返回 null 或無效結果');
    }

    console.log('\n📁 測試 3: 驗證資料夾權限');
    console.log(`   資料夾 ID: ${process.env.GOOGLE_DRIVE_FOLDER_ID}`);
    console.log(`   Service Account: ${process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL}`);
    console.log('   提示：請確認已將資料夾分享給此 Service Account（編輯者權限）');

    console.log('\n🧹 清理測試檔案...');
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
      console.log('   ✅ 測試圖片已刪除');
    }

    console.log('\n✅ Google Drive Service Account 配置測試完成！');
    console.log('\n下一步：執行完整的文章生成測試來驗證圖片上傳功能');

  } catch (error: any) {
    console.error('\n❌ 測試失敗:', error.message);
    if (error.response) {
      console.error('API 回應:', error.response.data);
    }
    console.error('\n完整錯誤:', error);
    process.exit(1);
  }
}

testGoogleDrive();
