# Draft Child Issues for #16

Parent: https://github.com/zhenheco/autoseo/issues/16

Status: draft only. Do not publish until the maintainer approves the split.

Labels for publish: `enhancement`, `technical-debt`, `ready-for-agent`

## Publish Order

1. Route shell and JSON safety slices
2. Article job intake slices
3. Pipeline state slices
4. Publishing target/effects slices
5. Service-role/public-read slices
6. AI fallback policy slices

## Current Draft Status

Do not blindly publish every row below. Several slices have already been implemented while hardening the PRD.

| Issue | Status                      | Publish guidance                                                                                                                                |
| ----- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-10  | Implemented                 | Publish only if maintainer wants tracking/closeout issues.                                                                                      |
| 11    | Implemented                 | Concurrent quota pressure test added for article reservations.                                                                                  |
| 12    | Implemented                 | Publish only if maintainer wants tracking/closeout issues.                                                                                      |
| 13-15 | Implemented                 | Phase resume, cancellation checkpoints, and cached generated article idempotency are covered in pipeline state tests.                           |
| 16-31 | Implemented                 | Publish only if maintainer wants tracking/closeout issues.                                                                                      |
| 32    | Implemented                 | Website JSON safety and explicit standard route-shell migration are implemented.                                                                |
| 33    | Implemented                 | Company create JSON safety plus token/company route-shell migration are implemented.                                                            |
| 34    | Implemented                 | Company preferences JSON safety plus stats/company-preferences route-shell classification are implemented.                                      |
| 35    | Implemented for live routes | Live integration mutations now use safe JSON or preserve optional-body behavior through `safeJson`; disabled refund code remains commented out. |
| 36    | Blocked                     | Requires maintainer approval before publishing child issues.                                                                                    |

## 1. Standardize Malformed JSON Handling for Core Article POST Routes

Type: AFK

Blocked by: None

User stories covered: 4, 14, 15, 20, 21, 22

### What to build

Make core article POST/PATCH routes return a consistent 400 response for malformed JSON instead of leaking parser failures or route-specific shapes.

### Acceptance criteria

- [ ] Malformed JSON on article generation returns 400 with the standard API error shape.
- [ ] Malformed JSON on title generation and preview-title routes returns 400 with the standard API error shape.
- [ ] Malformed JSON on article management update/publish/schedule routes returns 400 with the standard API error shape.
- [ ] Existing valid article requests keep current behavior.
- [ ] Add route tests that fail before the fix and pass after it.

## 2. Standardize Missing Body Handling for Core Article POST Routes

Type: AFK

Blocked by: Issue 1

User stories covered: 4, 14, 15, 20, 21, 22

### What to build

Make empty or missing JSON request bodies fail consistently on core article POST routes with a client error and actionable response body.

### Acceptance criteria

- [ ] Empty request body on single generation returns a 400-level response.
- [ ] Empty request body on batch generation returns a 400-level response.
- [ ] Empty request body on title generation returns a 400-level response.
- [ ] Empty request body on scheduling/publishing mutation routes returns a 400-level response.
- [ ] Tests cover both empty body and malformed body as separate cases.

## 3. Standardize Schema Validation Errors for Article Generation Input

Type: AFK

Blocked by: Issue 1

User stories covered: 4, 14, 16, 20, 21, 22

### What to build

Route all article generation validation failures through a single schema validation response format, preserving existing user-visible validation semantics.

### Acceptance criteria

- [ ] Invalid single-generation payload returns standard validation details.
- [ ] Invalid batch-generation payload returns standard validation details.
- [ ] Validation logic lives outside route handlers.
- [ ] Tests assert response status and useful error details.

## 4. Convert Core Article Routes to Explicit Auth Modes

Type: AFK

Blocked by: None

User stories covered: 12, 14, 20, 21, 22

### What to build

Make article generation, management, status, and job routes declare their auth requirements through the standard route shell.

### Acceptance criteria

- [ ] Single and batch generation routes declare company-scoped or authenticated mode explicitly.
- [ ] Article management routes declare company-scoped mode explicitly.
- [ ] Article status routes declare their intended public, authenticated, or company-scoped access explicitly.
- [ ] Tests classify each core article route by expected auth mode.
- [ ] Existing authorized requests keep current behavior.

