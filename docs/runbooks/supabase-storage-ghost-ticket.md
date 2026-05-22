# Runbook: Supabase Storage Ghost Usage

## Symptoms

- Settings → Usage → **Storage size** shows at or near the 1 GB free-tier cap
- Supabase Dashboard → **Storage** page shows no files in any bucket
- JS SDK `listBuckets()` returns expected buckets but `from(bucket).list('', { limit: 1000 })` returns 0 items at every prefix level
- Database size and Egress are well within limits

## Root cause

Storage usage counter has not been reclaimed at the Supabase backend after past `delete` operations, or the `storage.objects` metadata table has bloated independently of actual S3-backend content. This is a known class of Supabase backend issue.

## Mitigation, in order

### 1. Submit a Supabase support ticket (primary fix)

Go to: Supabase Dashboard → bottom-right **Help** → **Support** → New ticket.

Paste this draft:

```
Subject: Storage Usage shows 1 GB consumed but bucket is empty (project: vdjzeregvyimgzflfalv)

Hi Supabase team,

Project ref: vdjzeregvyimgzflfalv

I'm hitting the free-tier Storage size limit (1 GB) in Settings → Usage,
but my actual bucket content is empty:

- I have exactly one bucket: `article-images`
- Dashboard → Storage → article-images: shows no files
- Verified via SDK: `supabase.storage.from('article-images').list()` returns
  0 items at every prefix level (recursed to depth 3)
- Verified via SDK: `supabase.storage.listBuckets()` returns only this one
  bucket

So my visible content is 0 MB but the Usage page reports me at the 1 GB
limit, blocking writes / triggering upgrade prompt.

This looks like stale storage accounting — either orphaned chunks at the S3
backend that weren't reclaimed after a past delete operation, or a
storage.objects metadata bloat.

Could you:
1. Trigger a recount of the storage usage for this project?
2. If there are orphaned objects at the backend, clean them up?

I'd prefer not to drop-and-recreate the bucket if avoidable, but happy to
do so if your team confirms that won't conflict with whatever's actually
holding the bytes.

Thanks.

Project ref: vdjzeregvyimgzflfalv
Region: <fill from Settings → General>
Account email: <your Supabase login email>
```

Record the ticket ID returned by Supabase. Expected turnaround 1–3 business days.

### 2. Ship the `IMAGE_GENERATION_ENABLED` feature flag (defensive)

Independently of support ticket resolution, ensure article generation does not crash when Storage is at the cap. See spec `docs/superpowers/specs/2026-05-22-supabase-storage-ghost-mitigation-design.md`.

Once shipped, leave the flag at `false` (the default) until both:

- Supabase confirms storage is reclaimed, AND
- Image upload destination is moved to Cloudflare R2 (future work)

### 3. If support takes longer than 3 business days

Try drop-and-recreate the `article-images` bucket via Dashboard:

1. Dashboard → Storage → `article-images` → **Delete bucket**
2. Create new bucket with the same name `article-images`, same `public: true` setting
3. Wait 30 minutes, then refresh Settings → Usage to see if Storage size resets

If usage still shows 1 GB after recreate, the issue is metadata at the project level, not bucket level. Escalate to support with this finding.

### 4. Last-resort fallback: migrate to a fresh Supabase project

Only execute this if:

- Support ticket has not resolved in 7 business days, AND
- Storage cap is actually blocking a critical feature (today it is not — the image agents are gated by `IMAGE_GENERATION_ENABLED=false`)

#### Migration plan

1. Create new Supabase project under a new (or existing) account in the same region as `vdjzeregvyimgzflfalv` (likely Northeast Asia / Tokyo or Southeast Asia / Singapore; verify before creating)
2. `pg_dump` schema + data from current project's Postgres:
   ```bash
   pg_dump $OLD_SUPABASE_DB_URL --schema=public --no-owner --no-acl -f dump.sql
   ```
3. `pg_restore` (or `psql -f dump.sql`) to new project's Postgres
4. Migrate Supabase Auth users separately. Options:
   - **Preferred**: `supabase migration auth` CLI when available
   - **Manual**: export from old project's `auth.users` via Supabase Dashboard Auth Export, import to new project via Dashboard. User IDs (UUIDs) **must be preserved** so foreign keys in `companies` / `generated_articles` etc. continue to resolve. Confirm `auth.uid()` references resolve before declaring complete.
   - 1wayseo currently has 170 companies, most likely test signups. Acceptable to lose: ?  → confirm with Ace before this step.
5. Recreate storage buckets (empty) in new project. No file copy needed since the old buckets are empty.
6. Update all connection strings:
   - `packages/web/.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
   - Vercel env vars (Production + Preview + Development)
   - GitHub Actions secrets (for cron scripts)
   - Stripe webhook endpoints if they reference Supabase functions
   - Google OAuth redirect URIs in Google Cloud Console
   - Any cf-email-sdk subscriber list endpoints
   - 1Password items: rotate `Autopost Supabase` or create new item `1wayseo Supabase (post-ghost-migration)`
7. **Cut over fully within 24 hours**. Test the new project end-to-end: signup, article generation, dashboard. Monitor Sentry / Vercel logs for 24 hours.
8. **Delete the old project within 7 days** to avoid double-payment. This is the lesson from the previous migration that cost Ace money. Set a calendar reminder.

#### Migration risks summary

- Auth user IDs must match across both projects, or `generated_articles.user_id` foreign keys break
- Vercel env propagation has up to 60-second delay; coordinate with deploy window
- RLS policies travel with `pg_dump` but verify post-restore with a quick `SELECT` from each policy-protected table as service_role then as anon
- Webhook secrets must rotate, not just URL — old webhook signatures will fail validation on new project

#### Cut-over checklist

- [ ] All 170 companies' user IDs preserved post-Auth-migration
- [ ] All 2,212 generated_articles still accessible by their owner companies (sample-check 5)
- [ ] Stripe webhook arrives at new endpoint and is signed/verified successfully
- [ ] LP signup works end-to-end against new project
- [ ] Old project deleted; Supabase Dashboard shows old project removed
- [ ] Calendar reminder set for "verify old project deleted" 14 days out
