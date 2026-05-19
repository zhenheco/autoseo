PRD implementation is complete in the working tree.

Implemented:

- Article job intake/generation modules for single and batch generation.
- Core article route JSON safety for malformed and empty bodies.
- Standard route auth shell coverage across app API routes; no legacy `withAuth` / `withCompany` / `withAdmin` wrappers remain under `src/app/api`.
- Pipeline state decisions for resume, cancellation checkpoints, cached generated article idempotency, and unknown phase fail-closed behavior.
- Scheduled publishing target adapters and post-publish effects.
- Company scope helpers and scoped translation/GSC access.
- Safe JSON parsing for Google OAuth, payment creation, promo validation, public auth, blog views, consent, companies, admin mutations, website mutations, revalidate, callback/telemetry, affiliate, and sitemap routes.
- AI provider fallback policy module with independent tests.
- Concurrent article quota reservation pressure protection.

Verification:

- `pnpm run type-check` passed.
- `pnpm run test:run` passed: 98 files / 636 tests.
- `git diff --check` passed.
- `rg "with(Auth|Company|Admin)\\(" src/app/api -n` returned no matches.

Local audit artifacts:

- `docs/agents/issue-drafts/2026-05-19-prd-16-child-issues.md`
- `docs/agents/issue-drafts/2026-05-19-prd-16-completion-audit.md`

Note: the original child issue split was useful during implementation, but those child issues should not be opened now unless we want historical tracking tickets, because the work is already implemented.
