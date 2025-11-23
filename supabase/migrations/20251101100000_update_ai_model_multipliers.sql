-- 更新所有 AI 模型的倍率為 2.0
-- 倍率代表：用戶消耗 1K tokens，實際計費 2K tokens

UPDATE ai_model_pricing
SET
  multiplier = 2.0,
  updated_at = NOW()
WHERE multiplier != 2.0;

-- 驗證更新結果
DO $$
DECLARE
  models_updated INTEGER;
BEGIN
  SELECT COUNT(*) INTO models_updated
  FROM ai_model_pricing
  WHERE multiplier = 2.0;

  RAISE NOTICE '已更新 % 個 AI 模型倍率為 2.0', models_updated;
END $$;
