/**
 * 外部網站相關類型定義
 * 用於外部網站管理功能（website_type = 'external'）
 */

/**
 * 品牌聲音設定
 */
export interface BrandVoice {
  brand_name?: string;
  tone_of_voice?: string;
  target_audience?: string;
  writing_style?: string;
}

/**
 * 外部網站基本資訊（列表用）
 */
export interface ExternalWebsiteListItem {
  id: string;
  website_name: string;
  external_slug: string | null;
  webhook_url: string | null;
  webhook_secret: string | null;
  sync_on_publish: boolean | null;
  sync_on_update: boolean | null;
  sync_on_unpublish: boolean | null;
  sync_translations: boolean | null;
  sync_languages: string[] | null;
  is_active: boolean | null;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  created_at: string | null;
}

/**
 * 外部網站完整資訊（編輯用）
 */
export interface ExternalWebsiteDetail extends ExternalWebsiteListItem {
  brand_voice: BrandVoice | null;
  industry: string | null;
  region: string | null;
  language: string | null;
  daily_article_limit: number | null;
  auto_schedule_enabled: boolean | null;
  schedule_type: "daily" | "interval" | null;
  schedule_interval_days: number | null;
}

/**
 * 建立外部網站的表單資料
 */
export interface CreateExternalWebsiteFormData {
  name: string;
  slug: string;
  description: string;
  webhook_url: string;
  sync_on_publish: boolean;
  sync_on_update: boolean;
  sync_on_unpublish: boolean;
  sync_translations: boolean;
}

/**
 * 同步設定表單 props
 */
export interface SyncFormProps {
  websiteId: string;
  syncOnPublish: boolean | null;
  syncOnUpdate: boolean | null;
  syncOnUnpublish: boolean | null;
  syncTranslations: boolean | null;
}

/**
 * 品牌聲音表單 props
 */
export interface BrandVoiceFormProps {
  websiteId: string;
  brandVoice: BrandVoice | null;
}

/**
 * 自動排程表單 props
 */
export interface AutoScheduleFormProps {
  websiteId: string;
  dailyArticleLimit: number | null;
  autoScheduleEnabled: boolean | null;
  scheduleType: "daily" | "interval" | null;
  scheduleIntervalDays: number | null;
}

/**
 * 文章設定表單 props
 */
export interface SettingsFormProps {
  websiteId: string;
  industry: string | null;
  region: string | null;
  language: string | null;
}
