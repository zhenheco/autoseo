# seo-monorepo

Monorepo skeleton for the existing `zhenheco/autoseo` repository.

## Packages

- `packages/web` - existing 1waySEO Next.js app.
- `packages/cli` - internal CLI entry points, starting with `shopline-cli`.
- `packages/audit` - placeholder package for the future audit engine.
- `packages/shared` - placeholder package for shared primitives.

Existing SDK packages under `packages/article-sync-sdk` and `packages/blog-sdk` are preserved in place.

## Commands

```bash
pnpm install
pnpm --filter @seo/web dev
pnpm --filter @seo/web type-check
pnpm --filter @seo/web vitest run
pnpm --filter @seo/web build
```

## Deployment Note

Production deployment is intentionally unchanged in this branch. Before deploying the monorepo layout, update the existing Vercel project Root Directory to `packages/web` in the Vercel dashboard.
