# SHOPLINE Production Setup

1Password is the source of truth. Do not store raw tokens in repo files, logs, PRs, or issue comments.

## 1Password Items

Production source of truth:

- Vault: `Dev`
- Item: `1WAYSEO`
- Fields:
  - `OAUTH_STATE_SECRET`
  - `SHOPLINE_APP_TYPE` = `customized`
  - `SHOPLINE_CLIENT_ID`
  - `SHOPLINE_CLIENT_SECRET`
  - `SHOPLINE_REDIRECT_URI` = `https://1wayseo.com/api/oauth/shopline/callback`
  - `SHOPLINE_CUSTOMIZED_INSTALL_URL_TEMPLATE` = `https://{shopHandle}.myshopline.com/admin/oauth-web/#/oauth/authorize?appKey={clientId}&responseType=code&scope={scope}&redirectUri={redirectUri}&customField={state}`

Cloudflare AI Gateway source of truth:

- Vault: `Dev`
- Item: `CF_AI_GATEWAY`
- Fields:
  - `CF_AI_ACCOUNT_ID`
  - `CF_AI_GATEWAY_ID_1wayseo`
  - `CF_AI_GATEWAY_TOKEN_1wayseo`
  - `CF_AI_GATEWAY_ENABLED` = `true`

Per-customer CLI item, created after a store is connected:

- Item: `SHOPLINE <customer-or-shop-handle>`
- Fields:
  - `SHOPLINE_SHOP_HANDLE`
  - `SHOPLINE_ACCESS_TOKEN`
  - `SHOPLINE_APP_CONFIG_URL`
  - `SHOPLINE_TOKEN_CREATED_AT`
  - `SHOPLINE_TOKEN_EXPIRES_AT`

## SHOPLINE Customized App

Use a dedicated 1wayseo customized/customer app. Re-apply if the existing edgeseo app cannot be safely reused.

- Callback URL: `https://1wayseo.com/api/oauth/shopline/callback`
- Install URL template: `https://{shopHandle}.myshopline.com/admin/oauth-web/#/oauth/authorize?appKey={clientId}&responseType=code&scope={scope}&redirectUri={redirectUri}&customField={state}`
- OAuth baseline scopes: `read_products`, `read_product_listings`

SHOPLINE official custom app authorization uses the `oauth-web/#/oauth/authorize` URL. The older `/apps/install/{clientId}` path returns 404 for this development store.

## SHOPLINE Private App CLI Path

Use this path first when we need to operate a merchant store directly before the full SaaS install flow is ready.

Current development store:

- Shop handle: `edgeseo-test`
- App name: `1wayseo`
- App config URL: `https://edgeseo-test.myshopline.com/admin/app-store/custom-app-config/71b343623b6b8eb42e251bd6f8af039c3b298de9`
- Token state: generated and verified in SHOPLINE Admin. Store it only in 1Password as `SHOPLINE_ACCESS_TOKEN`.
- Verification: product Admin API returned 200; sitemap returned 200.

The attempted new `1wayseo` store creation is blocked by SHOPLINE's required store contact phone number. Do not guess the phone number.

For full-site SEO operations, the private app should have read/write access to these Admin API areas:

- Products: read/write products, product listings, variant images, product sizechart
- Store content: read/write pages, content, shop policy, navigation, URL routing, translations, files
- Store surface: read/write themes, script tags, pixels, publications, markets
- Store metadata/observability: read store information, store metrics, store logs, bulk operations

Avoid order, customer, payment, checkout, cart, discount, and inventory permissions unless a customer workflow explicitly needs them.

## Platform Secret Mapping

Vercel production is the active `1wayseo.com` web entrypoint. Cloudflare Worker production is kept configured with the same integration secrets, but it is not the current SHOPLINE callback entrypoint.

These names are synced to Vercel production:

- `OAUTH_STATE_SECRET`
- `SHOPLINE_APP_TYPE`
- `SHOPLINE_CLIENT_ID`
- `SHOPLINE_CLIENT_SECRET`
- `SHOPLINE_REDIRECT_URI`
- `SHOPLINE_CUSTOMIZED_INSTALL_URL_TEMPLATE`
- `CF_AI_GATEWAY_ACCOUNT_ID`
- `CF_AI_GATEWAY_ID`
- `CF_AI_GATEWAY_TOKEN`
- `CF_AI_GATEWAY_ENABLED`

These names are synced to Cloudflare Worker production:

- `OAUTH_STATE_SECRET`
- `SHOPLINE_APP_TYPE`
- `SHOPLINE_CLIENT_ID`
- `SHOPLINE_CLIENT_SECRET`
- `SHOPLINE_REDIRECT_URI`
- `SHOPLINE_CUSTOMIZED_INSTALL_URL_TEMPLATE`
- `CF_AI_GATEWAY_ACCOUNT_ID`
- `CF_AI_GATEWAY_ID`
- `CF_AI_GATEWAY_TOKEN`
- `CF_AI_GATEWAY_ENABLED`
- existing `PAYMENT_GATEWAY_*` secrets

Use `printf`, not `echo`, when piping secret values into CLIs so newline bytes are not stored.

## CLI Verification

Generate an install URL:

```bash
op run --env-file=.env.1password -- pnpm shopline:cli install-url --shop-handle <shopHandle>
```

Check an already connected store:

```bash
op run --env-file=.env.1password -- pnpm shopline:check
```

List sample products:

```bash
op run --env-file=.env.1password -- pnpm shopline:cli products --limit 5
```

Exchange an OAuth code without printing the token:

```bash
op run --env-file=.env.1password -- pnpm shopline:cli exchange-code --shop-handle <shopHandle> --code <oauthCode>
```
