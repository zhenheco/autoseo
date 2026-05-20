# ADR: Edge Worker KV SEO Injection

## Status

PROPOSED

## Context

S16 adds a platform-agnostic fix path for audit issues that cannot be applied through SHOPLINE native APIs. Approved medium-risk issues and eligible low-risk non-SHOPLINE issues need to become edge-rendered SEO rules so crawlers and social scrapers see the fixed HTML without changing the origin CMS.

## Decision

Use a minimal Cloudflare Worker in `packages/edge` backed by the Cloudflare KV namespace `EDGE_RULES`.

The audit app writes merged rule payloads to KV using keys in the form:

```text
{host}:{pathname}
{host}:*
```

The Worker reads the exact key first, falls back to the wildcard key, and applies supported SEO rewrites with `HTMLRewriter`:

- `meta-description`
- `og-image`
- `og-title`
- `canonical`
- `structured-data-jsonld`

This keeps edge injection independent of the delayed `edgeseo-edge` subtree merge and avoids importing that repo's existing complexity into this milestone.

## Consequences

- Non-SHOPLINE WordPress, Astro, Next.js, and external customer sites can receive server-side SEO fixes via Cloudflare routing.
- KV values are merged by rule type so one fix does not overwrite unrelated rules for the same page.
- The dashboard can reflect successful `audit_fix_log.route='edge-worker'` entries as injected at the edge.
- Origin content remains unchanged; removing the Worker route or KV rule removes the injected fix.

## HITL Action Items

1. In Cloudflare dashboard, create KV namespace `EDGE_RULES`.
2. Fill the namespace id in `packages/edge/wrangler.toml`.
3. Deploy with `wrangler deploy` after owner review.
4. For each customer domain, enable Cloudflare DNS proxy and bind the Worker route.
