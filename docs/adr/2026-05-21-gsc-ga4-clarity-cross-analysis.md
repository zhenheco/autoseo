# ADR: GSC / GA4 / Clarity Cross-Analysis Audit Rules

## Status

PROPOSED

## Context

1wayseo already has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` for Google Drive. GSC and GA4 can use the same Google account, but they need additional OAuth scopes:

- GSC: `https://www.googleapis.com/auth/webmasters.readonly`
- GA4: `https://www.googleapis.com/auth/analytics.readonly`

Clarity is a Microsoft product and requires a separate OAuth/API access flow.

The sibling `edgeseo` repository already has `src/lib/gsc/` and `src/lib/ga4/` modules. A subtree merge is still the long-term direction, but this PR intentionally does not merge that code so the current sprint scope stays limited to audit rule stubs and dependency injection.

## Decision

Add three audit cross-analysis rules behind injected metric fetchers:

- `gsc.low-ctr-high-impression`
- `clarity.scroll-depth-low`
- `ga4.conversion-page-no-cta`

The audit package accepts optional GSC, GA4, and Clarity inputs. Runtime API calls are not implemented in this PR; callers must inject mocked or future production fetchers.

## Action Items

Owner manual HITL steps:

1. Google Cloud Console: add GSC and GA4 scopes to the existing OAuth client.
2. Add redirect URI: `https://1wayseo.com/api/oauth/google/callback`.
3. Microsoft Clarity: apply for API access at <https://clarity.microsoft.com/api> and wait for Microsoft approval.
4. Set up `CLARITY_API_TOKEN` in the environment secret store.

## Consequences

- Audit cross-analysis can be tested AFK through dependency injection.
- No real GSC, GA4, or Clarity API calls are made by this PR.
- No `edgeseo` subtree merge is performed in this PR.
