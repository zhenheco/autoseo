import * as readline from 'readline';

// 從命令列參數取得 credentials
const clientId = process.argv[2];
const clientSecret = process.argv[3];

if (!clientId || !clientSecret) {
  console.error('使用方式: npx tsx scripts/get-google-drive-token.ts <CLIENT_ID> <CLIENT_SECRET>');
  process.exit(1);
}

const redirectUri = 'urn:ietf:wg:oauth:2.0:oob';
const scope = 'https://www.googleapis.com/auth/drive.file';

// 步驟 1: 生成授權 URL
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${encodeURIComponent(clientId)}&` +
  `redirect_uri=${encodeURIComponent(redirectUri)}&` +
  `response_type=code&` +
  `scope=${encodeURIComponent(scope)}&` +
  `access_type=offline&` +
  `prompt=consent`;

console.log('\n請按照以下步驟操作：\n');
console.log('1. 在瀏覽器中開啟以下 URL：');
console.log('\x1b[36m%s\x1b[0m', authUrl);
console.log('\n2. 授權後，複製授權碼貼到下方：\n');

// 步驟 2: 等待使用者輸入授權碼
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('授權碼: ', async (code) => {
  rl.close();

  try {
    // 步驟 3: 交換授權碼取得 refresh token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code.trim(),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`取得 token 失敗: ${error}`);
    }

    const tokenData = await tokenResponse.json();

    console.log('\n✅ 成功取得 Refresh Token！\n');
    console.log('請將以下內容加到 .env.local：\n');
    console.log(`GOOGLE_DRIVE_CLIENT_ID=${clientId}`);
    console.log(`GOOGLE_DRIVE_CLIENT_SECRET=<請從 Google Cloud Console 複製>`);
    console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokenData.refresh_token}`);
    console.log('\n⚠️  重要：請保管好這些憑證，不要提交到 Git！');
  } catch (error: any) {
    console.error('\n❌ 錯誤:', error.message);
    process.exit(1);
  }
});
