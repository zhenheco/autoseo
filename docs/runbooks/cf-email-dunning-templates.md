# cf-email dunning template TODOs

Issue #75 schedules dunning sends from 1WaySEO, but template authoring remains
owned by the separate cf-email repository.

Required template keys:

- `payment_failed_d1`: "Your payment didn't go through. Update your card."
- `payment_failed_d3`: same urgency tier, 3 days in.
- `payment_failed_d7`: final warning that the account downgrades tomorrow.

Each template needs locale coverage for:

- `en`
- `zh-TW`
- `zh-CN`
- `ja`
- `ko`
- `th`
- `vi`

Current 1WaySEO fallback stubs live in
`packages/web/src/lib/email/cf-email-client.ts` so scheduled sends can be
tested before the cf-email repo ships first-class localized templates.
