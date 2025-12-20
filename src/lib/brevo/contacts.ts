/**
 * Brevo Contact 操作
 * 提供聯絡人的新增、更新、刪除功能
 */

import * as brevo from "@getbrevo/brevo";
import { getContactsApi } from "./client";
import { UserDataForBrevo, BREVO_LISTS } from "./types";
import {
  calculateSegment,
  getListIdBySegment,
  getAllSegmentListIds,
  getSegmentDisplayName,
} from "./segments";

/**
 * 新增或更新 Brevo Contact
 *
 * 流程：
 * 1. 計算用戶所屬分群
 * 2. 嘗試更新現有 Contact
 * 3. 如果 Contact 不存在，則新增
 * 4. 將 Contact 加入對應的分群 List，並從其他分群 List 移除
 */
export async function upsertContact(userData: UserDataForBrevo): Promise<void> {
  const contactsApi = getContactsApi();

  // 計算分群
  const segment = calculateSegment(userData.attributes);
  const segmentListId = getListIdBySegment(segment);

  // 更新 attributes 中的 SEGMENT
  const attributes = {
    ...userData.attributes,
    SEGMENT: segment,
  };

  // 準備要從其他分群移除的 List IDs
  const otherSegmentListIds = getAllSegmentListIds().filter(
    (id) => id !== segmentListId && id !== 0, // 過濾掉未設定的 List ID (0)
  );

  // 過濾掉未設定的 List ID
  const validListIds = [BREVO_LISTS.ALL_USERS, segmentListId].filter(
    (id) => id !== 0,
  );

  try {
    // 嘗試更新現有 Contact
    const updateContact = new brevo.UpdateContact();
    updateContact.attributes = attributes as unknown as object;

    // 只有在 List ID 已設定時才加入/移除
    if (validListIds.length > 0) {
      updateContact.listIds = validListIds;
    }
    if (otherSegmentListIds.length > 0) {
      updateContact.unlinkListIds = otherSegmentListIds;
    }

    await contactsApi.updateContact(userData.email, updateContact);
    console.log(
      `[Brevo] 更新 Contact: ${userData.email}, 分群: ${getSegmentDisplayName(segment)}`,
    );
  } catch (error: unknown) {
    // 檢查是否為 404 錯誤（Contact 不存在）
    const err = error as { status?: number; statusCode?: number };
    if (err.status === 404 || err.statusCode === 404) {
      // Contact 不存在，新增
      const createContact = new brevo.CreateContact();
      createContact.email = userData.email;
      createContact.attributes = attributes as unknown as object;

      // 只有在 List ID 已設定時才加入
      if (validListIds.length > 0) {
        createContact.listIds = validListIds;
      }

      await contactsApi.createContact(createContact);
      console.log(
        `[Brevo] 新增 Contact: ${userData.email}, 分群: ${getSegmentDisplayName(segment)}`,
      );
    } else {
      // 其他錯誤
      console.error(`[Brevo] 操作 Contact 失敗: ${userData.email}`, error);
      throw error;
    }
  }
}

/**
 * 刪除 Contact（用戶刪除帳號時使用）
 */
export async function deleteContact(email: string): Promise<void> {
  const contactsApi = getContactsApi();

  try {
    await contactsApi.deleteContact(email);
    console.log(`[Brevo] 刪除 Contact: ${email}`);
  } catch (error: unknown) {
    const err = error as { status?: number; statusCode?: number };
    // 如果 Contact 不存在，忽略錯誤
    if (err.status === 404 || err.statusCode === 404) {
      console.log(`[Brevo] Contact 不存在，跳過刪除: ${email}`);
      return;
    }
    console.error(`[Brevo] 刪除 Contact 失敗: ${email}`, error);
    throw error;
  }
}

/**
 * 取得 Contact 資訊
 */
export async function getContact(
  email: string,
): Promise<brevo.GetExtendedContactDetails | null> {
  const contactsApi = getContactsApi();

  try {
    const result = await contactsApi.getContactInfo(email);
    return result.body;
  } catch (error: unknown) {
    const err = error as { status?: number; statusCode?: number };
    if (err.status === 404 || err.statusCode === 404) {
      return null;
    }
    throw error;
  }
}
