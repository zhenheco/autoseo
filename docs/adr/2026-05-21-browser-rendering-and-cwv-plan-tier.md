# ADR: Browser Rendering and CWV Plan Tier Gate

## Status

PROPOSED - pending owner approval and Cloudflare paid plan enablement.

## Decision

Use Cloudflare Browser Rendering API to run Lighthouse Node API plus axe-core for Chromium-backed Core Web Vitals and accessibility audits.

This avoids the Vercel serverless bundle/runtime constraints, including the practical 50 MB serverless limit for Chromium-based Lighthouse execution.

## Context

1waySEO customers are segmented by plan tier:

- free
- starter
- pro
- business
- agency

Each Chromium audit has a non-zero execution cost, estimated around US$0.0X per run depending on Cloudflare Browser Rendering usage and Worker execution. Chromium audits should therefore be limited to paid tiers that can justify the cost.

## Plan Tier Mapping

- free / starter: HTML-only scan. Do not run Chromium.
- pro: Chromium audit enabled, capped at 4 runs per month.
- business / agency: Chromium audit enabled without a monthly product cap.

The current implementation is a technical stub only. The monthly pro cap must be enforced before production enablement.

## Owner Enablement Steps

1. Enable a Cloudflare Workers Paid plan in the Cloudflare dashboard. Paid plans start at US$5/month.
2. Add a Browser Rendering binding to `packages/edge/wrangler.toml` or a dedicated audit Worker.
3. Set `CF_BROWSER_RENDERING_TOKEN` in the runtime secret store.
4. Smoke test the Chromium audit path on staging.

## Deferred

Production Browser Rendering is deferred until the first customer cohort confirms demand for CWV and accessibility audits. This avoids unnecessary paid infrastructure cost before the feature is commercially validated.

## HITL Approval Points

- Owner approves Cloudflare Workers Paid plan.
- Owner provisions the Browser Rendering binding.
- Owner provisions `CF_BROWSER_RENDERING_TOKEN`.
- Owner approves staging smoke test results before production rollout.
