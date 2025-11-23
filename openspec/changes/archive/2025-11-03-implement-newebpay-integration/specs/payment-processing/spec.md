# Payment Processing Capability

## ADDED Requirements

### Requirement: Single Payment Order Creation

The system SHALL create single payment orders for subscription plans, token packages, and lifetime plans through the NewebPay payment gateway.

#### Scenario: Create subscription payment order

- **WHEN** a company selects a subscription plan and submits payment
- **THEN** the system SHALL:
  - Generate a unique order_no in format `ORD{timestamp}{random4digits}`
  - Insert a record into `payment_orders` table with status `pending`
  - Generate encrypted payment form data using NewebPay API
  - Return payment form containing `merchantId`, `tradeInfo`, `tradeSha`, `version`, and `apiUrl`

#### Scenario: Create token package payment order

- **WHEN** a company purchases a token package
- **THEN** the system SHALL:
  - Generate a unique order_no
  - Set `payment_type` to `token_package`
  - Store the package ID in `related_id` field
  - Return payment form for NewebPay authorization

#### Scenario: Create lifetime plan payment order

- **WHEN** a company purchases a lifetime plan
- **THEN** the system SHALL:
  - Generate a unique order_no
  - Set `payment_type` to `lifetime`
  - Store the plan ID in `related_id` field
  - Return payment form for NewebPay authorization

#### Scenario: Order creation fails due to database error

- **WHEN** database insertion fails
- **THEN** the system SHALL:
  - Log the error with full context
  - Return `{ success: false, error: '建立訂單失敗' }`
  - NOT proceed with payment form generation

### Requirement: Recurring Payment Mandate Creation

The system SHALL create recurring payment mandates for subscription plans with periodic billing through NewebPay's periodic payment feature.

#### Scenario: Create monthly recurring mandate

- **WHEN** a company subscribes to a monthly plan
- **THEN** the system SHALL:
  - Generate a unique mandate_no in format `MAN{timestamp}{random4digits}`
  - Generate a unique order_no for the first payment
  - Insert a record into `recurring_mandates` table with status `pending`
  - Insert a linked record into `payment_orders` table
  - Set `period_type` to `M` (monthly)
  - Generate encrypted Period parameter using NewebPay API
  - Return payment form with `apiUrl`, `postData`, and `merchantId`

#### Scenario: Create yearly recurring mandate

- **WHEN** a company subscribes to a yearly plan
- **THEN** the system SHALL:
  - Generate mandate_no and order_no
  - Set `period_type` to `Y` (yearly)
  - Set `period_start_type` to control first payment timing
  - Generate Period parameter for NewebPay

#### Scenario: Mandate creation with specific billing date

- **WHEN** a company specifies a preferred billing date (e.g., 1st of month)
- **THEN** the system SHALL:
  - Store the date in `period_point` field
  - Pass the point to NewebPay Period parameter
  - Schedule first payment according to `period_start_type`

#### Scenario: Mandate creation fails due to missing plan

- **WHEN** the specified plan_id does not exist
- **THEN** the system SHALL:
  - Return `{ success: false, error: '方案不存在' }`
  - NOT create any database records
  - NOT generate payment form

### Requirement: Order Number Generation

The system SHALL generate unique, traceable order numbers for all payment transactions.

#### Scenario: Generate single payment order number

- **WHEN** creating a single payment order
- **THEN** the system SHALL:
  - Use format `ORD{13-digit timestamp}{4-digit random}`
  - Ensure uniqueness through timestamp + randomization
  - Return a string of length 20 characters

#### Scenario: Generate recurring mandate number

- **WHEN** creating a recurring mandate
- **THEN** the system SHALL:
  - Use format `MAN{13-digit timestamp}{4-digit random}`
  - Ensure uniqueness through timestamp + randomization
  - Return a string of length 20 characters

#### Scenario: Collision detection

- **WHEN** a generated number already exists (rare case)
- **THEN** the system SHALL:
  - Rely on database UNIQUE constraint to reject duplicate
  - Allow caller to retry with a new number

### Requirement: Payment Form Generation

The system SHALL generate encrypted payment forms compatible with NewebPay's API requirements.

#### Scenario: Generate single payment form

- **WHEN** creating a single payment order
- **THEN** the system SHALL:
  - Encrypt payment data using AES-256-CBC with NewebPay key and IV
  - Include order_no, amount, description, email
  - Include ReturnURL pointing to `/api/payment/callback`
  - Include NotifyURL pointing to `/api/payment/notify`
  - Include ClientBackURL pointing to `/dashboard/billing`
  - Generate SHA256 hash for data integrity
  - Return form ready for HTML submission

#### Scenario: Generate recurring payment form

- **WHEN** creating a recurring mandate
- **THEN** the system SHALL:
  - Encrypt Period parameter with mandate_no as MerchantOrderNo
  - Include period_type, period_point, period_start_type, period_times
  - Include ReturnURL pointing to `/api/payment/recurring/callback`
  - Include NotifyURL pointing to `/api/payment/recurring/notify`
  - Return form with PostData* and MerchantID* fields

#### Scenario: Encryption fails

- **WHEN** encryption process throws an error
- **THEN** the system SHALL:
  - Log the error with sanitized details (no sensitive data)
  - Return `{ success: false, error: '建立支付表單失敗' }`
  - NOT expose encryption keys or raw data in logs

### Requirement: Payment Authorization Page

The system SHALL provide an intermediate authorization page that securely submits payment forms to NewebPay.

#### Scenario: Display authorization page

- **WHEN** user navigates to `/dashboard/billing/authorizing` with paymentForm query parameter
- **THEN** the page SHALL:
  - Parse paymentForm from URL
  - Validate presence of apiUrl, postData, merchantId
  - Display loading message "正在前往授權頁面..."
  - Auto-submit form within 500ms using JavaScript

#### Scenario: Auto-submit payment form

- **WHEN** the page loads with valid payment form data
- **THEN** the system SHALL:
  - Create hidden HTML form with action = apiUrl
  - Create input field with name="MerchantID\_" value=merchantId
  - Create input field with name="PostData\_" value=postData
  - Submit form automatically to NewebPay
  - Display "正在連接藍新金流..." during submission

#### Scenario: Missing payment form data

- **WHEN** paymentForm parameter is missing or invalid
- **THEN** the page SHALL:
  - Display error message "授權資料遺失"
  - Provide "返回計費中心" button
  - NOT attempt form submission

#### Scenario: Suspense boundary handling

- **WHEN** Next.js pre-renders the page
- **THEN** the system SHALL:
  - Wrap useSearchParams() in Suspense boundary
  - Display loading fallback while resolving query parameters
  - Set `export const dynamic = 'force-dynamic'` to prevent static generation
