import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const createTransporter = (): Transporter<SMTPTransport.SentMessageInfo> => {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

  if (!gmailUser || !gmailAppPassword) {
    throw new Error(
      "Gmail credentials not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD in .env.local",
    );
  }

  const transportConfig = {
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  };

  const mailer = nodemailer as any;
  if (typeof mailer.createTransport === "function") {
    return mailer.createTransport(transportConfig);
  } else if (
    mailer.default &&
    typeof mailer.default.createTransport === "function"
  ) {
    return mailer.default.createTransport(transportConfig);
  } else {
    throw new Error("Unable to create nodemailer transport");
  }
};

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: EmailOptions): Promise<boolean> {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: {
        name: process.env.COMPANY_NAME || "1waySEO",
        address: process.env.GMAIL_USER || "",
      },
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ 郵件已發送:", info.messageId);
    return true;
  } catch (error) {
    console.error("❌ 郵件發送失敗:", error);
    return false;
  }
}

interface CompanyInvitationEmailParams {
  toEmail: string;
  companyName: string;
  inviterName: string;
  role: string;
  inviteLink: string;
}

export async function sendCompanyInvitationEmail({
  toEmail,
  companyName,
  inviterName,
  role,
  inviteLink,
}: CompanyInvitationEmailParams): Promise<boolean> {
  const roleTranslation: Record<string, string> = {
    owner: "擁有者",
    admin: "管理員",
    editor: "編輯者",
    writer: "寫手",
    viewer: "觀察者",
  };

  const roleName = roleTranslation[role] || role;

  const subject = `邀請您加入 ${companyName} 團隊`;

  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">團隊邀請</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">您好，</p>

              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                <strong>${inviterName}</strong> 邀請您加入 <strong>${companyName}</strong> 團隊，擔任 <strong style="color: #667eea;">${roleName}</strong> 角色。
              </p>

              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0;">
                  <strong>角色權限說明：</strong><br>
                  ${getRoleDescription(role)}
                </p>
              </div>

              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                點擊下方按鈕接受邀請並開始使用：
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                      接受邀請
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 30px 0 0; text-align: center;">
                或複製此連結到瀏覽器：<br>
                <a href="${inviteLink}" style="color: #667eea; text-decoration: none; word-break: break-all;">${inviteLink}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 0 0 10px;">
                此郵件由 <strong>${process.env.COMPANY_NAME || "1waySEO"}</strong> 自動發送
              </p>
              <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 0;">
                如果您未預期收到此郵件，請忽略即可
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

  return sendEmail({ to: toEmail, subject, html });
}

function getRoleDescription(role: string): string {
  const descriptions: Record<string, string> = {
    owner: "完整的公司管理權限，包含訂閱管理、成員管理、查看所有活動日誌",
    admin: "管理網站配置、邀請 Editor/Writer/Viewer、查看所有文章和統計",
    editor: "編輯指定網站、邀請 Writer、生成和管理文章",
    writer: "生成文章、查看自己的文章和使用統計",
    viewer: "查看自己的文章，僅限閱讀權限",
  };
  return descriptions[role] || "團隊成員";
}
