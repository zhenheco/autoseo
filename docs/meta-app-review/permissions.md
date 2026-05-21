# Meta App Review Permissions Draft

Issue: #93, slice P2-D2

Status: draft for Ace review before Meta App Dashboard submission.

## instagram_basic

Use case description: 1waySEO uses `instagram_basic` after the user connects an Instagram professional account from `/dashboard/social`. The app reads the connected account profile, account ID, username, and basic metadata so the dashboard can show which Instagram account is connected to each brand.

End-user benefit: Users can confirm that the correct Instagram account is connected before scheduling or publishing article-derived social cards.

Where the data is shown: The connected account name, platform, and connection status are shown in `/dashboard/social` and in social publishing selectors attached to generated articles.

How it is stored: Account identifiers and usernames are stored in `social_accounts`. OAuth access tokens are encrypted before storage. Raw profile data beyond the account identifier and display username is not stored unless needed for the connected account display.

How the user controls deletion: Users can click Disconnect in `/dashboard/social` to remove the connected account tokens. Users can also trigger Meta's data deletion flow, which calls `/api/meta/data-deletion` and removes social account rows associated with the signed request user.

## instagram_content_publish

Use case description: 1waySEO uses `instagram_content_publish` to publish article-derived social cards to the user's connected Instagram account, including feed posts and Stories when the user chooses Instagram as a publishing destination.

End-user benefit: Users can turn long-form SEO articles into native Instagram posts without manually downloading assets, rewriting captions, and uploading each post in Instagram.

Where the data is shown: Draft caption, media preview, selected account, scheduled time, publish status, and post IDs are shown in the article social pack and `/dashboard/social`.

How it is stored: The app stores generated caption text, media URLs, selected social account ID, publish status, platform post ID, timestamps, and engagement metrics in `social_posts`. OAuth tokens remain encrypted in `social_accounts`.

How the user controls deletion: Users can delete or disconnect the social account from `/dashboard/social`. Disconnection removes stored OAuth credentials and prevents future publishing. Meta's data deletion callback at `/api/meta/data-deletion` removes stored social account rows for the signed user.

## pages_show_list

Use case description: 1waySEO uses `pages_show_list` to enumerate Facebook Pages available to the connected user during OAuth setup. The app needs this list so the user can choose the Page that belongs to the brand they are managing.

End-user benefit: Users avoid publishing to the wrong Page and can map each brand workspace to the correct Facebook Page.

Where the data is shown: Page names and connection status are shown during the social account connection flow and afterward in `/dashboard/social`.

How it is stored: The selected Page ID and display name are stored as a connected `facebook` social account. Unselected Page list results are not retained.

How the user controls deletion: Users can disconnect the Page in `/dashboard/social`. The Meta data deletion callback also removes stored social account rows associated with the signed request user.

## pages_manage_posts

Use case description: 1waySEO uses `pages_manage_posts` to publish generated article cards, captions, and links to the selected Facebook Page feed.

End-user benefit: Users can maintain a consistent Facebook content cadence from the same workflow used to generate and optimize SEO articles.

Where the data is shown: The selected Page, draft content, scheduled or published status, and resulting platform post ID are shown in article publishing views and `/dashboard/social`.

How it is stored: Publish jobs and outcomes are stored in `social_posts`. The Page connection and encrypted OAuth token are stored in `social_accounts`.

How the user controls deletion: Users can disconnect the Facebook Page in `/dashboard/social`, which removes stored credentials. The data deletion callback removes the social account rows for the signed user.

## pages_read_engagement

Use case description: 1waySEO uses `pages_read_engagement` to fetch engagement metrics for posts created by the app on the user's Facebook Page.

End-user benefit: Users can see which article-derived posts perform well and allow the self-optimization loop to improve future captions, posting windows, and content angles.

Where the data is shown: Aggregated metrics are shown in social performance areas, optimization reports, and article performance views. The app only uses engagement data for posts connected to the user's brand workspace.

How it is stored: Metrics such as reactions, comments, shares, impressions where available, and last-updated time are stored in `social_posts.metrics` and `social_posts.metrics_updated_at`.

How the user controls deletion: Users can disconnect the Page in `/dashboard/social`. Disconnection prevents future metric refreshes. Meta's data deletion callback removes stored social account rows; post metrics can also be removed during account cleanup if requested.

## threads_basic

Use case description: 1waySEO uses `threads_basic` to read the connected Threads account identity after the user connects it in `/dashboard/social`.

End-user benefit: Users can verify that the correct Threads account is connected before publishing short article summaries or commentary threads.

Where the data is shown: The connected Threads username, platform, and connection status are shown in `/dashboard/social` and social publishing selectors.

How it is stored: The Threads account ID and username are stored in `social_accounts`. Access tokens are encrypted before storage.

How the user controls deletion: Users can disconnect the Threads account from `/dashboard/social`. The Meta data deletion callback removes stored account rows for the signed user.

## threads_content_publish

Use case description: 1waySEO uses `threads_content_publish` to publish article-derived Threads posts from the user's selected brand workspace.

End-user benefit: Users can convert long-form articles into concise Threads posts and publish them from the same dashboard used for SEO article production.

Where the data is shown: Draft post text, selected Threads account, scheduled or published status, and platform post ID are shown in article social pack screens and `/dashboard/social`.

How it is stored: Draft text, publish status, selected account, platform post ID, timestamps, and metrics are stored in `social_posts`. OAuth tokens are encrypted in `social_accounts`.

How the user controls deletion: Users can disconnect Threads in `/dashboard/social`. The data deletion callback removes stored account rows for the signed user and stops future publishing.

## business_management

Use case description: 1waySEO uses `business_management` for multi-brand operators who manage several businesses, Facebook Pages, Instagram accounts, and Threads accounts from one dashboard. The permission helps the app identify business assets that the user is allowed to connect to each brand workspace.

End-user benefit: Agency owners and multi-brand operators can connect the correct Meta business assets to each brand without mixing accounts across clients or brands.

Where the data is shown: Business asset names and selected connections are shown in `/dashboard/social`, brand settings, and social publishing selectors.

How it is stored: Only selected asset identifiers needed for publishing and account display are stored. OAuth credentials are encrypted in `social_accounts`; unselected asset inventory is not retained.

How the user controls deletion: Users can disconnect individual accounts from `/dashboard/social`. Meta's data deletion callback removes social account rows for the signed user. Ace can also manually purge brand social connections from the admin database if a customer requests account cleanup.
