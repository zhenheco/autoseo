# Meta App Review Runbook

Issue: #93, slice P2-D2

Status: draft package prepared by Codex. Ace owns HITL recording, screenshots, copy approval, and final submission.

## Timeline

Expected review ETA: 2-8 weeks.

Check-in cadence: every 7 days until approved, rejected, or Meta requests more information.

## Submission Checklist

1. Confirm the Meta app is filed under the shared organization-level Meta App used by 1waySEO and ReplyBot.
2. Confirm production callback URL: `https://1wayseo.com/api/meta/data-deletion`.
3. Confirm production app secret is configured as `META_APP_SECRET` in the platform secret store.
4. Confirm social dashboard is deployed and reachable at `/dashboard/social`.
5. Review and edit `docs/meta-app-review/permissions.md`.
6. Review and edit `docs/meta-app-review/use-cases.md`.
7. Record the demo video using `docs/meta-app-review/demo-video-script.md`.
8. Capture all screenshot placeholders listed in `use-cases.md` and `data-deletion.md`.
9. Upload demo video and screenshots to the Meta App Dashboard permission review flow.
10. Submit requested permissions:
    - `instagram_basic`
    - `instagram_content_publish`
    - `pages_show_list`
    - `pages_manage_posts`
    - `pages_read_engagement`
    - `threads_basic`
    - `threads_content_publish`
    - `business_management`
11. Save submission date, reviewer notes, uploaded asset links, and Meta submission ID in the issue or internal tracker.

## Technical Readiness Checks

Run before submission:

```bash
pnpm --dir packages/web vitest run src/app/api/meta/data-deletion/__tests__/route.test.ts
pnpm --dir packages/web typecheck
```

Production smoke checks:

- `GET /api/meta/data-deletion?code=smoke-test` returns processed status.
- `POST /api/meta/data-deletion` rejects invalid `signed_request` with 400.
- `/dashboard/social` shows connected account cards and Disconnect controls.
- No logs expose raw tokens, app secrets, private keys, or OAuth authorization codes.

## Weekly Status Check-In

Every 7 days:

1. Open Meta App Dashboard and check review status.
2. Add a status comment to issue #93 with date, status, and any reviewer notes.
3. If Meta requested changes, copy the exact reviewer request into the issue.
4. Assign the next action owner:
   - Ace: demo video, screenshots, marketing wording, reviewer communication.
   - Codex: code change, endpoint fix, docs update, test update.
5. Re-run the data deletion route test after any endpoint changes.

## Re-Submission Criteria If Rejected

Re-submit only after all reviewer concerns are directly addressed.

Common rejection paths:

- Permission use case unclear: tighten wording in `permissions.md` and add a clearer video segment.
- Demo video does not show permission use: re-record the exact OAuth to action flow.
- Data deletion callback unavailable: verify deploy, `META_APP_SECRET`, route response shape, and production logs.
- Requested permission not used in product UI: remove the permission from this submission or add the matching in-product flow before re-submitting.
- Business asset selection unclear: add screenshots showing brand-scoped account selection and dashboard state.

Before re-submission:

1. Update docs with the revised wording.
2. Replace stale screenshots or videos.
3. Record a changelog comment in issue #93.
4. Re-run technical checks.
5. Submit with a concise note explaining exactly what changed.

## Joint Filing Strategy With ReplyBot

Use the same organization-level Meta App for 1waySEO and ReplyBot when possible.

Rationale:

- One business verification path.
- One app review history and reviewer context.
- Shared approved permission surface for Meta publishing and engagement workflows.
- Less duplicated maintenance for data deletion callback, privacy policy, terms, and business verification documents.

Guardrails:

- Keep each product's use cases clearly separated in permission narratives and demo videos.
- Do not claim ReplyBot functionality in 1waySEO screenshots unless the screen is part of the shared app flow.
- Make sure callback URLs, privacy URLs, and product URLs are stable and production accessible.
- Keep app roles and tester accounts limited to people who need review or production access.

## Post-Approval

1. Record approval date and approved permissions in issue #93.
2. Verify production OAuth with a non-admin test user.
3. Verify publish and disconnect flows.
4. Update customer-facing docs if permission wording changed during review.
5. Close issue #93 after Ace confirms the manual review package is accepted.
