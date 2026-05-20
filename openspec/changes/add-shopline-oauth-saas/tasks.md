## 1. Foundation

- [x] Create encrypted customer SHOPLINE connection storage with company/website ownership and RLS-safe access. (migration `20260518000000_shopline_connections.sql` — pgsodium `api_keys` key via `encrypt_data/decrypt_data`; company_members RLS; service_role-only writes.)
- [x] Persist OAuth callback tokens server-side without printing or returning token values.
- [x] Add connection status API and dashboard status surface.
- [x] Add tests for state validation, HMAC validation, token persistence, and ownership checks.

## 2. Customer Authorization

- [x] Add dashboard flow to collect shop handle and generate a customer install link.
- [x] Add post-callback success/error UX that confirms connected shop and granted scopes.
- [ ] Document exact customer-facing permission language.
- [ ] Verify production install flow against a real SHOPLINE test store. (Requires real merchant store credentials; blocked on customer onboarding, not on code.)

## 3. CLI Shared Operations

- [x] Add CLI token resolution by shop handle from SaaS storage or 1Password fallback. (`src/lib/shopline/cli-auth.ts` resolves via `--company-id`/`--website-id` against encrypted `shopline_connections`, with env fallback `SHOPLINE_SHOP_HANDLE` + `SHOPLINE_ACCESS_TOKEN`.)
- [x] Add `shopline products` and `shopline audit` commands that use shared operation modules. (`scripts/shopline-cli.ts`: `products`, `check`, `seo-update`, `install-url`, `exchange-code`. Public-audit subcommand still pending — covered by section 5.)
- [x] Add dry-run/apply structure for future write commands. (Covered by deep modules `shopline-seo-updater` / `shopline-product-categorizer` audit-graceful pattern; CLI propagates `source: 'cli'` to operation log.)
- [x] Add tests using real SHOPLINE payload fixtures. (`scripts/__tests__/shopline-cli.test.ts` + `src/lib/shopline/__tests__/*.test.ts` — 136 tests pass.)

## 4. SEO Read/Write Slices

- [x] Implement product SEO read and export. (`ShoplineClient.getProduct` + `listProducts`; CLI `products` command.)
- [x] Implement product SEO title/description update with dry-run and apply. (`shopline-seo-updater` deep module + `/api/shopline/[websiteId]/products/[productId]/seo` PATCH route; CLI `seo-update` parity.)
- [x] Implement page/content SEO read and export. (`shopline-shop-meta-service` + `/api/shopline/[websiteId]/shop-meta` GET; collections covered by `shopline-collection-fetcher`.)
- [x] Implement page/content SEO update with dry-run and apply. (`/api/shopline/[websiteId]/shop-meta` PUT + collection SEO PATCH routes through deep modules.)
- [x] Add operation logs that record actor, store, target resource, mode, result, and timestamp without secrets. (`shopline_seo_audit_log` table + `source: 'ui'|'cli'|'ai'` propagated by all PATCH routes; tokens never logged.)

## 5. Public Audit Fallback

- [ ] Add public store audit from URL/sitemap without authorization.
- [ ] Generate prospect-ready audit output that identifies gaps without requiring app install.
- [ ] Add CTA from audit output to SHOPLINE app authorization.
