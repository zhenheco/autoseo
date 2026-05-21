#!/usr/bin/env tsx
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

type CountKey =
  | "freeUsersActive30d"
  | "freeUsersTotal"
  | "paidUsersActive"
  | "totalCompanies"
  | "totalGeneratedArticles"
  | "totalArticleJobs"
  | "totalArticleTranslations"
  | "totalWebsiteConfigs"
  | "paymentOrdersNonTerminal"
  | "recurringMandatesNonTerminal"
  | "recurringPaymentsNonTerminal"
  | "refundRequestsNonTerminal"
  | "companyReferralCodes"
  | "referralCodes"
  | "referralTokenRewards"
  | "referralRewards";

type ListKey = "articlesPerCompanyTop20" | "websitesPerCompanyTop20";

type StatusKey =
  | "paymentOrderStatuses"
  | "recurringMandateStatuses"
  | "recurringPaymentStatuses"
  | "refundRequestStatuses";

type QueryKey = CountKey | ListKey | StatusKey;

interface QueryResult<T extends Record<string, unknown>> {
  rows: T[];
}

export interface InventoryDbClient {
  query<T extends Record<string, unknown>>(
    sql: string,
  ): Promise<QueryResult<T>>;
  end(): Promise<void>;
}

export interface InventoryJsonReport {
  generatedAt: string;
  counts: {
    freeUsersActive30d: number;
    freeUsersTotal: number;
    paidUsersActive: number;
    totalCompanies: number;
    totalGeneratedArticles: number;
    totalArticleJobs: number;
    totalArticleTranslations: number;
    totalWebsiteConfigs: number;
    payuniNonTerminalRows: {
      paymentOrders: number;
      recurringMandates: number;
      recurringPayments: number;
      refundRequests: number;
    };
    referralRows: {
      companyReferralCodes: number;
      referralCodes: number;
      referralTokenRewards: number;
      referralRewards: number;
    };
    articlesPerCompanyTop20: ArticleCompanyCount[];
    websitesPerCompanyTop20: WebsiteCompanyCount[];
  };
}

interface ArticleCompanyCount {
  companyId: string;
  companyName: string;
  articleCount: number;
}

interface WebsiteCompanyCount {
  companyId: string;
  websiteCount: number;
}

interface StatusCount {
  status: string;
  rowCount: number;
}

interface InventoryResult {
  json: InventoryJsonReport;
  payuniStatusSummary: {
    paymentOrders: StatusCount[];
    recurringMandates: StatusCount[];
    recurringPayments: StatusCount[];
    refundRequests: StatusCount[];
  };
}

interface CliOptions {
  argv?: readonly string[];
  env?: NodeJS.ProcessEnv;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
  exit?: (code: number) => never | void;
  clientFactory?: (databaseUrl: string) => InventoryDbClient;
  writeFiles?: boolean;
  markdownPath?: string;
  issueLogPath?: string;
  now?: () => Date;
}

interface CliResult {
  exitCode: number;
  report?: InventoryJsonReport;
}

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const defaultMarkdownPath = path.join(
  repoRoot,
  "docs/archive/2026-05-21-pre-redesign/db-inventory.md",
);
const defaultIssueLogPath = path.join(repoRoot, "ISSUELOG.md");

const freeCompaniesCte = `WITH free_companies AS (
  SELECT DISTINCT cs.company_id
  FROM company_subscriptions cs
  JOIN subscription_plans sp ON sp.id = cs.plan_id
  WHERE sp.slug = 'free'
    AND (cs.current_period_end IS NULL OR cs.current_period_end <= now())
)`;

