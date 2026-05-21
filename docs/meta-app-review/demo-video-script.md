# Meta App Review Demo Video Script

Target length: 2 minutes

Purpose: Show Meta reviewers the exact permission flow: connect Instagram, publish a post, fetch engagement data, and disconnect.

Ace must record this video in the production or staging environment that matches the Meta App Dashboard configuration.

## Scene List

### Scene 1: Open Social Dashboard

Duration: 0:00-0:15

Screen: `/dashboard/social`

Action: Show the brand selected in the dashboard and the empty or disconnected Meta account state.

Narration:

"This is 1waySEO's social dashboard. A user connects Meta accounts to a specific brand workspace so article-derived social posts publish to the correct destination."

### Scene 2: OAuth Connect Instagram

Duration: 0:15-0:40

Screen: `/dashboard/social`, then Meta OAuth dialog

Action: Click Connect Instagram, complete the Meta OAuth dialog, and return to 1waySEO.

Narration:

"I select Connect Instagram. The user is sent to Meta OAuth, reviews the requested permissions, and approves access. 1waySEO stores the connected account ID and encrypted token only for this brand."

Ace note:

- Use a reviewer-safe test Instagram professional account.
- Keep credentials hidden.
- If Meta OAuth screens expose private account details, blur them in the recording.

### Scene 3: Confirm Connected Account

Duration: 0:40-0:55

Screen: `/dashboard/social`

Action: Show the connected Instagram account card with username and status.

Narration:

"After OAuth, the dashboard shows the connected Instagram account. This uses `instagram_basic` so the user can verify that the correct account is connected before publishing."

### Scene 4: Publish Article-Derived Post

Duration: 0:55-1:25

Screen: Article social pack or article detail social publishing view

Action: Open a generated article, show the social pack preview, choose Instagram, and click Publish.

Narration:

"From a generated SEO article, the user reviews the article-derived caption and media card, selects the connected Instagram destination, and publishes. This is the `instagram_content_publish` use case. The user stays in control because they can review and edit the draft before publishing."

Ace note:

- Use a harmless demo article and caption.
- Capture the publish success state or resulting post ID.

### Scene 5: Fetch Engagement Data

Duration: 1:25-1:45

Screen: Social performance or article performance view

Action: Show the published post row and engagement metrics refresh.

Narration:

"After publishing, 1waySEO fetches engagement data for app-created posts and stores metrics on the post record. These metrics power the self-optimization loop, helping future captions and scheduling recommendations improve."

Ace note:

- If live metrics are not immediately available, show the metrics refresh control and an existing demo post with metrics.
- For Facebook Page review, include the matching `pages_read_engagement` screen in the final submitted video if Meta requests it.

### Scene 6: Disconnect Account

Duration: 1:45-2:00

Screen: `/dashboard/social`

Action: Click Disconnect on the connected Instagram account and show the disconnected state.

Narration:

"The user can disconnect at any time from the social dashboard. Disconnecting removes stored OAuth credentials and stops future publishing or metric refreshes. Meta data deletion requests are handled by the `/api/meta/data-deletion` callback."

## Submission Notes For Ace

- Keep the video under 2 minutes if possible.
- Record at 1080p.
- Use a test account and test brand.
- Show the OAuth approval screen clearly enough for reviewers to see the permission grant.
- Do not show raw tokens, secrets, environment variables, database consoles, or private customer data.
- If submitting Facebook Page and Threads permissions in the same review, record parallel connection and publish clips for Page and Threads or add them as supplemental videos.
