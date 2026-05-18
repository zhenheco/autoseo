## Why

SHOPLINE customers are unlikely to share admin accounts or manually create private app tokens. 1waySEO needs a low-friction authorization flow where customers only provide their shop handle and approve a dedicated 1wayseo app install, while the platform safely stores the resulting token and enables CLI-first operations before the full SaaS UI is complete.

## What Changes

- Add a SHOPLINE customer-app OAuth authorization flow as the primary integration path.
- Store SHOPLINE access tokens server-side with company and website ownership, never in browser-visible output or issue text.
- Keep the existing private-app CLI path as an internal fallback for trusted test stores.
- Add a connected-store model that lets CLI and SaaS workflows resolve a shop handle to an authorized token.
- Add a public audit fallback for prospects who have not installed the app.
- Add minimal dashboard status/install UX for customers to start and verify authorization.
- Define the first writable SEO operations as explicit, auditable vertical slices.

## Impact

- Affected specs: `shopline-oauth-saas`
- Affected systems: OAuth routes, SHOPLINE client, website configuration, token storage, dashboard website settings, CLI commands, audit/report generation, 1Password operational runbooks.
- Security impact: introduces customer SHOPLINE tokens; must use encrypted storage, RLS/service-role boundaries, non-secret logging, and least-privilege SHOPLINE scopes.
