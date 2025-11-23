## MODIFIED Requirements

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
    - Set status to "active"
    - Store newebpay_period_no
    - Set activated_at timestamp
    - Calculate and set next_payment_date based on period_type
  - Update linked payment_orders:
    - Set status to "success"
    - Store NewebPay response
    - Set paid_at timestamp
  - Update companies table:
    - Set subscription_tier to the purchased plan (from mandate.plan_id or subscription_plans lookup)
    - Set subscription_ends_at to next billing date (for monthly: add 1 month, for yearly: add 1 year)
    - Update seo_token_balance by adding plan's token quota
  - Return `{ success: true }`

#### Scenario: Create company subscription

- **WHEN** mandate status is updated to "active"
- **THEN** the system SHALL:
  - Query subscription_plans for plan details using mandate.plan_id
  - Upsert company_subscriptions record with:
    - plan_id from mandate
    - status = "active"
    - period_start = current timestamp
    - period_end = calculated based on period_type (monthly: +1 month, yearly: +1 year)
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

## ADDED Requirements

### Requirement: Test Account Data Reset

The system SHALL support resetting test accounts to free tier for testing purposes.

#### Scenario: Reset test account to free tier

- **WHEN** administrator requests reset for acejou27@gmail.com
- **THEN** the system SHALL:
  - Delete all payment_orders records where company_id matches the user
  - Delete all recurring_mandates records where company_id matches the user
  - Delete all company_subscriptions records where company_id matches the user
  - Update companies table:
    - Set subscription_tier = "free"
    - Set subscription_ends_at = NULL
    - Set seo_token_balance to free tier default (10000 tokens)
  - Preserve other account data (company profile, created content, etc.)

#### Scenario: Verify reset success

- **WHEN** reset operation completes
- **THEN** the system SHALL:
  - Verify no pending or active payment records exist
  - Verify company is on free tier with default token balance
  - Log reset operation with timestamp and admin identifier
  - Return success confirmation with reset details
