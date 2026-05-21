# Amego Microservice Contract

This contract is for the affiliate microservice implementation in the separate
`affiliate.1wayseo.com` repo. The 1wayseo backend must not call Amego directly.

## Endpoint

`POST /api/amego/issue`

Production URL:

`https://affiliate.1wayseo.com/api/amego/issue`

## Headers

- `Content-Type: application/json`
- `Idempotency-Key: <stripe_invoice_id>`
- `X-1wayseo-Signature: sha256=<hex>`

## Request Body

The JSON body matches the 1wayseo `AmegoIssueInput` shape:

```json
{
  "stripeInvoiceId": "in_123",
  "amountUsd": 29,
  "amountTwd": 899,
  "buyer": {
    "name": "Buyer Chen",
    "email": "buyer@example.com",
    "taxId": "12345678",
    "country": "TW"
  },
  "items": [
    {
      "description": "1WaySEO Solo monthly subscription",
      "quantity": 1,
      "unitPriceTwd": 899
    }
  ]
}
```

`buyer.taxId` is optional and is used for B2B Taiwan 統一編號 invoices.

## Success Response

HTTP `200`:

```json
{
  "invoiceNumber": "AB12345678",
  "issuedAt": "2026-05-21T03:00:00.000Z"
}
```

`issuedAt` must be an ISO 8601 timestamp string.

## Error Response

HTTP `4xx` for fatal caller/request/auth/idempotency errors. HTTP `5xx` for
retryable service or Amego upstream errors.

```json
{
  "error": "invalid_request",
  "details": {}
}
```

`details` is optional and must not include raw secrets or sensitive upstream
credentials.

## Idempotency

The microservice must treat `Idempotency-Key` as the Stripe invoice id. If it
receives the same key again, it must return the original `{ invoiceNumber,
issuedAt }` response and must not call Amego a second time.

If the same `Idempotency-Key` is received with a different body, return a fatal
`409` response such as:

```json
{
  "error": "idempotency_mismatch"
}
```

## HMAC Verification

The shared secret is stored in 1Password:

`op://Dev/1wayseo Amego Microservice HMAC/credential`

The microservice should receive the deployed secret through its platform secret
store, not from a committed env file.

Verification algorithm:

1. Read the raw request body bytes exactly as received.
2. Compute `HMAC-SHA256(body, hmac_secret)`.
3. Hex-encode the digest.
4. Compare against the value in `X-1wayseo-Signature` after removing the
   `sha256=` prefix.
5. Use constant-time comparison.

Reject missing or invalid signatures with HTTP `401`.

## Follow-up

Affiliate implementation issue: zhenheco/affiliate#1.
