# Meta App Review Use Cases Draft

Issue: #93, slice P2-D2

Ace must capture the screenshots listed below before submission. Replace each placeholder with the final screenshot filename after capture.

## Use Case 1: Solo Operator Generating And Auto-Publishing Weekly Content

Actor: A solo business owner who writes one SEO article per week and wants matching Instagram and Facebook posts.

End-to-end flow:

1. The user signs in to 1waySEO and opens `/dashboard/articles/new`.
2. The user enters a target topic, brand context, keywords, and preferred publishing cadence.
3. 1waySEO generates the SEO article and a social pack with caption text and media card suggestions.
4. The user opens the article social pack, selects the connected Instagram account and Facebook Page, reviews the caption and image card, then schedules the posts.
5. At the scheduled time, 1waySEO publishes the Instagram feed post and Facebook Page post using the connected Meta permissions.
6. The user returns to `/dashboard/social` or the article detail screen to confirm published status and platform post IDs.

Requested permissions demonstrated:

- `instagram_basic`: Shows the connected Instagram account.
- `instagram_content_publish`: Publishes the Instagram post.
- `pages_show_list`: Lets the user choose the correct Facebook Page.
- `pages_manage_posts`: Publishes the Facebook Page feed post.

End-user benefit: The user saves time by creating the article and matching social posts in one workflow while still reviewing the content before publication.

Screenshot placeholders for Ace:

- `[SCREENSHOT: solo-01-article-generation.png]` Article generation form with topic and brand selected.
- `[SCREENSHOT: solo-02-social-pack-preview.png]` Article social pack with Instagram and Facebook destinations selected.
- `[SCREENSHOT: solo-03-published-status.png]` Published status showing platform post IDs or successful publish confirmation.
- `[SCREENSHOT: solo-04-dashboard-social-connected.png]` `/dashboard/social` showing connected Instagram and Facebook accounts.

## Use Case 2: Multi-Brand Owner Managing IG, FB, And Threads From One Dashboard

Actor: A founder or agency operator who manages multiple brands, each with separate Meta social accounts.

End-to-end flow:

1. The user opens the brand switcher and selects Brand A.
2. The user goes to `/dashboard/social` and connects Brand A's Instagram professional account, Facebook Page, and Threads account.
3. The user switches to Brand B and connects a different set of Meta assets.
4. In the article social pack, the user confirms that only the currently selected brand's social accounts are available as publishing destinations.
5. The user publishes or schedules content to Instagram, Facebook, and Threads for Brand B without exposing Brand A's connected assets.
6. The user returns to `/dashboard/social` to verify the connection list per brand.

Requested permissions demonstrated:

- `business_management`: Lets multi-brand users select the correct business assets.
- `pages_show_list`: Lists Facebook Pages available for connection.
- `instagram_basic`: Displays connected Instagram identity.
- `threads_basic`: Displays connected Threads identity.
- `instagram_content_publish`, `pages_manage_posts`, `threads_content_publish`: Publish approved article-derived posts to each destination.

End-user benefit: The operator can manage several brands from one dashboard while keeping account connections scoped to the active brand.

Screenshot placeholders for Ace:

- `[SCREENSHOT: multibrand-01-brand-a-social.png]` Brand A selected with its connected Meta accounts.
- `[SCREENSHOT: multibrand-02-brand-b-social.png]` Brand B selected with a different connection set.
- `[SCREENSHOT: multibrand-03-asset-selector.png]` Meta account or Page selector during connection.
- `[SCREENSHOT: multibrand-04-social-pack-brand-scoped.png]` Social pack destination selector showing only the active brand's accounts.

## Use Case 3: Self-Optimization Loop Using Engagement Data

Actor: A content operator who wants future social captions and posting windows to improve based on real post engagement.

End-to-end flow:

1. The user publishes article-derived posts to Instagram, Facebook, and Threads.
2. After posts are live, 1waySEO fetches engagement data for app-created posts where the user granted read permissions.
3. The app stores metrics on the corresponding `social_posts` record with a `metrics_updated_at` timestamp.
4. The dashboard shows performance summaries such as high-performing topics, stronger calls to action, and better posting windows.
5. The next time the user generates a social pack, the self-optimization loop uses prior engagement patterns to propose better captions and scheduling recommendations.
6. The user can disconnect the account at any time to stop future engagement reads.

Requested permissions demonstrated:

- `pages_read_engagement`: Fetches Facebook Page engagement metrics for app-created posts.
- `instagram_basic` and `threads_basic`: Verify connected identities for account-scoped performance views.
- Publishing permissions: Link metrics to posts created by the app.

End-user benefit: Users get measurable feedback from prior content and can improve future social posts without manually exporting analytics.

Screenshot placeholders for Ace:

- `[SCREENSHOT: optimize-01-published-posts.png]` List of app-created posts with published status.
- `[SCREENSHOT: optimize-02-engagement-metrics.png]` Engagement metrics shown in article or social performance view.
- `[SCREENSHOT: optimize-03-optimization-recommendations.png]` Self-optimization recommendation panel.
- `[SCREENSHOT: optimize-04-disconnect-control.png]` `/dashboard/social` disconnect button for stopping future access.