## 5. Add Article Job Intake Happy Path for Single Generation

Type: AFK

Blocked by: Issues 1, 3, 4

User stories covered: 1, 2, 4, 16, 21, 22

### What to build

Move the single article generation path behind the Article Job Intake module so the route normalizes input and delegates account, company, website, quota, job creation, and dispatch behavior.

### Acceptance criteria

- [ ] Single generation route delegates job creation to the intake module.
- [ ] Intake result includes created job state and dispatch state.
- [ ] Existing successful single generation response shape is preserved.
- [ ] Module tests cover the single-generation happy path.

## 6. Add Article Job Intake Happy Path for Batch Generation

Type: AFK

Blocked by: Issue 5

User stories covered: 1, 2, 4, 16, 21, 22

### What to build

Route batch article generation through the same Article Job Intake module used by single generation.

### Acceptance criteria

- [ ] Batch generation route delegates normalized items to the intake module.
- [ ] Intake result reports created, skipped, failed, and dispatched items.
- [ ] Existing successful batch generation response shape is preserved.
- [ ] Module tests cover multi-item batch generation.

## 7. Detect Duplicate Pending Jobs in Article Job Intake

Type: AFK

Blocked by: Issues 5, 6

User stories covered: 3, 16, 21, 22

### What to build

Centralize duplicate pending article job detection so repeated clicks or repeated imports do not create duplicate pending work.

### Acceptance criteria

- [ ] Duplicate detection runs in the intake module for single and batch flows.
- [ ] Duplicate jobs are reported as skipped or existing, matching current product behavior.
- [ ] Duplicate detection does not block distinct generation requests.
- [ ] Tests cover duplicate single and duplicate batch input.

## 8. Block Job Creation When Quota Is Insufficient

Type: AFK

Blocked by: Issues 5, 6

User stories covered: 2, 16, 21, 22

### What to build

Ensure Article Job Intake checks quota before creating eligible jobs and returns a clear failure when quota is insufficient.

### Acceptance criteria

- [ ] Insufficient quota prevents new job creation.
- [ ] Response identifies quota failure without exposing internal service details.
- [ ] Batch flow can create eligible items and fail only over-quota items where existing behavior allows partial success.
- [ ] Tests cover insufficient quota for single and batch paths.

## 9. Treat Quota Reservation and Job Creation as One External Behavior

Type: AFK

Blocked by: Issue 8

User stories covered: 2, 16, 21, 22

### What to build

Make quota reservation failure prevent jobs from becoming eligible for background processing.

### Acceptance criteria

- [ ] Reservation failure does not leave an eligible pending job.
- [ ] Failure result is visible to the caller.
- [ ] Tests cover reservation service failure after validation.
- [ ] Existing successful reservation behavior remains unchanged.

## 10. Preserve Recoverable State When Background Dispatch Fails

Type: AFK

Blocked by: Issue 9

User stories covered: 1, 2, 16, 21, 22

### What to build

If job creation succeeds but non-blocking dispatch fails, return a recoverable state so scheduled/background workers can still pick up the job.

### Acceptance criteria

- [ ] Dispatch failure does not turn created jobs into lost work.
- [ ] Intake result exposes dispatch failure separately from creation failure.
- [ ] Route response preserves existing behavior where dispatch is best effort.
- [ ] Tests cover dispatch failure.

## 11. Add Concurrent Quota Pressure Test for Intake

Type: AFK

Blocked by: Issue 9

User stories covered: 2, 16, 21, 22

### What to build

Add a focused test for concurrent or near-concurrent quota reservation pressure at the intake module boundary.

### Acceptance criteria

- [ ] Test simulates two intake attempts competing for limited quota.
- [ ] At most the allowed number of jobs become eligible.
- [ ] Failure path is deterministic and observable.
- [ ] No production behavior changes unless needed to satisfy the test.

## 12. Extract Pipeline State Decisions from Article Processing

Type: AFK

Blocked by: None

User stories covered: 5, 6, 18, 21, 22

### What to build

Move start/resume/stop/retry decisions into a typed pipeline state module so orchestration coordinates work but does not own all state policy.

### Acceptance criteria