export const INVENTORY_SELECT_QUERIES: Record<QueryKey, string> = {
  freeUsersActive30d: `${freeCompaniesCte}
SELECT COUNT(*)::int AS count
FROM free_companies fc
WHERE EXISTS (
  SELECT 1
  FROM article_jobs aj
  WHERE aj.company_id = fc.company_id
    AND aj.created_at >= now() - interval '30 days'
);`,
  freeUsersTotal: `${freeCompaniesCte}
SELECT COUNT(*)::int AS count
FROM free_companies;`,
  paidUsersActive: `SELECT COUNT(DISTINCT cs.company_id)::int AS count
FROM company_subscriptions cs
JOIN subscription_plans sp ON sp.id = cs.plan_id
WHERE sp.slug <> 'free'
  AND cs.status = 'active'
  AND cs.current_period_end > now();`,
  totalCompanies: `SELECT COUNT(*)::int AS count
FROM companies;`,
  totalGeneratedArticles: `SELECT COUNT(*)::int AS count
FROM generated_articles;`,
  totalArticleJobs: `SELECT COUNT(*)::int AS count
FROM article_jobs;`,
  totalArticleTranslations: `SELECT COUNT(*)::int AS count
FROM article_translations;`,
  totalWebsiteConfigs: `SELECT COUNT(*)::int AS count
FROM website_configs;`,
  paymentOrdersNonTerminal: `SELECT COUNT(*)::int AS count
FROM payment_orders
WHERE status NOT IN ('cancelled', 'refunded', 'completed');`,
  recurringMandatesNonTerminal: `SELECT COUNT(*)::int AS count
FROM recurring_mandates
WHERE status NOT IN ('cancelled', 'refunded', 'completed');`,
  recurringPaymentsNonTerminal: `SELECT COUNT(*)::int AS count
FROM recurring_payments
WHERE status NOT IN ('cancelled', 'refunded', 'completed');`,
  refundRequestsNonTerminal: `SELECT COUNT(*)::int AS count
FROM refund_requests
WHERE status NOT IN ('cancelled', 'refunded', 'completed');`,
  companyReferralCodes: `SELECT COUNT(*)::int AS count
FROM company_referral_codes;`,
  referralCodes: `SELECT COUNT(*)::int AS count
FROM referral_codes;`,
  referralTokenRewards: `SELECT COUNT(*)::int AS count
FROM referral_token_rewards;`,
  referralRewards: `SELECT COUNT(*)::int AS count
FROM referral_rewards;`,
  articlesPerCompanyTop20: `SELECT
  ga.company_id::text AS "companyId",
  COALESCE(c.name, '') AS "companyName",
  COUNT(*)::int AS "articleCount"
FROM generated_articles ga
LEFT JOIN companies c ON c.id = ga.company_id
WHERE ga.company_id IS NOT NULL
GROUP BY ga.company_id, c.name
ORDER BY COUNT(*) DESC, ga.company_id::text ASC
LIMIT 20;`,
  websitesPerCompanyTop20: `SELECT
  wc.company_id::text AS "companyId",
  COUNT(*)::int AS "websiteCount"
FROM website_configs wc
WHERE wc.company_id IS NOT NULL
GROUP BY wc.company_id
ORDER BY COUNT(*) DESC, wc.company_id::text ASC
LIMIT 20;`,
  paymentOrderStatuses: `SELECT status::text AS status, COUNT(*)::int AS "rowCount"
FROM payment_orders
GROUP BY status
ORDER BY status;`,
  recurringMandateStatuses: `SELECT status::text AS status, COUNT(*)::int AS "rowCount"
FROM recurring_mandates
GROUP BY status
ORDER BY status;`,
  recurringPaymentStatuses: `SELECT status::text AS status, COUNT(*)::int AS "rowCount"
FROM recurring_payments
GROUP BY status
ORDER BY status;`,
  refundRequestStatuses: `SELECT status::text AS status, COUNT(*)::int AS "rowCount"
FROM refund_requests
GROUP BY status
ORDER BY status;`,
};

