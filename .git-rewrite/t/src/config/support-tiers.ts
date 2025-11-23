export const SUPPORT_TIERS = {
  community: {
    label: '社群支援',
    labelEn: 'Community Support',
    response_time: '無保證',
    response_time_en: 'No guarantee',
    channels: ['論壇', '文檔'],
    channels_en: ['Forum', 'Documentation'],
    availability: '24/7（自助）',
    availability_en: '24/7 (Self-service)',
  },
  standard: {
    label: '標準支援',
    labelEn: 'Standard Support',
    response_time: '48 小時',
    response_time_en: '48 hours',
    channels: ['Email'],
    channels_en: ['Email'],
    availability: '工作日 9:00-18:00',
    availability_en: 'Weekdays 9:00-18:00',
  },
  priority: {
    label: '優先支援',
    labelEn: 'Priority Support',
    response_time: '24 小時',
    response_time_en: '24 hours',
    channels: ['Email', '即時聊天'],
    channels_en: ['Email', 'Live Chat'],
    availability: '7×24（聊天工作日）',
    availability_en: '7×24 (Chat on weekdays)',
  },
  dedicated: {
    label: '專屬客戶經理',
    labelEn: 'Dedicated Account Manager',
    response_time: '4 小時',
    response_time_en: '4 hours',
    channels: ['電話', 'Email', '即時聊天'],
    channels_en: ['Phone', 'Email', 'Live Chat'],
    availability: '7×24',
    availability_en: '7×24',
    extras: ['定期業務檢討', '專屬聯繫窗口', '優先功能請求'],
    extras_en: ['Regular business reviews', 'Dedicated contact', 'Priority feature requests'],
  },
} as const;

export type SupportLevel = keyof typeof SUPPORT_TIERS;

export const TIER_HIERARCHY: Record<SupportLevel, number> = {
  community: 0,
  standard: 1,
  priority: 2,
  dedicated: 3,
};

export function canAccessSupportChannel(
  userTier: SupportLevel,
  channel: 'email' | 'chat' | 'phone'
): boolean {
  const tierLevel = TIER_HIERARCHY[userTier];
  const requiredLevels = {
    email: 1,
    chat: 2,
    phone: 3,
  };

  return tierLevel >= requiredLevels[channel];
}
