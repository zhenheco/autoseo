# Pre-redesign DB Inventory

Generated at: pending production run

Production execution status: not run by agent. Run the inventory through `op run --env-file=<env-file> -- pnpm --filter @seo/web exec tsx scripts/inventory/pre-redesign-counts.ts` to replace this scaffold with the live count report.

## Counts

- Free users active in last 30 days: pending
- Free users total: pending
- Active paid users: pending
- Total companies: pending
- Total generated articles: pending
- Total article jobs: pending
- Total article translations: pending
- Total website configs: pending

## PAYUNi Non-terminal Rows

- payment_orders: pending
- recurring_mandates: pending
- recurring_payments: pending
- refund_requests: pending

## Articles Per Company Top 20

Pending production run.

## Websites Per Company Top 20

Pending production run.

## PAYUNi Status Values Seen

Pending production run.

## Exact SELECT Queries

### freeUsersActive30d

```sql
WITH free_companies AS (
  SELECT DISTINCT cs.company_id
  FROM company_subscriptions cs
  JOIN subscription_plans sp ON sp.id = cs.plan_id
  WHERE sp.slug = 'free'
    AND (cs.current_period_end IS NULL OR cs.current_period_end <= now())
)
SELECT COUNT(*)::int AS count
FROM free_companies fc
WHERE EXISTS (
  SELECT 1
  FROM article_jobs aj
  WHERE aj.company_id = fc.company_id
    AND aj.created_at >= now() - interval '30 days'
);
```

### freeUsersTotal

```sql
WITH free_companies AS (
  SELECT DISTINCT cs.company_id
  FROM company_subscriptions cs
  JOIN subscription_plans sp ON sp.id = cs.plan_id
  WHERE sp.slug = 'free'
    AND (cs.current_period_end IS NULL OR cs.current_period_end <= now())
)
SELECT COUNT(*)::int AS count
FROM free_companies;
```

### paidUsersActive

```sql
SELECT COUNT(DISTINCT cs.company_id)::int AS count
FROM company_subscriptions cs
JOIN subscription_plans sp ON sp.id = cs.plan_id
WHERE sp.slug <> 'free'
  AND cs.status = 'active'
  AND cs.current_period_end > now();
```

### totalCompanies

```sql
SELECT COUNT(*)::int AS count
FROM companies;
```

### totalGeneratedArticles

```sql
SELECT COUNT(*)::int AS count
FROM generated_articles;
```

### totalArticleJobs

```sql
SELECT COUNT(*)::int AS count
FROM article_jobs;
```

### totalArticleTranslations

```sql
SELECT COUNT(*)::int AS count
FROM article_translations;
```

### totalWebsiteConfigs

```sql
SELECT COUNT(*)::int AS count
FROM website_configs;
```

### paymentOrdersNonTerminal

```sql
SELECT COUNT(*)::int AS count
FROM payment_orders
WHERE status NOT IN ('cancelled', 'refunded', 'completed');
```

### recurringMandatesNonTerminal

```sql
SELECT COUNT(*)::int AS count
FROM recurring_mandates
WHERE status NOT IN ('cancelled', 'refunded', 'completed');
```

### recurringPaymentsNonTerminal

```sql
SELECT COUNT(*)::int AS count
FROM recurring_payments
WHERE status NOT IN ('cancelled', 'refunded', 'completed');
```

### refundRequestsNonTerminal

```sql
SELECT COUNT(*)::int AS count
FROM refund_requests
WHERE status NOT IN ('cancelled', 'refunded', 'completed');
```

### articlesPerCompanyTop20

```sql
SELECT
  ga.company_id::text AS "companyId",
  COALESCE(c.name, '') AS "companyName",
  COUNT(*)::int AS "articleCount"
FROM generated_articles ga
LEFT JOIN companies c ON c.id = ga.company_id
WHERE ga.company_id IS NOT NULL
GROUP BY ga.company_id, c.name
ORDER BY COUNT(*) DESC, ga.company_id::text ASC
LIMIT 20;
```

### websitesPerCompanyTop20

```sql
SELECT
  wc.company_id::text AS "companyId",
  COUNT(*)::int AS "websiteCount"
FROM website_configs wc
WHERE wc.company_id IS NOT NULL
GROUP BY wc.company_id
ORDER BY COUNT(*) DESC, wc.company_id::text ASC
LIMIT 20;
```

### paymentOrderStatuses

```sql
SELECT status::text AS status, COUNT(*)::int AS "rowCount"
FROM payment_orders
GROUP BY status
ORDER BY status;
```

### recurringMandateStatuses

```sql
SELECT status::text AS status, COUNT(*)::int AS "rowCount"
FROM recurring_mandates
GROUP BY status
ORDER BY status;
```

### recurringPaymentStatuses

```sql
SELECT status::text AS status, COUNT(*)::int AS "rowCount"
FROM recurring_payments
GROUP BY status
ORDER BY status;
```

### refundRequestStatuses

```sql
SELECT status::text AS status, COUNT(*)::int AS "rowCount"
FROM refund_requests
GROUP BY status
ORDER BY status;
```
