# Meta OAuth Flow Runbook

## Status

Meta OAuth is implemented behind `META_OAUTH_PUBLIC_ENABLED`. Keep it set to `false` until Meta App Review approval for issue #93 is complete. When disabled, `/api/social/meta/connect` redirects to `/dashboard/social?meta_pending_review=1`.

Required server env:

```env
META_APP_ID=op://Dev/Meta App ID/credential
META_APP_SECRET=op://Dev/Meta App Secret/credential
META_REDIRECT_URI=https://1wayseo.com/api/social/meta/callback
META_OAUTH_PUBLIC_ENABLED=false
```

## Sequence

```mermaid
sequenceDiagram
  actor User
  participant Web as 1waySEO Web
  participant Meta as Meta OAuth + Graph API
  participant DB as Supabase social_accounts

  User->>Web: GET /api/social/meta/connect?brand_id=...
  Web->>Web: Check META_OAUTH_PUBLIC_ENABLED
  Web->>Web: Generate state and httpOnly 10-minute cookies
  Web-->>User: 302 to facebook.com/v19.0/dialog/oauth
  User->>Meta: Approve requested scopes
  Meta-->>Web: GET /api/social/meta/callback?code&state
  Web->>Web: Validate state cookie
  Web->>Meta: Exchange code for short-lived user token
  Web->>Meta: Exchange short-lived token for 60-day token
  Web->>Meta: Fetch me + Pages
  loop each Page
    Web->>Meta: Fetch Page access token + instagram_business_account
  end
  Web->>Meta: Fetch Threads profile and publishing limits
  Web->>Web: Encrypt tokens with TokenCrypto
  Web->>DB: Upsert one row per brand/platform/account id
  Web-->>User: 302 /dashboard/social?connected=meta
```

## Token Lifecycle

The callback stores one `social_accounts` row per connected Facebook Page, Instagram Business account, and Threads profile. Tokens are encrypted with `SOCIAL_TOKEN_MASTER_KEY` through `TokenCrypto`.

Facebook Page rows store the Page-scoped token as `access_token_encrypted`. Instagram rows use the Page token associated with the Page that owns `instagram_business_account`. Threads rows use the long-lived user token returned by Meta. `refresh_token_encrypted` stores the long-lived user token source so the daily refresh can re-exchange it.

Meta long-lived user tokens expire in about 60 days. `/api/cron/meta-token-refresh` scans active Meta-family accounts where `token_expires_at` is within 7 days and calls `refreshMetaToken(accountId)`. The refresh re-exchanges the stored long-lived token and updates `access_token_encrypted`, `refresh_token_encrypted`, and `token_expires_at`.

## Requested Permissions

The OAuth authorize URL requests the issue #93 App Review scope set:

`instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `threads_basic`, `threads_content_publish`, `business_management`.

## Operations

After App Review approval:

1. Set `META_OAUTH_PUBLIC_ENABLED=true` in the platform Secret Store.
2. Set `NEXT_PUBLIC_META_OAUTH_PUBLIC_ENABLED=true` if dashboard UI needs to reveal Meta connect controls.
3. Run a tester OAuth flow and verify active `social_accounts` rows exist for expected Meta accounts.
4. Confirm `/api/cron/meta-token-refresh` returns `success: true` with the production cron secret.
