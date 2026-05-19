## 1. Foundation

- [ ] Create encrypted customer SHOPLINE connection storage with company/website ownership and RLS-safe access.
- [x] Persist OAuth callback tokens server-side without printing or returning token values.
- [x] Add connection status API and dashboard status surface.
- [x] Add tests for state validation, HMAC validation, token persistence, and ownership checks.

## 2. Customer Authorization

- [x] Add dashboard flow to collect shop handle and generate a customer install link.
- [x] Add post-callback success/error UX that confirms connected shop and granted scopes.
- [ ] Document exact customer-facing permission language.
- [ ] Verify production install flow against a real SHOPLINE test store.

## 3. CLI Shared Operations

- [ ] Add CLI token resolution by shop handle from SaaS storage or 1Password fallback.
- [ ] Add `shopline products` and `shopline audit` commands that use shared operation modules.
- [ ] Add dry-run/apply structure for future write commands.
- [ ] Add tests using real SHOPLINE payload fixtures.

## 4. SEO Read/Write Slices

- [ ] Implement product SEO read and export.
- [ ] Implement product SEO title/description update with dry-run and apply.
- [ ] Implement page/content SEO read and export.
- [ ] Implement page/content SEO update with dry-run and apply.
- [ ] Add operation logs that record actor, store, target resource, mode, result, and timestamp without secrets.

## 5. Public Audit Fallback

- [ ] Add public store audit from URL/sitemap without authorization.
- [ ] Generate prospect-ready audit output that identifies gaps without requiring app install.
- [ ] Add CTA from audit output to SHOPLINE app authorization.