- [ ] Pipeline state module returns typed decisions for clean start and resume.
- [ ] Orchestrator or cron processing uses the module for phase decisions.
- [ ] Tests cover clean start and at least one resumed phase.
- [ ] Existing article processing behavior is preserved.

## 13. Cover Resume From Each Saved Pipeline Phase

Type: AFK

Blocked by: Issue 12

User stories covered: 5, 18, 21, 22

### What to build

Add tests and state decisions for resuming from each persisted article pipeline phase.

### Acceptance criteria

- [ ] Each saved phase maps to the correct next action.
- [ ] Unknown saved phase fails clearly without running the orchestrator.
- [ ] Tests are module-level or narrow cron-level tests.
- [ ] Existing valid saved phase behavior is preserved.

## 14. Add Cancellation Checkpoint Decisions to Pipeline State

Type: AFK

Blocked by: Issue 12

User stories covered: 6, 18, 21, 22

### What to build

Make cancellation checkpoints explicit in the pipeline state module so long-running generation can stop at safe boundaries.

### Acceptance criteria

- [ ] Cancelled jobs produce a stop decision at phase checkpoints.
- [ ] Non-cancelled jobs continue normally.
- [ ] Tests cover cancellation before and during multi-step generation.
- [ ] Existing cancellation response behavior is preserved.

## 15. Preserve Saved Article Idempotency in Pipeline State

Type: AFK

Blocked by: Issue 12

User stories covered: 5, 18, 21, 22

### What to build

Ensure jobs that already have saved article output do not duplicate articles or charges when retried or resumed.

### Acceptance criteria

- [ ] Pipeline state can return a cached-output or already-complete decision.
- [ ] Processing path respects that decision.
- [ ] Tests cover retry/resume with existing saved article id.
- [ ] No duplicate article creation occurs in the covered path.

## 16. Split Scheduled Publishing Into Target Adapters

Type: AFK

Blocked by: None

User stories covered: 7, 8, 9, 17, 21, 22

### What to build

Place Platform Blog, WordPress, and webhook publishing behind a common Publishing Target interface.

### Acceptance criteria

- [ ] Scheduled publishing route delegates target-specific work to adapters.
- [ ] Platform Blog adapter has a success test.
- [ ] WordPress adapter has a success test.
- [ ] Webhook adapter has a success test.
- [ ] Existing route response shape is preserved.

## 17. Add WordPress Draft Publish Adapter Coverage

Type: AFK

Blocked by: Issue 16

User stories covered: 7, 17, 21, 22

### What to build

Cover the path where a scheduled article updates an existing WordPress draft to published state.

### Acceptance criteria

- [ ] Existing draft publish uses the WordPress draft adapter.
- [ ] Test verifies the adapter receives draft identifiers and returns success.
- [ ] Route-level test verifies scheduled publishing uses this path.
- [ ] Existing draft publish behavior is preserved.

## 18. Add WordPress New Post Adapter Coverage

Type: AFK

Blocked by: Issue 16

User stories covered: 7, 17, 21, 22

### What to build

Cover the path where a scheduled article creates a new WordPress post.

### Acceptance criteria

- [ ] New WordPress post publish uses the WordPress new-post adapter.
- [ ] Test verifies title/content/status mapping.
- [ ] Route-level test verifies scheduled publishing uses this path.
- [ ] Existing new-post behavior is preserved.

## 19. Add External Webhook Publish Adapter Coverage

Type: AFK

Blocked by: Issue 16

User stories covered: 7, 17, 21, 22

### What to build

Cover scheduled publishing to external website webhook targets behind the publishing adapter contract.

### Acceptance criteria

- [ ] External website publish uses the webhook adapter.
- [ ] Test covers successful webhook sync.
- [ ] Failure path returns a publish failure contract.
- [ ] Existing external publish behavior is preserved.

## 20. Standardize Transient Scheduled Publish Failure Retry

Type: AFK

Blocked by: Issue 16

User stories covered: 8, 9, 17, 21, 22

### What to build

Make retryable scheduled publish failures update state consistently across target adapters.

### Acceptance criteria

- [ ] Retryable adapter failure increments retry state or schedules retry per current behavior.
- [ ] Permanent adapter failure does not retry indefinitely.
- [ ] Tests cover transient and permanent failures.
- [ ] Route summary reports published, retried, and failed counts correctly.

