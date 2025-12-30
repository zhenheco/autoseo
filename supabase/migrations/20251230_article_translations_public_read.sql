-- Migration: 為 article_translations 添加公開讀取策略
-- 日期: 2025-12-30
-- 問題: 翻譯文章頁面返回 404，因為 RLS 策略阻擋未登入訪客讀取
-- 解決方案: 添加公開讀取策略，允許讀取 status = 'published' 的翻譯

-- 為 article_translations 添加公開讀取策略
-- 允許未登入訪客（公開 Blog）讀取已發布的翻譯文章
CREATE POLICY "Public can view published translations"
ON article_translations
FOR SELECT
TO public
USING (status = 'published');

-- 驗證策略已建立
-- 執行後應該看到新策略：Public can view published translations
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'article_translations';
