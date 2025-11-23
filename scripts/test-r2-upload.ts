import { config } from 'dotenv';
import { R2Client, getR2Config } from '../src/lib/storage/r2-client';

config({ path: '.env.local' });

async function testR2Upload() {
  console.log('\n=== R2 上傳測試 ===\n');

  try {
    // 檢查環境變數
    console.log('1. 檢查環境變數配置...');
    const requiredEnvVars = [
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET_NAME',
    ];

    const missingVars = requiredEnvVars.filter((key) => !process.env[key]);

    if (missingVars.length > 0) {
      console.error('\n❌ 缺少以下環境變數:');
      missingVars.forEach((key) => console.error(`   - ${key}`));
      console.error('\n請在 .env.local 中設定這些環境變數\n');
      return;
    }

    console.log('✅ 環境變數配置完整\n');

    // 取得 R2 配置
    console.log('2. 初始化 R2 客戶端...');
    const r2Config = getR2Config();
    const r2Client = new R2Client(r2Config);
    console.log('✅ R2 客戶端初始化成功\n');

    // 建立測試圖片（1x1 透明 PNG）
    console.log('3. 準備測試圖片...');
    const testImageBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    // 上傳測試圖片
    console.log('4. 上傳測試圖片到 R2...');
    const result = await r2Client.uploadImage(
      testImageBase64,
      'test-image.png',
      'image/png'
    );

    console.log('✅ 圖片上傳成功！\n');
    console.log('上傳結果:');
    console.log(`   URL: ${result.url}`);
    console.log(`   File Key: ${result.fileKey}`);
    console.log(`   Size: ${result.size} bytes\n`);

    // 測試取得簽署 URL
    console.log('5. 測試取得簽署 URL...');
    const signedUrl = await r2Client.getSignedUrl(result.fileKey, 3600);
    console.log('✅ 簽署 URL 生成成功');
    console.log(`   Signed URL: ${signedUrl.substring(0, 100)}...\n`);

    console.log('=== ✅ R2 測試完成 ===\n');
    console.log('下一步：');
    console.log('1. 在瀏覽器中開啟上述 URL 確認圖片可正常顯示');
    console.log('2. 執行完整的文章生成測試驗證圖片整合\n');
  } catch (error) {
    console.error('\n❌ 測試失敗:', error);
    if (error instanceof Error) {
      console.error('錯誤訊息:', error.message);
      console.error('錯誤堆疊:', error.stack);
    }
    console.error('');
  }
}

testR2Upload().catch(console.error);