## 21. Run Post-Publish Effects Only After Publish Success

Type: AFK

Blocked by: Issues 16, 20

User stories covered: 10, 11, 17, 21, 22

### What to build

Move translation, sync, sitemap revalidation, and search engine ping behind post-publish effects that only run after successful publishing.

### Acceptance criteria

- [ ] Effects do not run when publish adapter fails.
- [ ] Translation/sync effects run after success where enabled.
- [ ] Sitemap/ping effects run after success where enabled.
- [ ] Tests verify effect ordering and failure gating.

## 22. Convert Blog Public Routes to Explicit Public-Read Mode

Type: AFK

Blocked by: None

User stories covered: 12, 13, 20, 21, 22

### What to build

Mark public blog reads as public-read at the route interface and keep privileged access separate.

### Acceptance criteria

- [ ] Blog article list and slug routes use explicit public-read mode.
- [ ] Blog category and tag routes use explicit public-read mode.
- [ ] Blog view tracking is explicitly public where intended.
- [ ] Tests classify public-read blog routes.

## 23. Add Company Scope Helper for Service-Role Reads

Type: AFK

Blocked by: None

User stories covered: 12, 13, 20, 21, 22

### What to build

Create a company scope helper that resolves user/company membership before service-role access performs company data operations.

### Acceptance criteria

- [ ] Helper requires a user and company context for scoped operations.
- [ ] Missing company id fails closed.
- [ ] Cross-company request fails closed.
- [ ] Tests cover allowed and denied scope resolution.

## 24. Apply Company Scope to Translation Routes

Type: AFK

Blocked by: Issue 23

User stories covered: 12, 14, 20, 21, 22

### What to build

Make translation settings and article translation routes use company-scoped service-role access.

### Acceptance criteria

- [ ] Translation routes declare authenticated mode.
- [ ] Translation service-role queries are constrained by resolved company scope.
- [ ] Cross-company access is denied or returns no privileged data.
- [ ] Tests cover route auth and company scope behavior.

## 25. Apply Company Scope to Google Search Console Token Access

Type: AFK

Blocked by: Issue 23

User stories covered: 12, 14, 20, 21, 22

### What to build

Ensure Google Search Console token lookup is constrained by the requesting company.

### Acceptance criteria

- [ ] GSC performance, queries, and sites routes declare authenticated mode.
- [ ] Token lookup accepts and enforces company id.
- [ ] Tests cover company-scoped token access.
- [ ] Existing authorized GSC requests keep current behavior.

## 26. Convert Payment Creation Routes to Explicit Auth Mode

Type: AFK

Blocked by: None

User stories covered: 14, 20, 21, 22

### What to build

Make payment creation routes declare authenticated mode through the standard route shell while preserving existing payment payload behavior.

### Acceptance criteria

- [ ] One-time payment create route requires authenticated user.
- [ ] Recurring payment create route requires authenticated user.
- [ ] Unauthorized requests return standard auth error shape.
- [ ] Existing valid payment creation tests remain green.

## 27. Convert Admin Operation Routes to Explicit Admin Mode

Type: AFK

Blocked by: None

User stories covered: 12, 14, 20, 21, 22

### What to build

Make admin logs, promo code, refund, and subscription routes use explicit admin route shell mode.

### Acceptance criteria

- [ ] Admin routes deny non-admin users through the route shell.
- [ ] Admin routes still receive an admin client when authorized.
- [ ] Tests classify representative admin routes.
- [ ] Existing admin route behavior is preserved.

## 28. Convert AI Model Listing and Mutation Routes to Explicit Modes

Type: AFK

Blocked by: None

User stories covered: 14, 20, 21, 22

### What to build

Make AI model list routes explicit public-read where intended and model mutation routes authenticated.

### Acceptance criteria

- [ ] AI model GET/list routes declare public-read or intended access mode.
- [ ] AI model POST/PATCH routes declare authenticated mode.
- [ ] Tests cover route classification and unauthorized mutation.
- [ ] Existing model list behavior remains available.

## 29. Extract AI Provider Fallback Policy Module

Type: AFK

Blocked by: None

