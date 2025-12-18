/**
 * 發送網站新增功能修復通知給受影響用戶
 *
 * 使用方式：
 * npx tsx scripts/send-fix-notification.ts
 */

import { sendEmail } from "../src/lib/email";
import dotenv from "dotenv";
import path from "path";

// 載入環境變數
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

// 受影響的用戶 Email 清單（12/14 - 12/18 註冊）
const affectedUsers = [
  "c910647258@gmail.com",
  "twseoking@gmail.com",
  "sylee.twn@gmail.com",
  "kaiboc19@gmail.com",
  "pizzapapahuwei@gmail.com",
  "ht90204@gmail.com",
  "jsl551056@gmail.com",
  "lalueur.marketing@gmail.com",
  "vincent505598@gmail.com",
  "k26735325tw@gmail.com",
  "mkt.potato@gmail.com",
  "qaz24851075@gmail.com",
  "torisake0503@gmail.com",
  "toodi696king@gmail.com",
  "allen13118@gmail.com",
  "s0927162821@gmail.com",
  "karenwu0923945@gmail.com",
  "stanley@fillup.com.tw",
  "bke83180@laoia.com",
  "simplelife414@gmail.com",
];

const subject = "【1waySEO】網站新增功能已修復，歡迎重新操作";

const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">功能修復通知</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #333333; font-size: 16px; line-height: 1.8; margin: 0 0 20px;">親愛的用戶您好：</p>

              <p style="color: #333333; font-size: 16px; line-height: 1.8; margin: 0 0 20px;">
                感謝您註冊 1waySEO！
              </p>

              <p style="color: #333333; font-size: 16px; line-height: 1.8; margin: 0 0 20px;">
                我們發現在 <strong>12/14 - 12/18</strong> 期間，新增 WordPress 網站功能存在異常，可能導致您無法順利完成網站設定。對此造成的不便，我們深感抱歉。
              </p>

              <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px 20px; margin: 25px 0; border-radius: 4px;">
                <p style="color: #155724; font-size: 16px; line-height: 1.6; margin: 0;">
                  <strong>✅ 此問題已於今日修復完成。</strong>
                </p>
              </div>

              <p style="color: #333333; font-size: 16px; line-height: 1.8; margin: 0 0 20px;">
                若您之前新增網站時遇到錯誤，請重新操作：
              </p>

              <ol style="color: #333333; font-size: 16px; line-height: 2; margin: 0 0 30px; padding-left: 20px;">
                <li>登入 1waySEO</li>
                <li>點選「網站管理」→「新增網站」</li>
                <li>填入您的 WordPress 網站資訊即可完成</li>
              </ol>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://1wayseo.com/dashboard/websites" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                      前往新增網站
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #666666; font-size: 14px; line-height: 1.8; margin: 30px 0 0;">
                如有任何問題，歡迎直接回覆此信件，我們會盡快協助您。
              </p>

              <p style="color: #333333; font-size: 16px; line-height: 1.8; margin: 20px 0 0;">
                感謝您的耐心與支持！
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 0 0 10px;">
                <strong>1waySEO 團隊</strong> 敬上
              </p>
              <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 0;">
                此郵件由 1waySEO 系統自動發送
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

async function sendNotifications() {
  console.log("📧 開始發送功能修復通知...\n");
  console.log(`總共需要發送: ${affectedUsers.length} 封郵件\n`);

  let successCount = 0;
  let failCount = 0;

  for (const email of affectedUsers) {
    try {
      const result = await sendEmail({
        to: email,
        subject,
        html: htmlContent,
      });

      if (result) {
        successCount++;
        console.log(
          `✅ [${successCount}/${affectedUsers.length}] 成功: ${email}`,
        );
      } else {
        failCount++;
        console.log(
          `❌ [${successCount + failCount}/${affectedUsers.length}] 失敗: ${email}`,
        );
      }

      // 每封郵件間隔 1 秒，避免被 Gmail 限制
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      failCount++;
      console.error(`❌ 發送失敗 (${email}):`, error);
    }
  }

  console.log("\n========================================");
  console.log(`📊 發送完成！`);
  console.log(`   ✅ 成功: ${successCount} 封`);
  console.log(`   ❌ 失敗: ${failCount} 封`);
  console.log("========================================");
}

sendNotifications().catch(console.error);
