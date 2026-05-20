# Tasks

All tasks completed prior to spec proposal authoring (post-hoc documentation). Spec retroactively captures shipped capability.

## 1. Foundations

- [x] 1.1 Add `shopline_seo_audit_log` table + RLS (`company_members` scoped; admin policy patched to use `company_members.role`)
- [x] 1.2 Add `shopline_redirects` table + RLS
- [x] 1.3 Add `shopline_collection_hierarchy` table + RLS
- [x] 1.4 Add `shopline_shop_meta` table + RLS
- [x] 1.5 Apply all four migrations to prod Supabase

## 2. Deep modules

- [x] 2.1 `shopline-product-fetcher`, `shopline-seo-updater` (audit-graceful)
- [x] 2.2 `shopline-collection-fetcher`, `shopline-collection-seo-updater`
- [x] 2.3 `shopline-image-alt-updater`
- [x] 2.4 `shopline-product-categorizer`
- [x] 2.5 `shopline-redirect-store`
- [x] 2.6 `shopline-collection-hierarchy-service`
- [x] 2.7 `shopline-shop-meta-service` + `seo-template` render
- [x] 2.8 `shopline-ai-seo-generator` + callModel adapter
- [x] 2.9 `shopline-connection-scope-guard`
- [x] 2.10 `shopline-write-rate-limiter` (CF KV sliding window)
- [x] 2.11 `shopline-seo-health-evaluator`

## 3. ShoplineClient methods

- [x] 3.1 `updateProduct` (SEO + handle + title)
- [x] 3.2 `updateProductImage` (alt text)
- [x] 3.3 `assignProductToCollection` / `removeProductFromCollection` / `listProductCollects`
- [x] 3.4 `listCollections` / `updateCollection` / `getCollection`
- [x] 3.5 `getProduct`
- [x] 3.6 `reorderCollectionProducts`
- [x] 3.7 `getShop` / `updateShop`

## 4. API routes (all `withRouteAuth("company")` + `safeJson` + scope guard + rate limit + audit)

- [x] 4.1 GET / PATCH products + SEO routes
- [x] 4.2 PATCH product image alt
- [x] 4.3 PATCH product categories
- [x] 4.4 GET / PATCH collections + SEO routes
- [x] 4.5 PATCH collection hierarchy + product order
- [x] 4.6 GET / PUT shop-meta
- [x] 4.7 GET / POST / DELETE redirects
- [x] 4.8 POST ai-seo (draft only, no write side effects)
- [x] 4.9 GET health-summary (KV 5 min cache)
- [x] 4.10 PATCH routes accept `source: 'ui'|'cli'|'ai'` + `model`

## 5. Dashboard UI

- [x] 5.1 `/dashboard/websites/[id]/shopline` tabs (Products / Collections / Shop / Redirects)
- [x] 5.2 Edit modals with SEO meta + image alt + categories sub-tabs
- [x] 5.3 Collections tree view + product reorder
- [x] 5.4 Shop panel with title-template variable chips
- [x] 5.5 Health summary card + list filter dropdown
- [x] 5.6 AI draft button on each editable field
- [x] 5.7 Scope-missing reauthorize CTA + rate-limit toast
- [x] 5.8 Pagination cursor stack on Products list
- [x] 5.9 `/dashboard/websites` card "SEO 編輯" button when SHOPLINE connected

## 6. CLI parity

- [x] 6.1 `shopline-cli seo-update` migrated to `shopline-seo-updater` deep module to keep UI/CLI parity

## 7. i18n

- [x] 7.1 zh-TW base keys for all SEO surfaces
- [x] 7.2 en-US translations (professional SEO/e-commerce vocabulary)
- [x] 7.3 ja-JP translations (敬体)

## 8. Verification

- [x] 8.1 894 unit tests passing
- [x] 8.2 `pnpm type-check` green
- [x] 8.3 `pnpm build` green
- [x] 8.4 `node scripts/check-translations.js` green for all locales
- [x] 8.5 Prod deployment to https://1wayseo.com
