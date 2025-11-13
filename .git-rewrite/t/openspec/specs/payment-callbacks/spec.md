# payment-callbacks Specification

## Purpose
TBD - created by archiving change implement-newebpay-integration. Update Purpose after archive.
## Requirements
### Requirement: ReturnURL Callback Handling
The system SHALL handle synchronous ReturnURL callbacks from NewebPay when users complete payment authorization.

#### Scenario: Single payment ReturnURL success
- **WHEN** NewebPay redirects user to `/api/payment/callback` with TradeInfo parameter
- **THEN** the system SHALL:
  - Decrypt TradeInfo using NewebPay key
  - Extract Status and MerchantOrderNo
  - If Status is "SUCCESS", mark order as success
  - Redirect user to `/dashboard/billing?payment=success&orderNo={orderNo}`

#### Scenario: Single payment ReturnURL failure
- **WHEN** NewebPay returns with Status other than "SUCCESS"
- **THEN** the system SHALL:
  - Extract error message from NewebPay response
  - Update order status to "failed"
  - Redirect user to `/dashboard/billing?payment=failed&error={message}`

#### Scenario: Recurring payment ReturnURL authorization success
- **WHEN** NewebPay redirects after successful recurring authorization with Period parameter
- **THEN** the system SHALL:
  - Decrypt Period parameter
  - Extract mandate_no from Result.MerchantOrderNo
  - Call handleRecurringCallback with retry mechanism
  - If successful, redirect to `?payment=success&orderNo={mandateNo}`
  - If failed, redirect to `?payment=error&error={message}`

#### Scenario: ReturnURL decryption fails
- **WHEN** decryption of TradeInfo or Period fails
- **THEN** the system SHALL:
  - Log full error details including encrypted data length
  - Return HTTP 400 with error message
  - NOT update any database records

### Requirement: NotifyURL Callback Handling
The system SHALL handle asynchronous NotifyURL callbacks from NewebPay server for payment confirmation.

#### Scenario: Single payment NotifyURL confirmation
- **WHEN** NewebPay sends POST to `/api/payment/notify` with TradeInfo
- **THEN** the system SHALL:
  - Decrypt TradeInfo
  - Update payment_orders status based on NewebPay Status
  - Store complete NewebPay response in newebpay_response JSONB field
  - Return "SUCCESS" to acknowledge receipt

#### Scenario: Recurring payment billing NotifyURL
- **WHEN** NewebPay sends POST to `/api/payment/recurring/notify` for periodic billing
- **THEN** the system SHALL:
  - Decrypt Period parameter
  - Extract mandate_no and billing details
  - Create new payment_orders record for this billing cycle
  - Update recurring_mandates.next_payment_date
  - Return "SUCCESS" to NewebPay

#### Scenario: NotifyURL idempotency
- **WHEN** NewebPay sends duplicate NotifyURL callback
- **THEN** the system SHALL:
  - Check if order already marked as success/failed
  - Skip processing if already handled
  - Return "SUCCESS" to prevent retries
  - Log duplicate callback for monitoring

### Requirement: Recurring Authorization Callback Processing
The system SHALL process recurring payment authorization callbacks with database replication tolerance and complete subscription activation.

#### Scenario: Authorization callback with database delay
- **WHEN** handleRecurringCallback is called within 1-2 seconds of mandate creation
- **THEN** the system SHALL:
  - Attempt to query recurring_mandates table using company_id from decrypted data
  - Use `.maybeSingle()` instead of `.single()` to avoid PGRST116 errors
  - Retry up to 5 times with 1 second intervals
  - Log each attempt with result
  - Proceed with update if mandate found within 5 seconds

#### Scenario: Authorization callback mandate found on first attempt
- **WHEN** database replication is fast (< 1 second)
- **THEN** the system SHALL:
  - Find mandate on first query
  - Log success at attempt 1/5
  - Skip remaining retries
  - Proceed immediately with status update and subscription activation

#### Scenario: Authorization callback mandate not found after retries
- **WHEN** mandate still not found after 5 retries (5 seconds total)
- **THEN** the system SHALL:
  - Log final error with mandate_no and last database error
  - Return `{ success: false, error: '找不到定期定額委託' }`
  - Allow ReturnURL handler to redirect user with error status

