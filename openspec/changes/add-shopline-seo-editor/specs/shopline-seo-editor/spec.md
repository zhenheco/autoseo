## ADDED Requirements

### Requirement: Product SEO Meta Editing

The system SHALL allow an authorized merchant to view and edit each product's SEO title, SEO description, handle (URL slug), and product title from the dashboard, and SHALL persist changes to SHOPLINE through the merchant's authorized connection.

#### Scenario: Merchant edits product SEO title

- **WHEN** a merchant opens the SHOPLINE SEO panel for a connected website
- **AND** selects a product and saves a new SEO title
- **THEN** the system sends a PUT to the SHOPLINE Admin API with the merchant's stored token
- **AND** returns the updated product to the dashboard
- **AND** records an audit row capturing before/after values, source `ui`, and the acting user

#### Scenario: SEO title exceeds the recommended length

- **WHEN** a merchant enters a SEO title longer than 70 characters
- **THEN** the save action is rejected before contacting SHOPLINE
- **AND** the dashboard surfaces the character limit inline

### Requirement: Product Image Alt Text Editing

The system SHALL allow merchants to edit alt text for each image attached to a product, and SHALL persist each alt change as a discrete audit entry.

#### Scenario: Merchant updates an image alt

- **WHEN** a merchant edits an image's alt text in the product editor
- **THEN** the system updates only that image via the SHOPLINE Admin API
- **AND** records an audit row scoped to `entity_type='image'` and the image id

### Requirement: Product Categorization

The system SHALL allow merchants to add a product to and remove a product from SHOPLINE collections in a single batched action.

#### Scenario: Merchant reassigns a product across collections

- **WHEN** a merchant submits add and remove lists from the categorization tab
- **THEN** the system performs each membership change serially
- **AND** returns a per-item success/failure result without rolling back already-succeeded changes
- **AND** records one audit row per successful membership change

### Requirement: Collection SEO Meta and Renaming

The system SHALL allow merchants to view and edit a collection's title, handle, SEO title, and SEO description.

#### Scenario: Merchant renames a collection and updates handle

- **WHEN** a merchant edits collection title and handle in the collections tab
- **THEN** the system persists changes to SHOPLINE
- **AND** when the handle changes, a `shopline_redirects` row mapping the old handle to the new handle is created automatically

### Requirement: Collection Hierarchy Override

The system SHALL store a parent collection assignment and display order per website-and-collection pair so the dashboard can present and update a collection tree even when SHOPLINE itself does not expose a native parent field.

#### Scenario: Merchant reparents a collection

- **WHEN** a merchant moves a collection under a new parent collection
- **THEN** the system upserts the parent and display order into `shopline_collection_hierarchy`
- **AND** records an audit row scoped to `entity_type='collection_hierarchy'`

#### Scenario: Merchant reorders products inside a collection

- **WHEN** a merchant submits a new product order for a collection
- **THEN** the system updates each collect's position in SHOPLINE
- **AND** records audit rows for the affected positions

### Requirement: Shop-Level SEO Settings

The system SHALL store per-website SEO defaults — title template, default description, robots toggles, sitemap toggle, default Open Graph image, and hreflang map — independent of SHOPLINE so merchants can manage cross-store defaults from the dashboard.

#### Scenario: Merchant sets a title template

- **WHEN** a merchant saves a title template containing variables `{{product.title}}`, `{{shop.name}}`, `{{collection.title}}`
- **THEN** the system persists the template into `shopline_shop_meta`
- **AND** product and collection edit modals show the rendered template as preview text without overwriting an existing SEO title until the merchant explicitly applies it

### Requirement: 301 Redirect Store

The system SHALL store redirects per website with a unique constraint on `(website_id, entity_type, handle_from)`, expose CRUD endpoints, and auto-create redirects whenever a product or collection handle changes.

#### Scenario: Handle change creates a redirect automatically

- **WHEN** a product or collection handle changes through the SEO updater
- **THEN** a redirect row mapping the old handle to the new handle is inserted
- **AND** if a redirect with the same `(website_id, entity_type, handle_from)` already exists, the insert is silently skipped

