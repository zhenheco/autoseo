# X Developer Setup

This runbook configures the X OAuth 2.0 PKCE app used by
`/api/social/x/connect` and `/api/social/x/callback`.

## Register the app

1. Open the X Developer Console at `https://developer.x.com/` or
   `https://console.x.com/`.
2. Create or select the 1wayseo Project and App.
3. In App authentication settings, enable OAuth 2.0.
4. Set the app type to Web App / confidential client when available.
5. Add this callback URL exactly:

   ```text
   https://1wayseo.com/api/social/x/callback
   ```

6. Enable these OAuth 2.0 scopes:

   ```text
   tweet.read tweet.write users.read offline.access
   ```

7. Save the app settings, then open Keys and Tokens and copy the OAuth 2.0
   Client ID and Client Secret into 1Password.

## Configure secrets

The repo must only contain 1Password references or placeholders.

```env
X_CLIENT_ID=op://Dev/X OAuth Client ID/credential
X_CLIENT_SECRET=op://Dev/X OAuth Client Secret/credential
X_REDIRECT_URI=https://1wayseo.com/api/social/x/callback
SOCIAL_TOKEN_MASTER_KEY=op://Dev/1wayseo Social Token Master/credential
```

For local testing, run the app through 1Password so the `op://` references are
resolved at process start. For production, sync the values into the deployment
platform secret store.

## Verify the flow

1. Start the web app with the resolved env vars.
2. Visit `/api/social/x/connect` while signed in to 1wayseo.
3. Approve the app in X.
4. Confirm the callback redirects to `/dashboard/social?connected=x`.
5. Confirm `social_accounts` has one active row with `platform = 'x'`.
6. Confirm token fields are encrypted ciphertext, not raw X tokens.

## Pricing and limits

As of 2026-05-21, the current X docs describe API v2 billing as pay-per-use,
with pricing shown in the Developer Console. The newer docs say there are no
fixed monthly subscriptions, while older `developer.x.com` pages still list
legacy Free/Basic plan limits.

Issue #84 mentioned an older Free/Basic model: 1,500 posts/month on Free and
Basic at $100/month for production. Do not rely on those numbers for purchase
decisions. Before launch, re-check the Developer Console and X docs, then record
the active plan and posting/read limits in the release notes.

References:

- OAuth 2.0 PKCE setup: https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token
- Current usage and billing: https://docs.x.com/x-api/fundamentals/post-cap
- X API overview: https://docs.x.com/x-api
