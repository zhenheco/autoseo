# PRD: SHOPLINE OAuth Authorization And SaaS Operations

## Problem Statement

SHOPLINE merchants usually will not share admin accounts, passwords, or manually generated private app tokens. Even editor access can take too long to obtain. 1waySEO needs a trust-minimized path where a customer can authorize SEO access by clicking an install link, while operators can still use CLI workflows immediately and the product can grow into a full SaaS experience later.

## Solution

Build SHOPLINE as a customer-authorized integration. Prospects can start with a public audit that requires only a store URL. Customers who want 1waySEO to apply changes authorize a dedicated 1wayseo SHOPLINE app through an install link. The callback stores the token server-side, tied to the customer company and website. CLI and future SaaS UI operations both use the same connection and SHOPLINE operation layer.

The private app token path remains available only for internal testing and trusted assisted service cases.

## User Stories

1. As a merchant, I want an SEO audit without granting access, so that I can evaluate 1waySEO before installing anything.
2. As a merchant, I want to authorize 1waySEO without sharing my SHOPLINE password, so that I can keep account ownership safe.
3. As a merchant, I want to approve a specific SHOPLINE app permission screen, so that I understand what access I am granting.
4. As a merchant, I want assurance that orders, customers, payments, checkout, carts, discounts, and inventory are not required, so that the SEO workflow feels low risk.
5. As a merchant, I want to see whether my store is connected, so that I know if 1waySEO can make changes.
6. As a merchant, I want reconnect instructions when authorization fails or expires, so that I can restore service without contacting support.
7. As a 1waySEO operator, I want to generate an install link from a shop handle, so that I can guide a customer through authorization quickly.
8. As a 1waySEO operator, I want callback tokens stored automatically, so that I do not handle raw access tokens manually.
9. As a 1waySEO operator, I want CLI commands to resolve an authorized store token by shop handle, so that I can run assisted SEO work safely.
10. As a 1waySEO operator, I want a public audit command, so that I can produce value before the customer installs the app.
11. As a 1waySEO operator, I want product SEO data exported from SHOPLINE, so that I can review titles, descriptions, handles, and gaps.
12. As a 1waySEO operator, I want page and content SEO data exported from SHOPLINE, so that I can inspect non-product SEO surfaces.
13. As a 1waySEO operator, I want dry-run previews for updates, so that I can review planned changes before writing to SHOPLINE.
14. As a 1waySEO operator, I want apply mode for approved changes, so that I can update product and page SEO efficiently.
15. As a 1waySEO operator, I want operation logs, so that I can explain what was changed and when.
16. As an admin, I want tokens encrypted and server-only, so that customer credentials do not leak through logs, browsers, issues, or CLI output.
17. As an admin, I want ownership checks on every token lookup, so that one company cannot operate another company's store.
18. As an admin, I want the SHOPLINE operation layer shared by CLI and SaaS UI, so that behavior stays consistent.
19. As a developer, I want real SHOPLINE payload fixtures in tests, so that API schema drift is caught before production.
20. As a developer, I want OAuth state and HMAC validation covered by tests, so that the install flow is not vulnerable to forged callbacks.
21. As a developer, I want the private app token fallback isolated from customer OAuth storage, so that internal shortcuts do not become the customer-facing model.
22. As a customer success user, I want a simple customer-facing authorization script, so that I can explain the request without technical language.
23. As a customer success user, I want a shareable audit report, so that I can ask for authorization only after showing concrete value.
24. As a product owner, I want the first SaaS version to prove connection, audit, and assisted operations before building a full editor UI, so that we ship the shortest useful path.

## Implementation Decisions

- Treat SHOPLINE customer OAuth as the primary production integration. Do not ask normal customers for admin accounts, passwords, or manual tokens.
- Keep private app token operation as an internal/trusted fallback stored in 1Password.
- Store customer OAuth tokens in application storage associated with company, website, shop handle, scopes, status, and verification metadata.
- Keep 1Password as source of truth for platform app secrets and internal private app tokens, not as the long-term store for every customer OAuth token.
- Build a shared SHOPLINE operation layer that exposes connection verification, product SEO reads, product SEO writes, page/content reads, page/content writes, sitemap discovery, dry-run previews, and apply operations.
- CLI commands and SaaS routes must call the shared operation layer.
- OAuth callback must validate state, nonce, shop handle, and SHOPLINE HMAC before token exchange or persistence.
- Token values must never be returned in callback responses, browser-rendered views, issue bodies, or logs.
- Public audit should work before authorization using public store URL, sitemap, and crawlable pages.
- Write operations must support dry-run before apply.
- Operation logs should record actor, company, website, shop handle, operation type, target resource, mode, result, and timestamp without secrets.
- Permission language should explicitly say that SEO work does not need order, customer, payment, checkout, cart, discount, or inventory access.

## Testing Decisions

- Tests should assert external behavior: authorization outcomes, token persistence status, access control, CLI command output, and SHOPLINE operation results.
- OAuth tests should cover valid callback, invalid state, missing nonce, HMAC failure, shop mismatch, cancellation, and token exchange failure.
- Storage tests should cover encrypted token persistence, ownership boundaries, reconnect/revoke state, and no-token response shapes.
- Operation tests should use real SHOPLINE payload fixtures, especially string IDs and nullable fields.
- CLI tests should verify that commands do not print raw secrets and can resolve tokens through the approved connection path.
- Dashboard tests should cover connection status and install-link generation behavior.
- Public audit tests should use deterministic HTML/sitemap fixtures and avoid relying on live customer stores.

## Out of Scope

- Public SHOPLINE marketplace app submission.
- Asking customers for SHOPLINE admin accounts or passwords.
- Order, customer, payment, checkout, cart, discount, or inventory workflows.
- Fully featured in-browser SEO editor for every SHOPLINE object type.
- Automated article publishing to SHOPLINE content until the connection and SEO operation foundations are stable.
- Multi-platform e-commerce integrations beyond SHOPLINE.

## Further Notes

The current production callback and install URL are already deployed on `1wayseo.com`, and the private app path has been verified against `edgeseo-test`. The next step is to turn the proven CLI/private-app behavior into a customer OAuth and SaaS connection model.

Related OpenSpec change: `add-shopline-oauth-saas`.
