## MODIFIED Requirements

### Requirement: Secure Token Access

The system SHALL make SHOPLINE access tokens available only to server-side operations that have verified company and website ownership, and EVERY write surface that uses such a token SHALL pre-verify the connection's `granted_scopes` contain all scopes required for the write and SHALL apply a per-company write rate limit before contacting SHOPLINE.

#### Scenario: Unauthorized website access

- **WHEN** a user tries to access a SHOPLINE connection for a website outside their company
- **THEN** the system denies access
- **AND** no token material is returned

#### Scenario: Connected store missing required scope

- **WHEN** a server-side write requires a scope that the merchant did not grant
- **THEN** the request is rejected with a structured `shopline_scope_missing` response
- **AND** no call is made to SHOPLINE

#### Scenario: Write rate exceeded

- **WHEN** a company's writes exceed 60 within a 60-second sliding window
- **THEN** subsequent writes return HTTP 429 with a numeric `Retry-After`
- **AND** no call is made to SHOPLINE

### Requirement: Connected SHOPLINE Store State

The system SHALL track each connected SHOPLINE store by company, website, shop handle, granted scopes, status, and verification metadata, AND SHALL record every write performed through a stored token in a per-field audit log so the merchant or an admin can trace who changed what and when.

#### Scenario: View connection status

- **WHEN** a company member views a website integration status
- **THEN** the system shows whether SHOPLINE is connected
- **AND** it shows the shop handle, granted scopes, last verification time, and actionable reconnect instructions when needed

#### Scenario: Write audit trail

- **WHEN** a server-side handler updates SHOPLINE data through a stored connection
- **THEN** an audit row is recorded for each changed field with before/after values, the originating surface (`ui` / `cli` / `ai`), and the acting user
- **AND** an audit insertion failure SHALL NOT abort the SHOPLINE write itself
