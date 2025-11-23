# payment-status Specification

## Purpose

TBD - created by archiving change implement-newebpay-integration. Update Purpose after archive.

## Requirements

### Requirement: Order Status Query API

The system SHALL provide an API endpoint for querying payment order and recurring mandate status.

#### Scenario: Query single payment order by order_no

- **WHEN** GET request to `/api/payment/order-status/{orderNo}` with orderNo starting with "ORD"
- **THEN** the system SHALL:
  - Query payment_orders table with order_no filter
  - Use retry mechanism (5 attempts, 1 second interval)
  - Return order status, amount, description, newebpay_status
  - Return `{ synced: true, order: {...} }` if found

#### Scenario: Query recurring mandate by mandate_no

- **WHEN** GET request with orderNo starting with "MAN"
- **THEN** the system SHALL:
  - Query recurring_mandates table with mandate_no filter
  - Join with payment_orders using first_payment_order_id
  - Use retry mechanism to handle database replication delay
  - Return both mandate status and linked order status
  - Log mandate_no, found order_no, and both statuses

#### Scenario: Order not found after retries

- **WHEN** order/mandate not found after 5 retry attempts
- **THEN** the system SHALL:
  - Log "訂單尚未同步" with orderNo and last error
  - Return `{ synced: false, status: 'pending', message: '訂單正在處理中...' }`
  - Allow frontend to continue polling

#### Scenario: Unauthorized access

- **WHEN** request user is not authenticated
- **THEN** the system SHALL:
  - Return HTTP 401 with `{ error: '未授權' }`
  - NOT query database

#### Scenario: Permission validation

- **WHEN** authenticated user requests order from different company
- **THEN** the system SHALL:
  - Check company_members for user's company_id
  - Compare with order's company_id
  - Return HTTP 403 `{ error: '無權限查看此訂單' }` if mismatch
  - NOT expose order details

### Requirement: Frontend Status Polling

The system SHALL provide a React component that polls order status until completion or timeout.

#### Scenario: Start polling after payment submission

- **WHEN** user redirected to billing page with payment=pending parameter
- **THEN** PaymentStatusChecker component SHALL:
  - Extract orderNo from URL
  - Start polling immediately
  - Display "正在確認付款狀態..." message
  - Show progress counter "(X/90)"

#### Scenario: Poll every 2 seconds

- **WHEN** polling is active
- **THEN** the component SHALL:
  - Call `/api/payment/order-status/{orderNo}` API
  - Wait 2 seconds between requests
  - Increment poll count
  - Update progress display

#### Scenario: Receive success status

- **WHEN** API returns order with status "success"
- **THEN** the component SHALL:
  - Stop polling immediately
  - Display success message
  - Show green checkmark icon
  - Reload page after 2 seconds to show updated billing info

#### Scenario: Receive failed status

- **WHEN** API returns order with status "failed"
- **THEN** the component SHALL:
  - Stop polling immediately
  - Display failure message with error details
  - Show red error icon
  - Provide "重新整理" button

#### Scenario: Maximum poll count reached

- **WHEN** poll count reaches 90 (3 minutes)
- **THEN** the component SHALL:
  - Stop polling
  - Display timeout message "確認超時，請重新整理頁面或聯繫客服"
  - Change status to "failed"

#### Scenario: Three consecutive errors

- **WHEN** API request fails 3 times in a row
- **THEN** the component SHALL:
  - Increment error counter
  - Continue polling if error count < 3
  - Stop polling if error count >= 3 or total polls >= 85
  - Display "無法確認付款狀態" message

#### Scenario: API fetch error

- **WHEN** fetch() throws network error
- **THEN** the component SHALL:
  - Log error with context
  - Increment error count
  - Continue polling (with error count check)
  - NOT stop immediately on first error

### Requirement: Billing Center Status Display

The system SHALL display payment status clearly in the billing center page.

#### Scenario: Display pending status during polling

- **WHEN** user is on billing center with active polling
- **THEN** the page SHALL:
  - Show PaymentStatusChecker component
  - Display animated loading indicator
  - Show progress percentage
  - Disable other payment actions

#### Scenario: Display success status

- **WHEN** payment successfully confirmed
- **THEN** the page SHALL:
  - Show success alert "付款成功"
  - Update subscription/token display
  - Enable new payment actions
  - Clear payment status parameters from URL

#### Scenario: Display error status

- **WHEN** payment confirmation fails
- **THEN** the page SHALL:
  - Show error alert with specific message
  - Suggest user actions (refresh, contact support)
  - Enable retry payment actions

#### Scenario: Handle multiple payment sessions

- **WHEN** user initiates new payment while previous is pending
- **THEN** the page SHALL:
  - Replace previous polling with new orderNo
  - Cancel previous fetch requests
  - Start fresh polling countdown

### Requirement: Status Query Retry Mechanism

The system SHALL implement retry logic to handle database replication delays in status queries.

#### Scenario: First query succeeds

- **WHEN** order/mandate found on first attempt
- **THEN** the system SHALL:
  - Log success with attempt number 1/5
  - Return result immediately
  - Skip remaining 4 retries

#### Scenario: Query with progressive retries

- **WHEN** order/mandate not found on first attempt
- **THEN** the system SHALL:
  - Wait 1 second
  - Retry query
  - Log each attempt with result
  - Continue up to 5 total attempts

#### Scenario: Mandate query with join

- **WHEN** querying recurring_mandates
- **THEN** the system SHALL:
  - Use Supabase select with join syntax: `select('*, payment_orders!first_payment_order_id(*)')`
  - Use .maybeSingle() to allow null results
  - Validate both mandate and linked order exist
  - Log both mandate status and order status

#### Scenario: Database error during retry

- **WHEN** Supabase query returns error
- **THEN** the system SHALL:
  - Store error in lastError variable
  - Log error details with attempt number
  - Continue retrying
  - Return final error only after all attempts exhausted

### Requirement: Status Logging

The system SHALL log all status query operations for debugging and monitoring.

#### Scenario: Log query initiation

- **WHEN** status query API receives request
- **THEN** the system SHALL log:
  - Request orderNo
  - User authentication status
  - Company_id from session

#### Scenario: Log each retry attempt

- **WHEN** attempting to query order/mandate
- **THEN** the system SHALL log:
  - Attempt number (X/5)
  - Query type (order vs mandate)
  - Found/not found result
  - Error details if failed

#### Scenario: Log successful query

- **WHEN** order/mandate found
- **THEN** the system SHALL log:
  - Order/mandate status
  - Associated details (orderNo, amount, etc.)
  - Number of attempts required
  - Query execution time

#### Scenario: Log permission check

- **WHEN** validating user permission
- **THEN** the system SHALL log:
  - User's company_id
  - Order's company_id
  - Permission granted/denied result
