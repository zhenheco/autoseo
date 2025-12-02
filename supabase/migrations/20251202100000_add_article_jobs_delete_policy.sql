-- ===========================================
-- 新增 article_jobs DELETE 政策
-- 修復：文章無法刪除的問題
-- ===========================================

-- 檢查並刪除舊的 DELETE 政策（如果存在）
DROP POLICY IF EXISTS "Users can delete article jobs" ON article_jobs;

-- 新增 DELETE 政策：使用者可以刪除自己的文章或公司管理員可以刪除公司文章
CREATE POLICY "Users can delete article jobs"
  ON article_jobs FOR DELETE
  USING (
    user_id = auth.uid() OR
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- 同時確保 generated_articles 也有 DELETE 政策
DROP POLICY IF EXISTS "Users can delete generated articles" ON generated_articles;

CREATE POLICY "Users can delete generated articles"
  ON generated_articles FOR DELETE
  USING (
    user_id = auth.uid() OR
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

COMMENT ON POLICY "Users can delete article jobs" ON article_jobs IS '允許使用者刪除自己建立的文章，或公司管理員刪除公司文章';
COMMENT ON POLICY "Users can delete generated articles" ON generated_articles IS '允許使用者刪除自己的文章內容，或公司管理員刪除公司文章';
