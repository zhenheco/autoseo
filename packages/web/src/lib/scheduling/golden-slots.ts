/**
 * 黃金時段排程工具
 * 用於計算文章發布的最佳時間點
 */

/**
 * 黃金時段定義（UTC 時間）
 * UTC 01:00 = 台灣 09:00（早上）
 * UTC 06:00 = 台灣 14:00（下午）
 * UTC 12:00 = 台灣 20:00（晚上）
 */
export const GOLDEN_SLOTS_UTC = [1, 6, 12];

/**
 * 對應的台灣時間（用於顯示）
 */
export const GOLDEN_SLOTS_TW = [9, 14, 20];

/**
 * 擴充時段定義（UTC 時間）- 支援每日最多 5 篇
 * 包含 3 個黃金時段 + 2 個補位時段
 * UTC 01:00 = 台灣 09:00（早上）
 * UTC 03:00 = 台灣 11:00（上午補位）
 * UTC 06:00 = 台灣 14:00（下午）
 * UTC 09:00 = 台灣 17:00（傍晚補位）
 * UTC 12:00 = 台灣 20:00（晚上）
 */
export const EXTENDED_SLOTS_UTC = [1, 3, 6, 9, 12];

/**
 * 根據每日文章數量取得對應的時段
 * 優先使用黃金時段，超過 3 篇時使用補位時段
 *
 * @param count 每日文章數（1-5）
 * @returns 對應的 UTC 時段陣列
 *
 * @example
 * getExtendedSlotsForCount(1) // [1] → 09:00
 * getExtendedSlotsForCount(2) // [1, 6] → 09:00, 14:00
 * getExtendedSlotsForCount(3) // [1, 6, 12] → 09:00, 14:00, 20:00
 * getExtendedSlotsForCount(4) // [1, 3, 6, 12] → 09:00, 11:00, 14:00, 20:00
 * getExtendedSlotsForCount(5) // [1, 3, 6, 9, 12] → 09:00, 11:00, 14:00, 17:00, 20:00
 */
export function getExtendedSlotsForCount(count: number): number[] {
  // 每日篇數對應的時段索引映射
  const slotMappings: Record<number, number[]> = {
    1: [1], // 09:00
    2: [1, 6], // 09:00, 14:00
    3: [1, 6, 12], // 09:00, 14:00, 20:00
    4: [1, 3, 6, 12], // 09:00, 11:00, 14:00, 20:00
    5: [1, 3, 6, 9, 12], // 09:00, 11:00, 14:00, 17:00, 20:00
  };

  // 確保 count 在有效範圍內
  const normalizedCount = Math.max(1, Math.min(5, count));
  return slotMappings[normalizedCount];
}

/**
 * 計算從現在開始的下一個黃金時段
 *
 * @param fromDate 起始時間（預設為現在）
 * @returns 下一個黃金時段的 Date 物件
 *
 * @example
 * // 假設現在是台灣時間 10:30
 * getNextGoldenSlot() // 返回今天 14:00
 *
 * // 假設現在是台灣時間 21:00
 * getNextGoldenSlot() // 返回明天 09:00
 */
export function getNextGoldenSlot(fromDate?: Date): Date {
  const now = fromDate || new Date();
  const currentHourUTC = now.getUTCHours();
  const currentMinuteUTC = now.getUTCMinutes();

  // 找到下一個可用的黃金時段
  let nextSlotHour: number | null = null;
  let addDays = 0;

  for (const slot of GOLDEN_SLOTS_UTC) {
    // 如果當前小時小於這個時段，或者相等但分鐘數也小於（預留緩衝）
    if (
      currentHourUTC < slot ||
      (currentHourUTC === slot && currentMinuteUTC < 30)
    ) {
      nextSlotHour = slot;
      break;
    }
  }

  // 如果今天沒有可用的時段，使用明天的第一個時段
  if (nextSlotHour === null) {
    nextSlotHour = GOLDEN_SLOTS_UTC[0];
    addDays = 1;
  }

  // 建立排程時間
  const scheduledTime = new Date(now);
  scheduledTime.setUTCDate(scheduledTime.getUTCDate() + addDays);
  scheduledTime.setUTCHours(nextSlotHour, 0, 0, 0);

  // 加入隨機偏移 (0-15 分鐘)，讓時間更自然
  const randomOffset = Math.floor(Math.random() * 16);
  scheduledTime.setUTCMinutes(randomOffset);

  return scheduledTime;
}

/**
 * 計算從現在開始的下一個黃金時段（ISO 字串格式）
 *
 * @param fromDate 起始時間（預設為現在）
 * @returns ISO 格式的時間字串
 */
export function getNextGoldenSlotISO(fromDate?: Date): string {
  return getNextGoldenSlot(fromDate).toISOString();
}

/**
 * 取得指定日期的所有黃金時段
 *
 * @param date 指定日期
 * @returns 該日期的所有黃金時段 Date 陣列
 */
export function getGoldenSlotsForDate(date: Date): Date[] {
  return GOLDEN_SLOTS_UTC.map((hour) => {
    const slotTime = new Date(date);
    slotTime.setUTCHours(hour, 0, 0, 0);
    return slotTime;
  });
}

/**
 * 檢查指定時間是否為黃金時段
 *
 * @param date 要檢查的時間
 * @returns 是否為黃金時段
 */
export function isGoldenSlot(date: Date): boolean {
  const hour = date.getUTCHours();
  return GOLDEN_SLOTS_UTC.includes(hour);
}

/**
 * 格式化黃金時段為台灣時間顯示
 *
 * @param date UTC 時間
 * @returns 台灣時間格式字串（如 "09:00"、"14:00"、"20:00"）
 */
export function formatGoldenSlotTW(date: Date): string {
  // UTC 轉台灣時間 (+8)
  const twHour = (date.getUTCHours() + 8) % 24;
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  return `${twHour.toString().padStart(2, "0")}:${minutes}`;
}
