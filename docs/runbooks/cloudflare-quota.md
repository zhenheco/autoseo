# Cloudflare Browser Rendering Quota

Cloudflare now documents Browser Rendering as **Browser Run**. This runbook
uses the product name from the dashboard where possible, but code and older
issues may still say Browser Rendering.

## Cloudflare quota

- Workers Free: 10 minutes of browser time per UTC day.
- Workers Paid: 10 browser-hours included per month, then pay-as-you-go
  browser-hour billing.
- Browser Sessions also have concurrency limits and billing. The Card Generator
  uses screenshot-style Quick Actions, so track browser time first.
- Failed Quick Actions that time out are not billed as browser hours per
  Cloudflare docs, but 429s still mean generation should back off immediately.

Official references:

- Pricing: <https://developers.cloudflare.com/browser-run/pricing/>
- Limits: <https://developers.cloudflare.com/browser-run/limits/>

## How to check usage

1. Open Cloudflare Dashboard.
2. Select the production account.
3. Go to **Browser Run**.
4. Review current browser time, rate-limit errors, and recent request failures.
5. If usage appears stuck on Free limits after upgrading Workers, redeploy the
   Worker so usage is associated with the paid plan.

## 1waySEO per-account card quota

The application quota module controls customer-facing card generation:

- Solo: 100 cards/month.
- Pro: 500 cards/month.
- Resource key: `cards`.
- Ledger table: `quota_consumption`.
- Monthly bucket: first day of the UTC month.

The Card Generator checks `quotaEnforcer.canConsume(companyId, "cards", 1)`
before each Browser Run screenshot and calls
`quotaEnforcer.consume(companyId, "cards", 1)` after a successful render.

## Alerting

- Warning threshold: 80% monthly utilization.
- Emit PostHog event: `card_quota_warning`.
- Event properties: `companyId`, `used`, `cap`, `plan`, `threshold`.
- Exhaustion tag: `cards_quota_exceeded` on the article job metadata.
- Ops email: sent through `cf-email-sdk` via `enqueueOpsAlertEmail`.

## Triage

1. Check whether Cloudflare Browser Run is exhausted or rate limited.
2. Check whether 1waySEO `cards` quota is exhausted for the company.
3. If Cloudflare is exhausted, pause card generation and reduce batch pressure.
4. If customer quota is exhausted, confirm the article detail page shows the
   quota banner and recommend Pro for 500 cards/month.
5. For unexpected spikes, inspect PostHog `card_quota_warning` events and
   `quota_consumption` deltas for the current UTC month.
