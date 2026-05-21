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

/**
 * 計費失敗告警 Email 參數
 */
export interface FailedBillingJob {
  jobId: string;
  companyId: string;
  companyName?: string;
  error: string;
  createdAt: string;
  retryResult?: "success" | "failed";
}

interface BillingAlertEmailParams {
  failedJobs: FailedBillingJob[];
  retrySuccessCount: number;
  retryFailedCount: number;
}

/**
 * 發送計費失敗告警郵件給管理員
 * 僅在自動重試後仍有失敗任務時發送
 */
export async function sendBillingAlertEmail({
  failedJobs,
  retrySuccessCount,
  retryFailedCount,
}: BillingAlertEmailParams): Promise<boolean> {
  // 從環境變數獲取管理員 Email 列表
  const adminEmails =
    process.env.ADMIN_EMAILS || process.env.SUPER_ADMIN_EMAILS || "";
  const recipients = adminEmails.split(",").filter((e) => e.trim());

  if (recipients.length === 0) {
    console.error("❌ 無法發送計費告警：未設定 ADMIN_EMAILS 環境變數");
    return false;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://1wayseo.com";
  const now = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

  const subject = `[1waySEO 告警] ${retryFailedCount} 筆計費失敗需人工處理`;

  const jobRows = failedJobs
    .map(
      (job, index) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px; color: #374151;">${index + 1}</td>
        <td style="padding: 12px; font-family: monospace; font-size: 12px; color: #6b7280;">${job.jobId.slice(0, 8)}...</td>
        <td style="padding: 12px; color: #374151;">${job.companyName || job.companyId.slice(0, 8)}</td>
        <td style="padding: 12px; color: #dc2626;">${job.error}</td>
        <td style="padding: 12px; color: #6b7280;">${new Date(job.createdAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}</td>
      </tr>
    `,
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <!-- 告警標題 -->
    <div style="background-color: #FEE2E2; border-left: 4px solid #DC2626; padding: 20px;">
      <h2 style="color: #991B1B; margin: 0 0 10px 0;">⚠️ 計費審計告警</h2>
      <p style="color: #374151; margin: 0; font-size: 14px;">
        發現 <strong>${retryFailedCount}</strong> 筆計費失敗，需要人工處理
      </p>
    </div>

    <!-- 統計摘要 -->
    <div style="padding: 20px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
      <h3 style="color: #374151; margin: 0 0 12px 0; font-size: 14px;">📊 處理摘要</h3>
      <div style="display: flex; gap: 24px;">
        <div>
          <span style="color: #6b7280; font-size: 12px;">自動重試成功</span>
          <p style="color: #059669; font-size: 20px; font-weight: 600; margin: 4px 0 0 0;">${retrySuccessCount}</p>
        </div>
        <div>
          <span style="color: #6b7280; font-size: 12px;">仍需人工處理</span>
          <p style="color: #dc2626; font-size: 20px; font-weight: 600; margin: 4px 0 0 0;">${retryFailedCount}</p>
        </div>
      </div>
    </div>

    <!-- 失敗任務列表 -->
    <div style="padding: 20px;">
      <h3 style="color: #374151; margin: 0 0 12px 0; font-size: 14px;">🚨 失敗任務詳情</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 12px; text-align: left; color: #6b7280;">#</th>
            <th style="padding: 12px; text-align: left; color: #6b7280;">Job ID</th>
            <th style="padding: 12px; text-align: left; color: #6b7280;">公司</th>
            <th style="padding: 12px; text-align: left; color: #6b7280;">錯誤</th>
            <th style="padding: 12px; text-align: left; color: #6b7280;">創建時間</th>
          </tr>
        </thead>
        <tbody>
          ${jobRows}
        </tbody>
      </table>
    </div>

    <!-- 行動按鈕 -->
    <div style="padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <a href="${appUrl}/admin/billing"
         style="display: inline-block; background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
        前往後台處理
      </a>
    </div>

    <!-- 頁腳 -->
    <div style="background-color: #F9FAFB; padding: 16px 20px; text-align: center; color: #6B7280; font-size: 12px;">
      告警時間：${now}<br>
      此郵件由 1WaySEO 自動發送，請勿直接回覆
    </div>
  </div>
</body>
</html>
  `;

  // 發送給所有管理員
  let success = true;
  for (const recipient of recipients) {
    const result = await sendEmail({
      to: recipient.trim(),
      subject,
      html,
    });
    if (!result) success = false;
  }

  return success;
}

interface ScheduleAlertEmailParams {
  to: string;
  websiteName: string;
  daysRemaining: number;
  alertLevel: 7 | 3 | 1;
}

export async function sendScheduleAlertEmail({
  to,
  websiteName,
  daysRemaining,
  alertLevel,
}: ScheduleAlertEmailParams): Promise<boolean> {
  const colors: Record<number, { bg: string; border: string; text: string }> = {
    7: { bg: "#FEF3C7", border: "#F59E0B", text: "#B45309" }, // 黃色
    3: { bg: "#FED7AA", border: "#EA580C", text: "#C2410C" }, // 橘色
    1: { bg: "#FEE2E2", border: "#DC2626", text: "#991B1B" }, // 紅色
  };

  const c = colors[alertLevel];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://1wayseo.com";

  const subject = `${alertLevel}天警告：再過 ${daysRemaining} 天就沒有排程文章囉！`;

  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background-color: ${c.bg}; border-left: 4px solid ${c.border}; padding: 20px;">
      <h2 style="color: ${c.text}; margin: 0 0 10px 0;">${alertLevel}天警告</h2>
      <p style="color: #374151; margin: 0; font-size: 16px;">
        再過 <strong>${daysRemaining}</strong> 天就沒有排程文章囉！
      </p>
    </div>
    <div style="padding: 20px;">
      <p style="color: #4B5563; line-height: 1.6;">
        您的網站「<strong>${websiteName}</strong>」的排程文章即將用盡。
      </p>
      <p style="color: #4B5563; line-height: 1.6;">
        快來補充新文章，確保網站持續有新內容發布！
      </p>
      <div style="text-align: center; margin-top: 24px;">
        <a href="${appUrl}/dashboard/articles/manage"
           style="display: inline-block; background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          前往補充文章
        </a>
      </div>
    </div>
    <div style="background-color: #F9FAFB; padding: 16px 20px; text-align: center; color: #6B7280; font-size: 12px;">
      此郵件由 1WaySEO 自動發送
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({ to, subject, html });
}

/**
 * 錯誤告警 Email 參數
 */
export interface ErrorAlertEmailParams {
  error: {
    id: string;
    severity: string;
    category: string;
    message: string;
    stack?: string;
    source: string;
    agentName?: string;
    endpoint?: string;
    articleJobId?: string;
    companyId?: string;
    timestamp: string;
  };
}

/**
 * 發送系統錯誤告警郵件給管理員
 * 用於 CRITICAL 等級的錯誤通知
 */
export async function sendErrorAlertEmail({
  error,
}: ErrorAlertEmailParams): Promise<boolean> {
  // 從環境變數獲取管理員 Email 列表
  const adminEmails =
    process.env.ADMIN_EMAILS || process.env.SUPER_ADMIN_EMAILS || "";
  const recipients = adminEmails.split(",").filter((e) => e.trim());

  if (recipients.length === 0) {
    console.error("❌ 無法發送錯誤告警：未設定 ADMIN_EMAILS 環境變數");
    return false;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://1wayseo.com";

  // 格式化時間為台灣時區
  const formattedTime = new Date(error.timestamp).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
  });

  // 類別翻譯
  const categoryTranslation: Record<string, string> = {
    network: "網路錯誤",
    ai_api: "AI API 錯誤",
    timeout: "超時錯誤",
    rate_limit: "限速錯誤",
    parsing: "解析錯誤",
    validation: "驗證錯誤",
    logic: "邏輯錯誤",
    unknown: "未知錯誤",
  };

  // 來源翻譯
  const sourceTranslation: Record<string, string> = {
    agent: "Agent 代理",
    api: "API 端點",
    cron: "排程任務",
  };

  const categoryName =
    categoryTranslation[error.category.toLowerCase()] || error.category;
  const sourceName =
    sourceTranslation[error.source.toLowerCase()] || error.source;

  // 簡短錯誤訊息（用於標題）
  const shortMessage =
    error.message.length > 50
      ? error.message.substring(0, 50) + "..."
      : error.message;

  const subject = `[1waySEO CRITICAL] ${categoryName} - ${shortMessage}`;

  // Stack trace 格式化（限制長度）
  const stackTrace = error.stack
    ? error.stack.split("\n").slice(0, 10).join("\n")
    : "無堆疊追蹤資訊";

  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 700px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <!-- 告警標題 -->
    <div style="background-color: #FEE2E2; border-left: 4px solid #DC2626; padding: 20px;">
      <h2 style="color: #991B1B; margin: 0 0 10px 0;">🚨 系統嚴重錯誤</h2>
      <p style="color: #374151; margin: 0; font-size: 14px;">
        偵測到 <strong style="color: #DC2626;">CRITICAL</strong> 等級的系統錯誤
      </p>
    </div>

    <!-- 錯誤資訊摘要 -->
    <div style="padding: 20px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; width: 100px;">錯誤 ID</td>
          <td style="padding: 8px 0; color: #374151; font-family: monospace; font-size: 12px;">${error.id}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">類別</td>
          <td style="padding: 8px 0; color: #374151;">${categoryName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">來源</td>
          <td style="padding: 8px 0; color: #374151;">${sourceName}${error.agentName ? ` - ${error.agentName}` : ""}${error.endpoint ? ` (${error.endpoint})` : ""}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">時間</td>
          <td style="padding: 8px 0; color: #374151;">${formattedTime}</td>
        </tr>
        ${
          error.articleJobId
            ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">任務 ID</td>
          <td style="padding: 8px 0; color: #374151; font-family: monospace; font-size: 12px;">${error.articleJobId}</td>
        </tr>
        `
            : ""
        }
        ${
          error.companyId
            ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">公司 ID</td>
          <td style="padding: 8px 0; color: #374151; font-family: monospace; font-size: 12px;">${error.companyId}</td>
        </tr>
        `
            : ""
        }
      </table>
    </div>

    <!-- 錯誤訊息 -->
    <div style="padding: 20px;">
      <h3 style="color: #374151; margin: 0 0 12px 0; font-size: 14px;">📋 錯誤訊息</h3>
      <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; padding: 16px;">
        <p style="color: #991B1B; margin: 0; font-size: 14px; white-space: pre-wrap; word-break: break-word;">${error.message}</p>
      </div>
    </div>

    <!-- Stack Trace -->
    <div style="padding: 0 20px 20px;">
      <h3 style="color: #374151; margin: 0 0 12px 0; font-size: 14px;">📜 Stack Trace</h3>
      <div style="background-color: #1F2937; border-radius: 6px; padding: 16px; overflow-x: auto;">
        <pre style="color: #D1D5DB; margin: 0; font-size: 12px; font-family: 'Monaco', 'Menlo', monospace; white-space: pre-wrap; word-break: break-all;">${stackTrace}</pre>
      </div>
    </div>

    <!-- 行動按鈕 -->
    <div style="padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <a href="${appUrl}/admin/logs"
         style="display: inline-block; background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
        前往後台查看
      </a>
    </div>

    <!-- 頁腳 -->
    <div style="background-color: #F9FAFB; padding: 16px 20px; text-align: center; color: #6B7280; font-size: 12px;">
      此郵件由 1WaySEO 錯誤監控系統自動發送，請勿直接回覆
    </div>
  </div>
</body>
</html>
  `;

  // 發送給所有管理員
  let success = true;
  for (const recipient of recipients) {
    const result = await sendEmail({
      to: recipient.trim(),
      subject,
      html,
    });
    if (!result) success = false;
  }

  return success;
}
