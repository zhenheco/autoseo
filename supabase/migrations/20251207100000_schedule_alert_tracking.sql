-- 新增欄位追蹤已發送的排程警告通知
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS schedule_alerts_sent JSONB DEFAULT '{}';

COMMENT ON COLUMN companies.schedule_alerts_sent IS '追蹤已發送的排程警告通知，格式: {"7_day": "ISO日期", "3_day": "ISO日期", "1_day": "ISO日期"}';
