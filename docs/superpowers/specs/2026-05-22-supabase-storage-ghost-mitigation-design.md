# Supabase Storage Ghost — Mitigation Design

> Date: 2026-05-22  
> Status: Brainstorm v1, awaiting user review.  
> Owner: zhenheco

## Problem

Supabase project `vdjzeregvyimgzflfalv` Settings → Usage shows the file Storage size at the 1 GB free-tier cap. Investigation:

- Exactly one bucket exists: `article-images`
- Bucket is empty per both the Supabase Dashboard UI and the JS SDK `listBuckets()` + recursive `list()` (depth 3, no items found)
- Database size is healthy: 0.298 GB / 0.5 GB cap
- Egress is healthy
- 500-article sample of `generated_articles.content` + `featured_image_url`: **zero** image references (no `<img>` tags, no Supabase Storage URLs, no external image URLs, no featured images set)

The mismatch indicates a Supabase backend accounting bug — storage usage counter has not been reclaimed after past delete operations, or `storage.objects` metadata table has bloated independently of actual S3-backend content.

Ace previously paid a hidden cost from a database migration that wasn't fully cut over, so any mitigation must avoid double-payment scenarios.

## Non-goals

- Do **not** migrate the entire database to a new Supabase project. The double-payment risk plus the Auth-user migration cost outweighs the benefit, and the underlying issue might persist on a new project if it is an account-level backend bug.
- Do **not** migrate to Cloudflare D1 as a primary database. D1 lacks Supabase Auth, RLS, JSONB, Realtime, and pg extensions that 1wayseo depends on. The earlier brainstorm-v2 PRD assumed Supabase remains the system of record.
- Do **not** upgrade to Supabase Pro purely for the storage ghost.

## Approach

Three concurrent paths, ordered by risk and cost:

### 1. Open Supabase support ticket (primary fix)

Submit a ticket using the canonical draft (see runbook). Supabase backend team triggers a storage-usage recount or reclaims orphaned chunks. Expected turnaround 1–3 days.

The user pastes the runbook draft into Supabase Dashboard → Help → Support and replies with the ticket ID. No code change required.

### 2. Feature flag for image generation (defensive, ships immediately)

Add `IMAGE_GENERATION_ENABLED` env var, default `false`. Both image agents (`FeaturedImageAgent`, `ArticleImageAgent`) short-circuit when the flag is off, returning a typed "skipped" result instead of attempting an upload that would fail against a saturated Storage quota.

Rationale:

- Past sample shows the image agents are rarely invoked, but they still execute during the orchestrator's image step (`orchestrator.ts` line ~1342). With Storage at the cap, that step would now throw on upload, potentially failing the article job.
- The flag protects the article generation pipeline regardless of Supabase's fix timeline.
- When images are later wanted, flip to `true` after migrating uploads to Cloudflare R2 (out of scope for this spec).

### 3. Runbook: ghost mitigation SOP (documentation)

`docs/runbooks/supabase-storage-ghost-ticket.md` captures:

- Canonical English support-ticket draft
- Diagnostic queries to confirm the ghost (SDK list vs Dashboard usage)
- Fallback escalation tree
- The "drop and migrate to a new Supabase project" plan as a **last-resort** option, only if support cannot resolve and the storage cap blocks essential functionality

## Components changed

### `IMAGE_GENERATION_ENABLED` feature flag

- New env var documented in `packages/web/.env.example` with `op://` reference shape if a 1Password item is later created
- Default: `false` (deny by default; admin must explicitly enable when storage cap is resolved and uploads are reliable)

### `FeaturedImageAgent` short-circuit

- At top of `execute(...)`, check `process.env.IMAGE_GENERATION_ENABLED !== "true"`
- If disabled: return `{ image: null, executionInfo: { skipped: true, reason: "feature_disabled" } }` (extend the existing return type minimally)
- Downstream orchestrator handles `featured: null` gracefully (it already tolerates absence of an image per the 500-article sample)

### `ArticleImageAgent` short-circuit

- Symmetric to `FeaturedImageAgent`: `{ images: [], executionInfo: { skipped: true, reason: "feature_disabled" } }`

### Orchestrator integration

- `executeImageGeneration(...)` already returns `imageOutput` consumed by `executeContentGeneration(...)`. With `images: []`, the content generation step omits `<img>` tags. No template change required (sample shows current articles already produce no `<img>` tags).
- Add one log line at orchestrator level: `console.log('[Orchestrator] Image generation disabled by flag, skipping')` for observability.

## Data flow

```
Article Job → Orchestrator
              ├── Strategy Agent  (no change)
              ├── Image Generation Step
              │     ├── flag check → if disabled, return null/[]
              │     └── if enabled, existing flow (upload to Supabase Storage)
              ├── Content Generation
              ├── QA / Publish steps
              └── done
```

## Testing

Three test additions to `packages/web/src/lib/agents/__tests__/`:

1. `featured-image-agent-flag.test.ts`: when `IMAGE_GENERATION_ENABLED !== "true"`, `execute()` returns the skipped sentinel without calling any underlying AI / upload function.
2. `article-image-agent-flag.test.ts`: symmetric.
3. Extend existing `orchestrator-brand-quota.test.ts` (or a new file) with a case asserting that an orchestrator run with the flag off produces an article whose `featured_image_url` is `null` and content has no `<img>` tags, and that the job completes successfully.

No e2e test needed — the change is a guarded short-circuit in two leaf agents.

## Rollout

1. Implement the flag + tests in a single PR
2. Merge to `main`; Vercel auto-deploys
3. In Vercel env (Production + Development), `IMAGE_GENERATION_ENABLED` is absent → default `false` → image generation is now safely off
4. User opens Supabase support ticket using the runbook draft
5. When Supabase confirms storage is reclaimed, do not flip the flag yet — schedule the R2 migration spec (out of scope) before re-enabling

## Fallback if Supabase support does not resolve

Documented in the runbook. Summary: open a fresh Supabase project under a new account, schema-migrate via `pg_dump`/`pg_restore`, treat Auth-user migration as the hardest sub-step (only 170 mostly-inactive companies in current data, so user-impact is small), update connection strings in Vercel + GitHub secrets + integrations, **fully cut over and delete the old project within 7 days** to avoid the double-payment lesson Ace previously learned.

This fallback is explicitly a last resort. It is documented but not part of this PR's scope.

## Out of scope

- Cloudflare R2 storage adapter (separate spec, follow-up)
- Image generation feature work (currently effectively dormant; not deleted)
- Database migration to a new project (last-resort fallback, runbook only)
- D1 migration (rejected)