#### Scenario: Update mandate, order, and company subscription
- **WHEN** mandate is successfully found and Status is "SUCCESS"
- **THEN** the system SHALL:
  - Update recurring_mandates:
    * Set status to "active"
    * Store newebpay_period_no
    * Set activated_at timestamp
    * Calculate and set next_payment_date based on period_type
  - Update linked payment_orders:
    * Set status to "success"
    * Store NewebPay response
    * Set paid_at timestamp
  - Update companies table:
    * Set subscription_tier to the purchased plan (from mandate.plan_id or subscription_plans lookup)
    * Set subscription_ends_at to next billing date (for monthly: add 1 month, for yearly: add 1 year)
    * Update seo_token_balance by adding plan's token quota
  - Return `{ success: true }`

#### Scenario: Create company subscription
- **WHEN** mandate status is updated to "active"
- **THEN** the system SHALL:
  - Query subscription_plans for plan details using mandate.plan_id
  - Upsert company_subscriptions record with:
    * plan_id from mandate
    * status = "active"
    * period_start = current timestamp
    * period_end = calculated based on period_type (monthly: +1 month, yearly: +1 year)
  - This record tracks subscription history but company.subscription_tier is source of truth

#### Scenario: Monthly recurring billing success
- **WHEN** NotifyURL receives successful billing notification for monthly plan
- **THEN** the system SHALL:
  - Create new payment_orders record for this billing cycle
  - Update recurring_mandates.next_payment_date to next month same day
  - Update companies.subscription_ends_at to next month same day
  - Add monthly token quota to companies.seo_token_balance
  - Log billing success with cycle information

#### Scenario: Authorization callback with invalid Period data
- **WHEN** decrypted Period data lacks Result.MerchantOrderNo or company_id
- **THEN** the system SHALL:
  - Log error "解密資料結構錯誤，缺少必要欄位"
  - Return `{ success: false, error: '解密資料結構錯誤' }`
  - NOT attempt database updates

### Requirement: Callback Error Handling
The system SHALL provide robust error handling for all callback scenarios.

#### Scenario: Catch block returns error response
- **WHEN** any exception occurs during callback processing
- **THEN** the system SHALL:
  - Log error with full context
  - Extract error message from Error object
  - Return error response to prevent retries
  - For ReturnURL, redirect user with error parameter
  - For NotifyURL, return appropriate HTTP status

#### Scenario: Database update fails
- **WHEN** updating order/mandate status fails
- **THEN** the system SHALL:
  - Log database error details
  - NOT mark transaction as successful
  - Return error to trigger NewebPay retry (NotifyURL)
  - Show user error message (ReturnURL)

#### Scenario: Multiple callback processing
- **WHEN** both ReturnURL and NotifyURL update the same order
- **THEN** the system SHALL:
  - Use database transactions where applicable
  - Check current status before updating
  - Allow both to succeed (idempotent)
  - Log both callbacks for audit trail

### Requirement: Callback Logging
The system SHALL log comprehensive details for all callback processing to enable debugging and monitoring.

#### Scenario: Log callback receipt
- **WHEN** any callback endpoint receives a request
- **THEN** the system SHALL log:
  - Callback type (ReturnURL/NotifyURL)
  - Timestamp
  - Encrypted parameter length
  - Request headers (excluding sensitive data)

#### Scenario: Log decryption result
- **WHEN** decryption completes
- **THEN** the system SHALL log:
  - Success/failure status
  - Extracted key fields (Status, MerchantOrderNo)
  - Full decrypted data structure (sanitized)

#### Scenario: Log database operations
- **WHEN** querying or updating database
- **THEN** the system SHALL log:
  - Operation type (query/update)
  - Table name
  - Query filters
  - Result status
  - Retry attempt number (if applicable)

#### Scenario: Log business logic decisions
- **WHEN** processing authorization or payment confirmation
- **THEN** the system SHALL log:
  - Mandate/order found status
  - Status transitions (pending → active/success/failed)
  - Subscription creation result
  - Token addition result

### Requirement: Test Account Data Reset
The system SHALL support resetting test accounts to free tier for testing purposes.

#### Scenario: Reset test account to free tier
- **WHEN** administrator requests reset for acejou27@gmail.com
- **THEN** the system SHALL:
  - Delete all payment_orders records where company_id matches the user
  - Delete all recurring_mandates records where company_id matches the user
  - Delete all company_subscriptions records where company_id matches the user
  - Update companies table:
    * Set subscription_tier = "free"
    * Set subscription_ends_at = NULL
    * Set seo_token_balance to free tier default (10000 tokens)
  - Preserve other account data (company profile, created content, etc.)

#### Scenario: Verify reset success
- **WHEN** reset operation completes
- **THEN** the system SHALL:
  - Verify no pending or active payment records exist
  - Verify company is on free tier with default token balance
  - Log reset operation with timestamp and admin identifier
  - Return success confirmation with reset details