export async function createInventory(
  client: InventoryDbClient,
  options: {
    generatedAt?: string;
    stderr?: (message: string) => void;
  } = {},
): Promise<InventoryResult> {
  const stderr = options.stderr ?? process.stderr.write.bind(process.stderr);
  const generatedAt = options.generatedAt ?? new Date().toISOString();

  try {
    await queryLogged(client, "BEGIN", stderr);
    await queryLogged(client, "SET TRANSACTION READ ONLY", stderr);

    const countRows = await runCountQueries(client, stderr);
    const articlesPerCompanyTop20 = await queryList<ArticleCompanyCount>(
      client,
      INVENTORY_SELECT_QUERIES.articlesPerCompanyTop20,
      stderr,
      normalizeArticleCompanyCount,
    );
    const websitesPerCompanyTop20 = await queryList<WebsiteCompanyCount>(
      client,
      INVENTORY_SELECT_QUERIES.websitesPerCompanyTop20,
      stderr,
      normalizeWebsiteCompanyCount,
    );
    const payuniStatusSummary = {
      paymentOrders: await queryList<StatusCount>(
        client,
        INVENTORY_SELECT_QUERIES.paymentOrderStatuses,
        stderr,
        normalizeStatusCount,
      ),
      recurringMandates: await queryList<StatusCount>(
        client,
        INVENTORY_SELECT_QUERIES.recurringMandateStatuses,
        stderr,
        normalizeStatusCount,
      ),
      recurringPayments: await queryList<StatusCount>(
        client,
        INVENTORY_SELECT_QUERIES.recurringPaymentStatuses,
        stderr,
        normalizeStatusCount,
      ),
      refundRequests: await queryList<StatusCount>(
        client,
        INVENTORY_SELECT_QUERIES.refundRequestStatuses,
        stderr,
        normalizeStatusCount,
      ),
    };

    await queryLogged(client, "COMMIT", stderr);

    return {
      json: {
        generatedAt,
        counts: {
          freeUsersActive30d: countRows.freeUsersActive30d,
          freeUsersTotal: countRows.freeUsersTotal,
          paidUsersActive: countRows.paidUsersActive,
          totalCompanies: countRows.totalCompanies,
          totalGeneratedArticles: countRows.totalGeneratedArticles,
          totalArticleJobs: countRows.totalArticleJobs,
          totalArticleTranslations: countRows.totalArticleTranslations,
          totalWebsiteConfigs: countRows.totalWebsiteConfigs,
          payuniNonTerminalRows: {
            paymentOrders: countRows.paymentOrdersNonTerminal,
            recurringMandates: countRows.recurringMandatesNonTerminal,
            recurringPayments: countRows.recurringPaymentsNonTerminal,
            refundRequests: countRows.refundRequestsNonTerminal,
          },
          referralRows: {
            companyReferralCodes: countRows.companyReferralCodes,
            referralCodes: countRows.referralCodes,
            referralTokenRewards: countRows.referralTokenRewards,
            referralRewards: countRows.referralRewards,
          },
          articlesPerCompanyTop20,
          websitesPerCompanyTop20,
        },
      },
      payuniStatusSummary,
    };
  } catch (error) {
    await queryLogged(client, "ROLLBACK", stderr).catch(() => undefined);
    throw error;
  }
}

export function renderMarkdownReport(result: InventoryResult): string {
  const { json, payuniStatusSummary } = result;
  const lines = [
    "# Pre-redesign DB Inventory",
    "",
    `Generated at: ${json.generatedAt}`,
    "",
    "## Counts",
    "",
    `- Free users active in last 30 days: ${json.counts.freeUsersActive30d}`,
    `- Free users total: ${json.counts.freeUsersTotal}`,
    `- Active paid users: ${json.counts.paidUsersActive}`,
    `- Total companies: ${json.counts.totalCompanies}`,
    `- Total generated articles: ${json.counts.totalGeneratedArticles}`,
    `- Total article jobs: ${json.counts.totalArticleJobs}`,
    `- Total article translations: ${json.counts.totalArticleTranslations}`,
    `- Total website configs: ${json.counts.totalWebsiteConfigs}`,
    "",
    "## PAYUNi Non-terminal Rows",
    "",
    `- payment_orders: ${json.counts.payuniNonTerminalRows.paymentOrders}`,
    `- recurring_mandates: ${json.counts.payuniNonTerminalRows.recurringMandates}`,
    `- recurring_payments: ${json.counts.payuniNonTerminalRows.recurringPayments}`,
    `- refund_requests: ${json.counts.payuniNonTerminalRows.refundRequests}`,
    "",
    "## Referral Rows",
    "",
    `- company_referral_codes: ${json.counts.referralRows.companyReferralCodes}`,
    `- referral_codes: ${json.counts.referralRows.referralCodes}`,
    `- referral_token_rewards: ${json.counts.referralRows.referralTokenRewards}`,
    `- referral_rewards: ${json.counts.referralRows.referralRewards}`,
    "",
    "## Articles Per Company Top 20",
    "",
    "| Company ID | Company name | Article count |",
    "| --- | --- | ---: |",
    ...formatArticleRows(json.counts.articlesPerCompanyTop20),
    "",
    "## Websites Per Company Top 20",
    "",
    "| Company ID | Website count |",
    "| --- | ---: |",
    ...formatWebsiteRows(json.counts.websitesPerCompanyTop20),
    "",
    "## PAYUNi Status Values Seen",
    "",
    "### payment_orders",
    "",
    ...formatStatusRows(payuniStatusSummary.paymentOrders),
    "",
    "### recurring_mandates",
    "",
    ...formatStatusRows(payuniStatusSummary.recurringMandates),
    "",
    "### recurring_payments",
    "",
    ...formatStatusRows(payuniStatusSummary.recurringPayments),
    "",
    "### refund_requests",
    "",
    ...formatStatusRows(payuniStatusSummary.refundRequests),
    "",
    "## Exact SELECT Queries",
    "",
    ...Object.entries(INVENTORY_SELECT_QUERIES).map(
      ([name, sql]) => `### ${name}\n\n\`\`\`sql\n${sql.trim()}\n\`\`\`\n`,
    ),
  ];

  return `${lines.join("\n")}\n`;
}