User stories covered: 19, 21, 22

### What to build

Move model tier detection, provider detection, fallback chain lookup, next-model selection, and retryable error classification into a standalone module.

### Acceptance criteria

- [ ] Fallback policy module exposes pure functions for tier, provider, chain, next model, and retryable errors.
- [ ] APIRouter uses the shared fallback policy.
- [ ] Tests cover complex/simple tier classification.
- [ ] Tests cover DeepSeek, OpenAI, OpenRouter, Perplexity, and Gemini provider detection.
- [ ] Tests cover retryable and non-retryable errors.

## 30. Preserve APIRouter Public Provider Detection API

Type: AFK

Blocked by: Issue 29

User stories covered: 19, 21, 22

### What to build

Keep the existing exported provider detection helper available while delegating implementation to the shared fallback policy.

### Acceptance criteria

- [ ] Existing APIRouter exports remain source-compatible.
- [ ] The exported helper returns the same results as the policy module.
- [ ] Tests cover `anthropic/*` and `google/*` as OpenRouter model ids.
- [ ] Typecheck passes.

## 31. Add Completion Audit for PRD #16

Type: AFK

Blocked by: Issues 1-30

User stories covered: 21, 22

### What to build

Add a factual closeout audit mapping #16 requirements to implemented modules, tests, and known out-of-scope leftovers.

### Acceptance criteria

- [ ] Audit lists each #16 implementation decision and evidence.
- [ ] Audit lists each #16 testing decision and evidence.
- [ ] Audit distinguishes completed PRD scope from remaining full-codebase route cleanup.
- [ ] Audit cites the exact commands used for final verification.

## 32. Convert Website Routes to Explicit Auth Modes

Type: AFK

Blocked by: Issue 23

User stories covered: 12, 14, 20, 21, 22

### What to build

Bring website, website settings, website agent config, and external website routes into the standard route shell.

### Acceptance criteria

- [ ] Company website routes declare company-scoped mode.
- [ ] External website admin routes declare admin mode.
- [ ] JSON mutation routes use standard malformed body handling.
- [ ] Tests classify representative website routes.

## 33. Convert Token Balance and Company Routes to Explicit Auth Modes

Type: AFK

Blocked by: Issue 23

User stories covered: 12, 14, 20, 21, 22

### What to build

Bring token balance and company management routes into the standard route shell.

### Acceptance criteria

- [ ] Token balance route declares company-scoped mode.
- [ ] Company delete/create routes declare intended authenticated or company-scoped mode.
- [ ] Mutation routes use standard JSON parsing.
- [ ] Tests classify route access behavior.

## 34. Convert AI Model Stats and Company Preferences Routes

Type: AFK

Blocked by: Issue 28

User stories covered: 14, 20, 21, 22

### What to build

Bring AI model stats and company preferences routes into the standard route shell.

### Acceptance criteria

- [ ] AI model stats route declares company-scoped mode.
- [ ] Company preferences GET/POST declare company-scoped mode.
- [ ] POST route uses standard malformed JSON handling.
- [ ] Tests cover route classification and invalid body handling.

## 35. Convert Remaining Core Integration Mutations to Safe JSON

Type: AFK

Blocked by: Issue 1

User stories covered: 14, 15, 20, 21, 22

### What to build

Apply safe JSON parsing to remaining core integration mutation routes that still directly call `request.json()`.

### Acceptance criteria

- [ ] Google OAuth refresh/revoke mutation bodies use standard safe JSON handling.
- [ ] Payment, promo code, and refund mutation bodies use standard safe JSON handling where applicable.
- [ ] Blog view tracking and consent mutation bodies preserve their intended public behavior.
- [ ] Tests cover at least one route per integration group.

## 36. Publish Approved Child Issues

Type: HITL

Blocked by: Maintainer approval of this draft

User stories covered: 21, 22

### What to build

After maintainer approval, publish approved child issues to GitHub in dependency order and link them back to #16.

### Acceptance criteria

- [ ] Maintainer approves granularity and dependency order.
- [ ] Issues are published with `ready-for-agent` where AFK-ready.
- [ ] Published issues reference parent #16.
- [ ] Parent #16 remains open unless maintainer explicitly asks to close it.
