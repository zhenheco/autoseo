-- ===========================================
-- Patch: shopline_seo_audit_log admin select policy
-- Original migration referenced public.profiles (non-existent in this repo).
-- Use company_members.role pattern consistent with ai_models_admin_all policy.
-- ===========================================

CREATE POLICY shopline_seo_audit_log_admin_select
  ON public.shopline_seo_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members
      WHERE company_members.user_id = auth.uid()
        AND company_members.role IN ('owner', 'admin')
        AND company_members.status = 'active'
    )
  );