export async function runCli(options: CliOptions = {}): Promise<CliResult> {
  const argv = options.argv ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  const stdout = options.stdout ?? console.log;
  const stderr = options.stderr ?? console.error;
  const now = options.now ?? (() => new Date());

  if (argv.includes("--allow-write")) {
    stderr(
      "Refusing --allow-write. This inventory only supports read-only SELECT checks.",
    );
    return { exitCode: 1 };
  }

  const databaseUrl = env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    stderr(
      "Missing SUPABASE_DB_URL. Run through 1Password, for example: op run --env-file=<env-file> -- pnpm exec tsx scripts/inventory/pre-redesign-counts.ts",
    );
    return { exitCode: 1 };
  }

  const client =
    options.clientFactory?.(databaseUrl) ?? createPgClient(databaseUrl);

  try {
    const result = await createInventory(client, {
      generatedAt: now().toISOString(),
      stderr,
    });

    if (options.writeFiles ?? true) {
      const markdownPath = options.markdownPath ?? defaultMarkdownPath;
      const issueLogPath = options.issueLogPath ?? defaultIssueLogPath;

      await writeMarkdown(markdownPath, result);
      await appendIssueLog(issueLogPath, result, env);
    }

    stdout(JSON.stringify(result.json, null, 2));

    return {
      exitCode: 0,
      report: result.json,
    };
  } finally {
    await client.end();
  }
}

export async function main(options: CliOptions = {}): Promise<void> {
  const exit = options.exit ?? process.exit;
  const result = await runCli(options);

  if (result.exitCode !== 0) {
    exit(result.exitCode);
  }
}

function createPgClient(databaseUrl: string): InventoryDbClient {
  const client = new Client({
    connectionString: databaseUrl,
    application_name: "pre-redesign-counts",
  });
  let connected = false;

  return {
    async query<T extends Record<string, unknown>>(
      sql: string,
    ): Promise<QueryResult<T>> {
      if (!connected) {
        await client.connect();
        connected = true;
      }

      const result = await client.query<T>(sql);

      return { rows: result.rows };
    },
    async end(): Promise<void> {
      if (connected) {
        await client.end();
      }
    },
  };
}

async function runCountQueries(
  client: InventoryDbClient,
  stderr: (message: string) => void,
): Promise<Record<CountKey, number>> {
  const keys: CountKey[] = [
    "freeUsersActive30d",
    "freeUsersTotal",
    "paidUsersActive",
    "totalCompanies",
    "totalGeneratedArticles",
    "totalArticleJobs",
    "totalArticleTranslations",
    "totalWebsiteConfigs",
    "paymentOrdersNonTerminal",
    "recurringMandatesNonTerminal",
    "recurringPaymentsNonTerminal",
    "refundRequestsNonTerminal",
    "companyReferralCodes",
    "referralCodes",
    "referralTokenRewards",
    "referralRewards",
  ];
  const counts = {} as Record<CountKey, number>;

  for (const key of keys) {
    counts[key] = await queryCount(
      client,
      INVENTORY_SELECT_QUERIES[key],
      stderr,
    );
  }

  return counts;
}

