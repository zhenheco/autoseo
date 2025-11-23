-- 修復 agent_configs 表中的 meta_model 配置
-- 將所有 gpt-3.5-turbo 替換為 deepseek-chat

-- 1. 檢查目前的配置
SELECT
  id,
  website_id,
  meta_model,
  simple_processing_model,
  updated_at
FROM agent_configs
WHERE meta_model = 'gpt-3.5-turbo'
   OR simple_processing_model = 'gpt-3.5-turbo';

-- 2. 更新 meta_model
UPDATE agent_configs
SET
  meta_model = 'deepseek-chat',
  updated_at = NOW()
WHERE meta_model = 'gpt-3.5-turbo';

-- 3. 更新 simple_processing_model (如果存在)
UPDATE agent_configs
SET
  simple_processing_model = 'deepseek-chat',
  updated_at = NOW()
WHERE simple_processing_model = 'gpt-3.5-turbo';

-- 4. 驗證更新結果
SELECT
  id,
  website_id,
  meta_model,
  simple_processing_model,
  updated_at
FROM agent_configs
ORDER BY updated_at DESC
LIMIT 10;
