# 1wayseo Domain Context

Source of truth for domain language used across 1wayseo. Skills (`improve-codebase-architecture`, `diagnose`, `tdd`, `triage`, `to-prd`, `to-issues`) consult this file before planning work.

> **Status:** Draft created 2026-05-21 during brainstorm v2 grill. Terms are being resolved incrementally — see open questions at the bottom.

## Glossary

### Account hierarchy

- **User** — A person who signs up. Authentication identity in `auth.users`.
- **Company** — The billing-and-data tenancy boundary. Owns subscriptions, tokens, settings. 1 user → 1+ companies (multi-tenant via `company_members`). Confirmed by existing `companies` + `company_members` tables.
- **Brand** *(NEW in v2)* — A sub-unit under a Company that owns its own voice tone, target audience, value proposition, and historical performance memory. 1 Company → 1+ Brands (Solo plan: 1; Pro plan: 5). **Not yet implemented** — proposed in brainstorm v2.

### Content production

- **Article Job** — A request to generate a single article. Created by `/api/articles/generate`, processed asynchronously by GitHub Actions cron (`scripts/process-jobs.ts`).
- **Generated Article** — The output of an Article Job. Linked to Article Job via 1:1 (UNIQUE constraint, JOIN returns object not array — see CLAUDE.md).
- **Article Translation** — A localized version of a Generated Article in one of the supported locales (en-US, ja-JP, ko-KR, de-DE, es-ES, fr-FR; zh-TW is canonical).
- **Trend Signal** *(NEW in v2)* — A topic recommendation surfaced by the daily Trends Research cron, sourced from Perplexity / GSC / Google Trends RSS. Consumed by article generation prompts when `automation_level >= 2`.

### Publishing destinations

- **Website Config** — A target where articles can be published. Three subtypes via `website_type` column:
  - **Platform Blog** — Articles published directly into 1wayseo's own `/blog` route (Supabase row update). `is_platform_blog = true`. There is exactly one Platform Blog row globally (`d3d18bd5-ebb5-4a7f-8cba-97bed4a19168`).
  - **WordPress Site** — User's own WordPress site, published via WordPress REST API. `wp_enabled = true`.
  - **External Website** — Non-WordPress site (e.g., 一手通), synced via webhook. `website_type = 'external'`, `webhook_url` set.
- **Sync Target** — Persisted intent that an Article should be propagated to a Website Config. Captured in `sync_targets` table.
- **Social Account** *(NEW in v2)* — A connected Instagram, Threads, Facebook, or X account belonging to a Brand. Stores encrypted OAuth tokens. Distinct from Website Config (which is for blog content).
- **Social Post** *(NEW in v2)* — A scheduled or published post on a Social Account. References a Generated Article as its source.

### Commerce

- **Subscription Plan** — Pricing tier (Solo / Pro). Stored in `subscription_plans`. Phase 0.5 removes the historical `free` plan.
- **Company Subscription** — Active subscription linking a Company to a Plan. Provider transitioning from PAYUNi → Stripe in Phase 1.5.
- **Trial** *(NEW in v2)* — A 7-day evaluation period with card-on-file. Created when a Stripe Checkout session completes. Becomes a Company Subscription when the first invoice is paid.
- **Invoice** *(NEW in v2)* — A Stripe-issued invoice + (for TW buyers) the corresponding Amego electronic invoice. Linked via `stripe_invoice_id`.
- **Token / Token Balance** — Internal AI-usage credit currency. Articles consume tokens via `token_usage_logs`. **Open question:** does Stripe-only subscription replace tokens entirely or coexist?
- **Article Credit** — Pre-paid article generation quota in `purchased_article_credits`. **Open question:** keep or fold into subscription quota?

### Performance & memory

- **Article Performance** *(NEW in v2)* — Daily metrics per Article per data source (GA4 / GSC / WordPress stats / social engagement). Drives self-optimization loop.
- **Brand Performance Memory** *(NEW in v2)* — Aggregated, brand-scoped performance facts (best topic category, optimal length, best publish hour). Updated weekly. Injected into article generation prompts after the 4-week cold start.

### Diagnostic

- **Audit Report** — A scheduled or on-demand SEO health check of a Website Config. Produces issues (`audit_issues`) with severity + suggested fixes. Pro-tier feature; funnels users from "discovery" (audit) into "production" (flywheel).
- **Audit Lead Inquiry** — Lead-gen entry: anonymous user submits a URL → free preview audit → email capture → upsell.

### Cross-cutting

