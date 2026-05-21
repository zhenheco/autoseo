# Meta Data Deletion Instructions

Issue: #93, slice P2-D2

## User-Initiated Disconnect

Users can disconnect Meta social accounts from:

- `/dashboard/social`
- Disconnect button on each connected Instagram, Facebook Page, or Threads account

Expected behavior:

1. User clicks Disconnect for a connected Meta account.
2. 1waySEO removes the stored OAuth token material for that account.
3. The account no longer appears as an available publish destination.
4. Scheduled publishing and engagement refreshes stop for the disconnected account.

Stored data affected:

- `social_accounts.access_token_encrypted`
- `social_accounts.refresh_token_encrypted`
- `social_accounts.disconnected_at`
- Brand-scoped connection metadata such as platform account ID and username

## Meta Required Data Deletion Callback

Callback URL for Meta App Dashboard:

`https://1wayseo.com/api/meta/data-deletion`

HTTP method:

`POST`

Payload:

Meta sends a `signed_request` field. 1waySEO verifies the signature with `META_APP_SECRET`, extracts the signed `user_id`, removes social account rows associated with that user, and returns the required response:

```json
{
  "url": "https://1wayseo.com/api/meta/data-deletion?code=<confirmation_code>",
  "confirmation_code": "<confirmation_code>"
}
```

Status check URL:

`https://1wayseo.com/api/meta/data-deletion?code=<confirmation_code>`

The status URL returns a processed status for the submitted confirmation code.

## What Is Deleted

The callback removes stored social account connection rows associated with the signed request user. This includes encrypted OAuth token material and connected account metadata used for publishing.

The callback does not delete generated articles, captions, or posts that the user created in 1waySEO unless the customer separately requests broader workspace deletion.

## User-Facing Wording Draft

1waySEO lets you disconnect Instagram, Facebook Page, and Threads accounts from `/dashboard/social`. Disconnecting removes stored OAuth credentials and stops future publishing or metric refreshes for that account. If you request data deletion through Meta, Meta sends 1waySEO a signed deletion request and 1waySEO removes the stored social connection records associated with your Meta user.

## Ace Pre-Submission Checks

- Confirm the production route is deployed at `/api/meta/data-deletion`.
- Confirm `META_APP_SECRET` is configured in the production platform secret store.
- Capture screenshot: `[SCREENSHOT: data-deletion-01-disconnect-button.png]` showing the Disconnect button in `/dashboard/social`.
- Capture screenshot: `[SCREENSHOT: data-deletion-02-meta-dashboard-callback.png]` showing the callback URL entered in Meta App Dashboard.
