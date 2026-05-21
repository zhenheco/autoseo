# Analytics Funnel

## PostHog Dashboard

- Funnel chart URL: `TODO(Ace): paste PostHog funnel dashboard URL after the project and chart are created.`

## Canonical Funnel Events

| Event | Properties |
| --- | --- |
| `lp_view` | `{ locale: string; referer?: string }` |
| `cta_click` | `{ ctaId: string; locale: string }` |
| `pricing_view` | `{ locale: string }` |
| `signup_start` | `{ method: "email" \| "oauth" }` |
| `signup_complete` | `{ userId: string; companyId: string }` |
| `trial_card_added` | `{ userId: string; trialId: string; cardBrand: string }` |
| `trial_converted` | `{ userId: string; trialId: string; planId: string; amountUsd: number }` |

## Integration Notes

- Client funnel events dual-emit to PostHog and GA4 through `src/lib/analytics/events.ts`.
- Server-side Stripe trial helpers live in `src/lib/analytics/posthog-server.ts`. Issue #72 should call `captureTrialCardAdded()` from `checkout.session.completed` and `captureTrialConverted()` from `invoice.paid` after `trials.converted_at` is persisted.
- These events are product analytics only. They do not flow into `cf-email-sdk`, do not trigger transactional email, and should not be used as email delivery or suppression signals.
