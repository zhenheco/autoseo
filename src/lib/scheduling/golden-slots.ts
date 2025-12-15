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