async function queryCount(
  client: InventoryDbClient,
  sql: string,
  stderr: (message: string) => void,
): Promise<number> {
  const result = await queryLogged<{ count: number | string | bigint }>(
    client,
    sql,
    stderr,
  );
  const row = result.rows[0];

  return row ? toNumber(row.count) : 0;
}

async function queryList<T>(
  client: InventoryDbClient,
  sql: string,
  stderr: (message: string) => void,
  normalize: (row: Record<string, unknown>) => T,
): Promise<T[]> {
  const result = await queryLogged<Record<string, unknown>>(
    client,
    sql,
    stderr,
  );

  return result.rows.map(normalize);
}

async function queryLogged<T extends Record<string, unknown>>(
  client: InventoryDbClient,
  sql: string,
  stderr: (message: string) => void,
): Promise<QueryResult<T>> {
  stderr(`[pre-redesign-counts] SQL:\n${sql.trim()}\n`);

  return client.query<T>(sql);
}

function normalizeArticleCompanyCount(
  row: Record<string, unknown>,
): ArticleCompanyCount {
  return {
    companyId: toStringValue(row.companyId),
    companyName: toStringValue(row.companyName),
    articleCount: toNumber(row.articleCount),
  };
}

function normalizeWebsiteCompanyCount(
  row: Record<string, unknown>,
): WebsiteCompanyCount {
  return {
    companyId: toStringValue(row.companyId),
    websiteCount: toNumber(row.websiteCount),
  };
}

function normalizeStatusCount(row: Record<string, unknown>): StatusCount {
  return {
    status: toStringValue(row.status),
    rowCount: toNumber(row.rowCount),
  };
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string" && value.trim() !== "") {
    return Number(value);
  }

  return 0;
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function formatArticleRows(rows: ArticleCompanyCount[]): string[] {
  if (rows.length === 0) {
    return ["| No rows |  | 0 |"];
  }

  return rows.map(
    (row) =>
      `| ${row.companyId} | ${escapeMarkdownCell(row.companyName)} | ${row.articleCount} |`,
  );
}

function formatWebsiteRows(rows: WebsiteCompanyCount[]): string[] {
  if (rows.length === 0) {
    return ["| No rows | 0 |"];
  }

  return rows.map((row) => `| ${row.companyId} | ${row.websiteCount} |`);
}

function formatStatusRows(rows: StatusCount[]): string[] {
  if (rows.length === 0) {
    return ["- No status rows seen."];
  }

  return rows.map((row) => `- ${row.status}: ${row.rowCount}`);
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", "\\|");
}

async function writeMarkdown(
  markdownPath: string,
  result: InventoryResult,
): Promise<void> {
  await mkdir(path.dirname(markdownPath), { recursive: true });
  await writeFile(markdownPath, renderMarkdownReport(result), "utf8");
}

async function appendIssueLog(
  issueLogPath: string,
  result: InventoryResult,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  const runner = env.USER ?? env.LOGNAME ?? os.userInfo().username;
  const section = [
    "",
    `## ${result.json.generatedAt} Pre-redesign DB inventory`,
    "",
    "**Operation type**: SELECT",
    "**Scope**: Issue #55 / P0.5-1 production Supabase inventory",
    `**Runner**: ${runner}`,
    "**Result**: Script completed and emitted JSON plus markdown report.",
    "",
    "**Commands**:",
    "",
    ...Object.entries(INVENTORY_SELECT_QUERIES).map(
      ([name, sql]) => `### ${name}\n\n\`\`\`sql\n${sql.trim()}\n\`\`\`\n`,
    ),
  ].join("\n");

  await appendFile(issueLogPath, `${section}\n`, "utf8");
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  void main();
}
