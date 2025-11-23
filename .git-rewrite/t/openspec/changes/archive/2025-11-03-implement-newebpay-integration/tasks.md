# Implementation Tasks

## 1. Core Payment Service Implementation

- [x] 1.1 Implement PaymentService class with Supabase and NewebPayService dependencies
- [x] 1.2 Implement order number generation (generateOrderNo, generateMandateNo)
- [x] 1.3 Implement createOnetimePayment method
- [x] 1.4 Implement createRecurringPayment method
- [x] 1.5 Add comprehensive logging for all payment operations

## 2. NewebPay API Integration

- [x] 2.1 Implement NewebPayService with encryption/decryption methods
- [x] 2.2 Implement AES-256-CBC encryption for payment data
- [x] 2.3 Implement SHA256 hash generation for data integrity
- [x] 2.4 Implement TradeInfo decryption for single payment callbacks
- [x] 2.5 Implement Period decryption for recurring payment callbacks

## 3. Payment Creation API Endpoints

- [x] 3.1 Create `/api/payment/onetime/create` POST endpoint
- [x] 3.2 Create `/api/payment/recurring/create` POST endpoint
- [x] 3.3 Add authentication checks using Supabase auth
- [x] 3.4 Add request validation (amount, email, company_id)
- [x] 3.5 Return payment form data for frontend submission

## 4. Callback Handling - ReturnURL

- [x] 4.1 Create `/api/payment/callback` GET/POST endpoint for single payments
- [x] 4.2 Create `/api/payment/recurring/callback` GET/POST endpoint
- [x] 4.3 Implement decryption and validation of callback parameters
- [x] 4.4 Implement order/mandate status updates
- [x] 4.5 Implement user redirection with status parameters
- [x] 4.6 Add error handling with proper return statements in catch blocks

## 5. Callback Handling - NotifyURL

- [x] 5.1 Create `/api/payment/notify` POST endpoint for single payments
- [x] 5.2 Create `/api/payment/recurring/notify` POST endpoint
- [x] 5.3 Implement idempotency checks
- [x] 5.4 Return "SUCCESS" acknowledgment to NewebPay
- [x] 5.5 Handle periodic billing notifications

## 6. Database Retry Mechanism

- [x] 6.1 Implement retry logic in handleRecurringCallback
- [x] 6.2 Use .maybeSingle() instead of .single() to avoid errors
- [x] 6.3 Retry 5 times with 1 second intervals
- [x] 6.4 Log each retry attempt with detailed context
- [x] 6.5 Return detailed error if all retries fail

## 7. Order Status Query API

- [x] 7.1 Create `/api/payment/order-status/[orderNo]` GET endpoint
- [x] 7.2 Support both order_no (ORD prefix) and mandate_no (MAN prefix) queries
- [x] 7.3 Implement retry mechanism (5 attempts, 1 second interval)
- [x] 7.4 Join recurring_mandates with payment_orders
- [x] 7.5 Add authentication and permission checks
- [x] 7.6 Return synced status and order/mandate details

## 8. Frontend Authorization Page

- [x] 8.1 Create `/dashboard/billing/authorizing` page
- [x] 8.2 Implement useSearchParams with Suspense boundary
- [x] 8.3 Parse paymentForm from URL query parameter
- [x] 8.4 Auto-submit form to NewebPay with MerchantID* and PostData* fields
- [x] 8.5 Add loading states and error handling
- [x] 8.6 Set `export const dynamic = 'force-dynamic'`

## 9. Frontend Status Polling Component

- [x] 9.1 Create PaymentStatusChecker React component
- [x] 9.2 Implement polling logic (every 2 seconds, max 90 times)
- [x] 9.3 Display progress counter (X/90)
- [x] 9.4 Handle success, failed, and timeout states
- [x] 9.5 Implement error counter (stop after 3 consecutive errors)
- [x] 9.6 Auto-reload page on success

## 10. Billing Center Integration

- [x] 10.1 Integrate PaymentStatusChecker into billing center page
- [x] 10.2 Display payment status alerts (success/error/pending)
- [x] 10.3 Handle payment query parameters from URL
- [x] 10.4 Update subscription/token display after successful payment

## 11. Business Logic - Subscription Creation

- [x] 11.1 Implement subscription creation in handleRecurringCallback
- [x] 11.2 Query subscription_plans for plan details
- [x] 11.3 Upsert company_subscriptions record
- [x] 11.4 Calculate period_start and period_end dates
- [x] 11.5 Add purchased tokens to company_tokens table

## 12. Logging and Monitoring

- [x] 12.1 Add comprehensive logging to PaymentService
- [x] 12.2 Log callback receipt and decryption results
- [x] 12.3 Log database operations and retry attempts
- [x] 12.4 Log business logic decisions (status transitions)
- [x] 12.5 Sanitize sensitive data (encryption keys, full card numbers)

## 13. Error Handling

- [x] 13.1 Implement proper error responses in all API endpoints
- [x] 13.2 Add try-catch blocks with return statements
- [x] 13.3 Handle database errors gracefully
- [x] 13.4 Handle decryption errors with appropriate HTTP status codes
- [x] 13.5 Display user-friendly error messages in frontend

## 14. Testing and Validation

- [ ] 14.1 Test single payment flow with NewebPay test credit card
- [ ] 14.2 Test recurring payment authorization flow
- [ ] 14.3 Test callback retry mechanism with delayed database writes
- [ ] 14.4 Test frontend polling with various scenarios (success/error/timeout)
- [ ] 14.5 Test permission validation (cross-company access attempts)
- [ ] 14.6 Monitor Vercel logs during test transactions
- [ ] 14.7 Verify subscription and token creation after successful payment

## 15. Documentation

- [ ] 15.1 Document NewebPay test credentials and test card numbers
- [ ] 15.2 Document callback URL configuration in NewebPay dashboard
- [ ] 15.3 Document environment variables required (NEWEBPAY_MERCHANT_ID, HASH_KEY, HASH_IV)
- [ ] 15.4 Update project README with payment integration overview
- [ ] 15.5 Create troubleshooting guide for common payment issues

## Dependencies

- Task 6 depends on Task 4 (retry mechanism used by callback handling)
- Task 7 depends on Task 1 (order status queries payment_orders created by PaymentService)
- Task 9 depends on Task 7 (polling component calls order-status API)
- Task 11 depends on Task 4 (subscription creation triggered by callback)
- Task 14 depends on all implementation tasks (1-13)

## Parallelizable Work

- Tasks 1-3 can be done in parallel (core service vs API endpoints)
- Tasks 4-5 can be done in parallel (ReturnURL vs NotifyURL)
- Tasks 8-10 can be done in parallel (different frontend components)
- Task 12 can be added incrementally to other tasks
- Task 13 can be improved incrementally as issues are discovered
