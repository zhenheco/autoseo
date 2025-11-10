-- Migration: OAuth Login Metrics Table
-- Description: Creates oauth_login_metrics table for monitoring and alerting
-- Author: Claude Code
-- Date: 2025-11-10

-- ============================================================================
-- Create oauth_login_metrics Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_login_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  path TEXT NOT NULL CHECK (path IN ('existing', 'trigger_success', 'fallback_success', 'failed')),
  trigger_delay_ms INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Create Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_oauth_metrics_created_at ON oauth_login_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_oauth_metrics_path ON oauth_login_metrics(path);
CREATE INDEX IF NOT EXISTS idx_oauth_metrics_provider ON oauth_login_metrics(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_metrics_user_id ON oauth_login_metrics(user_id);

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================

ALTER TABLE oauth_login_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Users can view their own metrics
CREATE POLICY "Users can view their own metrics"
  ON oauth_login_metrics
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert metrics
CREATE POLICY "Service role can insert metrics"
  ON oauth_login_metrics
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- Cleanup Function (30 days retention)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_oauth_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM oauth_login_metrics
  WHERE created_at < NOW() - INTERVAL '30 days';

  RAISE LOG 'Cleaned up oauth_login_metrics older than 30 days';
END;
$$;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE oauth_login_metrics IS
  'Tracks OAuth login performance metrics for monitoring and alerting';

COMMENT ON COLUMN oauth_login_metrics.path IS
  'Which layer succeeded: existing (Layer 1), trigger_success (Layer 2), fallback_success (Layer 3), or failed';

COMMENT ON COLUMN oauth_login_metrics.trigger_delay_ms IS
  'Total time from callback start to company verification, in milliseconds';

COMMENT ON FUNCTION cleanup_old_oauth_metrics IS
  'Deletes oauth_login_metrics records older than 30 days';
