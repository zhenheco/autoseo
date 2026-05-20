/**
 * Brevo API 客戶端初始化
 * 用於 Contact 管理和 Email 發送
 */

import * as brevo from "@getbrevo/brevo";

/**
 * 檢查 Brevo 是否已設定
 */
export function isBrevoConfigured(): boolean {
  return !!process.env.BREVO_API_KEY;
}

/**
 * 取得 Contacts API 實例
 * 用於管理聯絡人（新增、更新、刪除、加入 List）
 */
export function getContactsApi(): brevo.ContactsApi {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    throw new Error(
      "BREVO_API_KEY 未設定。請在 .env.local 中新增 BREVO_API_KEY 環境變數。",
    );
  }

  const contactsApi = new brevo.ContactsApi();
  contactsApi.setApiKey(brevo.ContactsApiApiKeys.apiKey, apiKey);

  return contactsApi;
}

/**
 * 取得 Transactional Emails API 實例
 * 用於即時發送交易郵件（如驗證碼、通知等）
 */
export function getTransactionalEmailsApi(): brevo.TransactionalEmailsApi {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    throw new Error(
      "BREVO_API_KEY 未設定。請在 .env.local 中新增 BREVO_API_KEY 環境變數。",
    );
  }

  const transactionalApi = new brevo.TransactionalEmailsApi();
  transactionalApi.setApiKey(
    brevo.TransactionalEmailsApiApiKeys.apiKey,
    apiKey,
  );

  return transactionalApi;
}
