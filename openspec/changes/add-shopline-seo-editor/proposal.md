## Why

SHOPLINE merchants who authorize 1waySEO（per existing `shopline-oauth-saas`）can currently only execute SEO operations via CLI `pnpm shopline:cli seo-update`. Non-technical staff cannot manage SEO from the dashboard, and image alt / collection hierarchy / shop-level meta / AI-assisted drafts are not exposed at all. This change introduces a full SEO operations panel covering every SHOPLINE SEO-relevant surface so authorized merchants can manage SEO end-to-end inside the SaaS, while preserving the CLI path through a shared deep module.

## What Changes

- Add a new `shopline-seo-editor` capability spec covering products, collections, shop meta, image alt, categorization, hierarchy, redirects, AI drafts, audit log, scope guard, and write rate limit.
- Modify `shopline-oauth-saas` to add stronger guarantees on connection scope verification, per-company write rate limiting, and audit logging for any write that flows through an authorized connection.
- Introduce four new persistent tables — `shopline_seo_audit_log`, `shopline_redirects`, `shopline_collection_hierarchy`, `shopline_shop_meta` — each with company-scoped RLS keyed via `company_members` and `website_configs`.
- Add an AI-assisted draft path that uses the existing `lib/ai/api-router` fallback chain, never writes without human approval, and tags every AI-originated audit row with the model used.
- Add a dashboard entry point on the websites listing card so a connected merchant reaches the SEO panel in one click.

## Impact

- Affected specs: new `shopline-seo-editor`; modified `shopline-oauth-saas`
- Affected systems: SHOPLINE OAuth routes, ShoplineClient, connection store, dashboard websites pages, new API routes under `/api/shopline/[websiteId]/*`, Supabase migrations, CLI `seo-update`, AI Gateway routing
- Security impact: every write surface is gated by `withRouteAuth("company")` + connection scope guard + per-company sliding window rate limit; audit rows record before/after per field; AI prompts include only public SHOPLINE catalog data, never customer or order data; new tables enforce RLS via `company_members` join on `website_configs`
- Operational impact: four Supabase migrations applied to prod; `shopline_seo_audit_log` admin policy patch uses `company_members.role IN ('owner','admin')` (consistent with `ai_models_admin_all` pattern), not the non-existent `public.profiles` table
