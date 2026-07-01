# Environment Handoff

This legacy repo is retained for source history and cherry-picking. SEOHelp is
the active replacement, so do not create new production secrets here unless a
specific migration or incident requires it.

## Template

- App template: `packages/web/.env.example`
- Local values: copy the template to `packages/web/.env.local`
- Root-level `.env*` files are local-only operational leftovers and must not be
  committed.

## Secret Handling

- Store real values in 1Password or the target platform secret store.
- Keep `op://...` references as references only; do not expand them into repo
  files, prompts, logs, or review notes.
- Before committing, run `git status` and a redacted secret scan if the change
  touched env, deployment, OAuth, payment, or token files.

## Review Continuation

- Repo-local review log: `docs/review-log.md`
- Central run: `security-reviews/2026-07-02-all-repos-30d-cutoff`
- Current unresolved gates are tracked in the central remediation queue, not in
  ad hoc local notes.
