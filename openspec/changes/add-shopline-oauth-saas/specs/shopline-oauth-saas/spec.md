## ADDED Requirements

### Requirement: Customer SHOPLINE Authorization

The system SHALL allow a merchant to authorize 1waySEO for a SHOPLINE store without sharing a SHOPLINE password, admin account, or manually copied Admin API token.

#### Scenario: Merchant authorizes by install link

- **WHEN** an authenticated 1waySEO user enters a valid SHOPLINE shop handle
- **THEN** the system generates a SHOPLINE authorization URL for the dedicated 1wayseo app
- **AND** the merchant is redirected to SHOPLINE to approve the requested SEO scopes
- **AND** the callback exchanges the authorization code server-side
- **AND** the access token is stored without being shown to the user or logged

#### Scenario: Merchant rejects authorization

- **WHEN** SHOPLINE returns an authorization error or the merchant cancels
- **THEN** the system records no token
- **AND** the user sees an actionable error state

### Requirement: Least-Privilege SEO Scope Policy

The system SHALL request only SHOPLINE scopes needed for SEO inspection and updates unless a later customer workflow explicitly requires more.

#### Scenario: Permission explanation

- **WHEN** the install flow presents SHOPLINE permissions or 1waySEO explanatory copy
- **THEN** the copy states that orders, customers, payments, checkout, cart, discounts, and inventory access are not required for the SEO workflow

### Requirement: Connected SHOPLINE Store State

The system SHALL track each connected SHOPLINE store by company, website, shop handle, granted scopes, status, and verification metadata.

#### Scenario: View connection status

- **WHEN** a company member views a website integration status
- **THEN** the system shows whether SHOPLINE is connected
- **AND** it shows the shop handle, granted scopes, last verification time, and actionable reconnect instructions when needed

### Requirement: Secure Token Access

The system SHALL make SHOPLINE access tokens available only to server-side operations that have verified company and website ownership.

#### Scenario: Unauthorized website access

- **WHEN** a user tries to access a SHOPLINE connection for a website outside their company
- **THEN** the system denies access
- **AND** no token material is returned

### Requirement: CLI Uses Authorized Connections

The CLI SHALL operate on SHOPLINE stores through authorized connections instead of requiring customers to share tokens manually.

#### Scenario: CLI resolves store token

- **WHEN** an operator runs a CLI command for an authorized shop handle
- **THEN** the CLI resolves the token through the server-side connection store or approved 1Password fallback
- **AND** the command performs the requested read or write operation without printing secrets

### Requirement: Public Audit Without Authorization

The system SHALL support a read-only public SEO audit for prospects that have not installed the SHOPLINE app.

#### Scenario: Audit public store

- **WHEN** an operator or prospect provides only a public SHOPLINE store URL
- **THEN** the system crawls public pages and sitemap data
- **AND** returns an SEO audit without requiring SHOPLINE authorization
- **AND** clearly marks write actions as unavailable until app authorization is completed

### Requirement: Dry-Run Before Write

The system SHALL support dry-run previews for SHOPLINE SEO write operations before applying changes.

#### Scenario: Product SEO update preview

- **WHEN** an operator proposes product SEO title or description changes
- **THEN** the system can show the target resources, current values, proposed values, and expected API operations without applying changes

#### Scenario: Product SEO update apply

- **WHEN** an authorized operator confirms apply mode
- **THEN** the system updates the target SHOPLINE resources
- **AND** records an operation log without token values
