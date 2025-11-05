import { google } from 'googleapis';
import * as readline from 'readline';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const REDIRECT_URI = 'http://localhost:3168/api/google-drive/auth/callback';

async function main() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('\n❌ Error: Missing required environment variables');
    console.error('Please set the following in your .env.local:');
    console.error('  - GOOGLE_DRIVE_CLIENT_ID');
    console.error('  - GOOGLE_DRIVE_CLIENT_SECRET\n');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    REDIRECT_URI
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n🔐 Google Drive OAuth Authorization\n');
  console.log('Step 1: Open this URL in your browser:');
  console.log('\x1b[36m%s\x1b[0m', authUrl);
  console.log('\nStep 2: Authorize the application');
  console.log('Step 3: Copy the authorization code from the URL');
  console.log('        (the "code" parameter after being redirected)\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Paste the authorization code here: ', async (code) => {
    rl.close();

    try {
      console.log('\n⏳ Exchanging code for tokens...');
      const { tokens } = await oauth2Client.getToken(code.trim());

      if (!tokens.refresh_token) {
        console.error('\n❌ Error: No refresh_token received');
        console.error('This usually happens if you have already authorized this app.');
        console.error('Try revoking access at: https://myaccount.google.com/permissions');
        console.error('Then run this script again.\n');
        process.exit(1);
      }

      console.log('\n✅ Success! Tokens received.\n');
      console.log('Add this to your .env.local file:\n');
      console.log('\x1b[32m%s\x1b[0m', `GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('\n⚠️  IMPORTANT: Never commit this token to git!\n');
    } catch (error: unknown) {
      const err = error as Error & { response?: { data?: { error?: string; error_description?: string } } };
      console.error('\n❌ Error exchanging code for tokens:');
      if (err.response?.data?.error) {
        console.error(`   ${err.response.data.error}: ${err.response.data.error_description}`);
      } else {
        console.error(`   ${err.message}`);
      }
      console.error('\nPlease try again.\n');
      process.exit(1);
    }
  });
}

main().catch((error: unknown) => {
  const err = error as Error;
  console.error('\n❌ Unexpected error:', err.message);
  process.exit(1);
});
