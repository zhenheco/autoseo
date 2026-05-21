ALTER TABLE public.brands
  ADD COLUMN automation_level SMALLINT NOT NULL DEFAULT 1
    CHECK (automation_level BETWEEN 1 AND 4),
  ADD COLUMN auto_articles_per_week SMALLINT NOT NULL DEFAULT 0
    CHECK (auto_articles_per_week BETWEEN 0 AND 14),
  ADD COLUMN auto_publish_to_social BOOLEAN NOT NULL DEFAULT FALSE;