- **AI Gateway** — Cloudflare AI Gateway proxy that all AI calls go through (DeepSeek / OpenAI / Perplexity / Gemini). Uses dual-header pattern (provider API key + `cf-aig-authorization`). See `CLAUDE.md` AI section.
- **OpenSpec Change** — A formal change proposal under `openspec/changes/<id>/`. Used for new capabilities, breaking changes, architecture shifts, security-sensitive flows.
- **Locale** — One of the 7 supported language codes. zh-TW is the canonical base; the other 6 are translations.

## Hierarchical relationships (proposed v2)

```
User
  └── Company (tenancy / billing)
        ├── Brand* (NEW: 1+, voice/audience/memory)
        │     ├── Brand Keywords[]
        │     ├── Social Account[]
        │     └── Brand Performance Memory{}
        ├── Website Config[] (Platform Blog | WordPress | External)
        ├── Company Subscription (Plan, via Stripe)
        ├── Trial (if pre-conversion)
        ├── Token Balance (open: keep or retire)
        └── Article Job → Generated Article → {
              ├── Article Translation[] (6 locales)
              ├── Sync Target[] → Website Config
              ├── Social Post[] → Social Account
              └── Article Performance[] (daily metrics)
            }
```

## Open Questions (grill in progress)

1. ~~**Brand placement**~~ — **Resolved 2026-05-21**: Brand is a sub-unit of Company. Company owns billing + multi-member access; Brand owns voice/audience/social/memory. Solo plan = 1 brand cap, Pro = 5.
2. ~~**Brand × Website Config cardinality**~~ — **Resolved 2026-05-21**: 1 Brand → many Websites (cross-domain / cross-language). `brand_voice` migrates from `website_configs` up to `brands` table. Websites become pure "publishing channels". Pro plan quota: 5 brands × 3 websites/brand = 15 websites/account max.
3. ~~**Token system retirement**~~ — **Resolved 2026-05-21**: User-facing quota is article-count per plan (Solo 30/mo, Pro 200/mo). `token_usage_logs` retained as internal cost telemetry — not exposed in UI. `token_packages` / `purchased_article_credits` UI deprecated (table kept for historical data integrity).
4. ~~**Article Credit retention**~~ — **Resolved 2026-05-21**: Not retained as user-facing add-on. Upsell path is plan upgrade only when quota exceeded.
5. ~~**PAYUNi tables full retirement**~~ — **Resolved 2026-05-21**: Drop all four (`payment_orders` / `recurring_mandates` / `recurring_payments` / `refund_requests`) in Phase 0.5. Rebuild Stripe-native schema in Phase 1.5: `trials`, `invoices`, `stripe_events`, `refunds`.
6. ~~**Referral system fate**~~ — **Resolved 2026-05-21**: Drop `company_referral_codes` / `referral_codes` / `referral_token_rewards` / `referral_rewards` in Phase 0.5. Use Stripe Coupons for early-adopter promos ("first 100 users 50% off"). Referral feature deferred to Phase 3+.
7. ~~**Shopline integration**~~ — **Resolved 2026-05-21**: Shopline is a *publishing channel* for 1wayseo Brands (like WordPress / Platform Blog / External). `shopline_*` tables are channel-specific extensions. `website_configs.website_type` enum gains `shopline`. Brand → Website → Shopline shop. Shopline App Store review (GDPR webhooks, embedded admin) remains active and unchanged by Phase 0.5 cleanup. **Sub-question deferred:** what surface of a Shopline shop is the article published into (Shopline blog module? collection description? FAQ?) — answer during Phase 2 design.
8. ~~**Audit feature**~~ — **Resolved 2026-05-21**: Audit stays as lead-gen + Pro-tier feature. Phase 2 dashboard includes audit entry point. Pro plan grants full audit (with fix recommendations); Solo plan may have limited audit (read-only report). Funnel: Audit discovers SEO gaps → Flywheel generates articles to fill them.
9. **`generated_articles.brand_id` migration** — **Pending**: Add `brand_id` column. Backfill = for each existing company, auto-create a default brand and assign all that company's articles to it. **Caveat (2026-05-21):** real customers exist with article history — backfill must preserve all `generated_articles` rows.
10. ~~**Fresh-start interpretation**~~ — **Resolved 2026-05-21**: Customers exist with published articles. DB cannot be reset. All cleanup migrations must preserve content data (`generated_articles`, `article_jobs`, `article_translations`, `article_views`).

11. **Subscription state inventory (NEW)** — How many active free-plan users? Any active PAYUNi recurring mandates? If yes, Phase 1.5 needs migration plan instead of clean rebuild. Phase 0.5 needs the free-user downgrade flow brought back. Need to query DB before Phase 0.5 starts.