### Requirement: AI-Assisted Draft Generation

The system SHALL generate SEO meta and image alt drafts using the shared AI fallback chain, MUST NOT write any change without explicit merchant approval, and SHALL tag the audit row of the eventual save with `source='ai'` and the model used.

#### Scenario: Merchant requests an AI draft

- **WHEN** a merchant clicks "Generate with AI" on a product or collection
- **THEN** the system constructs a prompt containing only public catalog data (title, type, vendor, tags, shop name)
- **AND** returns a structured draft for the requested fields without persisting anything

#### Scenario: Merchant saves an AI draft

- **WHEN** a merchant approves the AI draft and submits the save
- **THEN** the corresponding PATCH request carries `source='ai'` and the model identifier
- **AND** the audit row records both fields

### Requirement: Audit Log

The system SHALL record one audit row per changed field for every product, collection, image, shop, category assignment, redirect, and hierarchy mutation, with `(company_id, website_id, entity_type, entity_id, field, before_value, after_value, source, model, user_id)`, and SHALL fail open: a failed audit insert MUST be logged as a warning without aborting the primary mutation.

#### Scenario: Audit insert fails because the table is missing

- **WHEN** the SHOPLINE write succeeds but the audit insert returns an error
- **THEN** the system logs a warning to the server console
- **AND** returns the SHOPLINE result to the caller without surfacing the audit failure

### Requirement: Connection Scope Guard

The system SHALL verify that the merchant's stored `granted_scopes` include every scope required for a write before contacting SHOPLINE, and SHALL respond with a structured `shopline_scope_missing` payload including the missing scopes and a `reauthorize_url` when a scope is absent.

#### Scenario: Required scope missing

- **WHEN** a merchant attempts a write that requires `write_products` but the connection only granted `read_products`
- **THEN** the system returns HTTP 403 with body `{ error: 'shopline_scope_missing', missing_scopes: [...], reauthorize_url: '/api/oauth/shopline/install?siteId=<websiteId>' }`
- **AND** the dashboard renders a reauthorize CTA leading to the install flow

### Requirement: Per-Company Write Rate Limit

The system SHALL enforce a sliding window write rate limit per company across all SHOPLINE write surfaces, defaulting to 60 writes per 60 seconds, and SHALL return HTTP 429 with a numeric `Retry-After` header when exceeded.

#### Scenario: Burst exceeds the window

- **WHEN** a company submits a 61st write within a 60-second window
- **THEN** the system returns HTTP 429 with `Retry-After` equal to the remaining seconds in the window
- **AND** the dashboard surfaces a localized "operations too frequent" toast

### Requirement: Health Summary and List Filters

The system SHALL evaluate each product and collection against a fixed set of SEO health flags — `missing_seo_title`, `seo_title_too_long`, `missing_seo_description`, `seo_description_too_long`, `missing_alt`, `duplicate_title` — and SHALL expose aggregate counts via a five-minute cached endpoint plus per-flag list filters.

#### Scenario: Merchant filters products by missing alt

- **WHEN** a merchant selects the `missing-alt` filter on the products list
- **THEN** the response contains only products whose images include at least one entry with an empty or missing alt

### Requirement: Dashboard Entry Point

The system SHALL surface a dashboard entry to the SHOPLINE SEO panel on the connected website card in the websites listing.

#### Scenario: Connected website card

- **WHEN** a merchant views the websites listing
- **AND** a website's SHOPLINE connection is active
- **THEN** the corresponding card includes a localized "SEO 編輯" button that links to `/dashboard/websites/<id>/shopline`

### Requirement: CLI / UI Parity

The CLI SHOPLINE SEO commands and the dashboard SEO panel SHALL share the same deep modules for writes so behavior cannot drift between the two surfaces.

#### Scenario: CLI update writes the same audit shape as the UI

- **WHEN** `pnpm shopline:cli seo-update` updates a product
- **THEN** the resulting audit row records `source='cli'`
- **AND** the field-level before/after values follow the same schema as a UI-originated update
