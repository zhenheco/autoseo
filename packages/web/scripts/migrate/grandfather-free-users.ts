#!/usr/bin/env tsx
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "pg";
import { sendGrandfatherFreeUserTrialEmail } from "../../src/lib/email/cf-email-client";

export interface GrandfatherDbClient {
  connect?(): Promise<void>;
  query<T extends Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
  end(): Promise<void>;
}

export type GrandfatherEmailSender = (input: {
  to: string;
  companyName: string;
  trialEndsAt: string;
  idempotencyKey: string;
}) => Promise<{ ok: boolean; messageId?: string; error?: string }>;

interface CandidateRow {
  subscriptionId: string;
  companyId: string;
  companyName: string;
  ownerEmail: string;
  status: string;
  trialEndsAt: string | null;
  lastActivityAt: string;
}

interface ProcessedRow extends CandidateRow {
  result: "sent" | "skipped" | "failed";
  messageId?: string;
  error?: string;
  newTrialEndsAt?: string;
}

export interface GrandfatherRunResult {
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  blocked: boolean;
  reportPath?: string;
  rows: ProcessedRow[];
}

interface RunOptions {
  client?: GrandfatherDbClient;
  sendEmail?: GrandfatherEmailSender;
  writeReport?: (path: string, markdown: string) => Promise<void>;
  reportPath?: string;
  now?: () => Date;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
  maxCandidates?: number;
}

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

const defaultReportPath = path.join(
  repoRoot,
  "docs/archive/2026-05-21-pre-redesign/free-user-grandfather.md",
);

export const GRANDFATHER_SELECT_SQL = `
SELECT
  cs.id::text AS "subscriptionId",
  cs.company_id::text AS "companyId",
  COALESCE(c.name, cs.company_id::text) AS "companyName",
  au.email::text AS "ownerEmail",
  cs.status::text AS status,
  cs.trial_ends_at::text AS "trialEndsAt",
  MAX(aj.created_at)::text AS "lastActivityAt"
FROM company_subscriptions cs
JOIN subscription_plans sp ON sp.id = cs.plan_id
JOIN companies c ON c.id = cs.company_id
LEFT JOIN auth.users au ON au.id = c.owner_id
JOIN article_jobs aj ON aj.company_id = cs.company_id
WHERE sp.slug = 'free'
  AND cs.status = 'active'
  AND aj.created_at >= NOW() - INTERVAL '30 days'
  AND au.email IS NOT NULL
GROUP BY cs.id, cs.company_id, c.name, au.email, cs.status, cs.trial_ends_at
ORDER BY MAX(aj.created_at) DESC, cs.company_id::text ASC;
`;

const GRANDFATHER_UPDATE_SQL = `
UPDATE company_subscriptions
SET
  status = 'grandfather_trial',
  trial_ends_at = $2::timestamptz,
  updated_at = NOW()
WHERE id = $1::uuid
  AND status = 'active';
`;

export async function runGrandfatherFreeUsers(
  options: RunOptions = {},
): Promise<GrandfatherRunResult> {
  const stdout = options.stdout ?? ((message) => process.stdout.write(message));
  const stderr = options.stderr ?? ((message) => process.stderr.write(message));
  const now = options.now?.() ?? new Date();
  const trialEndsAt = addDays(now, 30);
  const trialEndsIso = trialEndsAt.toISOString();
  const trialEndsDate = trialEndsIso.slice(0, 10);
  const reportPath = options.reportPath ?? defaultReportPath;
  const reportWriter = options.writeReport ?? writeReportFile;
  const maxCandidates = options.maxCandidates ?? 10;

  const ownsClient = !options.client;
  const client = options.client ?? createPgClient();
  const sendEmail = options.sendEmail ?? sendGrandfatherFreeUserTrialEmail;

  try {
    if (ownsClient && client.connect) {
      await client.connect();
    }

    const { rows } = await client.query<CandidateRow>(GRANDFATHER_SELECT_SQL);
    const processed: ProcessedRow[] = [];

    if (rows.length > maxCandidates) {
      const result: GrandfatherRunResult = {
        scanned: rows.length,
        sent: 0,
        skipped: rows.length,
        failed: 0,
        blocked: true,
        reportPath,
        rows: rows.map((row) => ({
          ...row,
          result: "skipped",
          error: `candidate_count_exceeds_${maxCandidates}`,
        })),
      };
      await reportWriter(reportPath, renderReport(result, now));
      stderr(
        `[grandfather] Found ${rows.length} candidates; Path 1 is capped at ${maxCandidates}. Open the Path 2 follow-up before running updates.\n`,
      );
      return result;
    }

    for (const row of rows) {
      const idempotencyKey = `grandfather-free-users:${row.subscriptionId}`;
      const email = await sendEmail({
        to: row.ownerEmail,
        companyName: row.companyName,
        trialEndsAt: trialEndsDate,
        idempotencyKey,
      });

      if (!email.ok) {
        processed.push({
          ...row,
          result: "failed",
          error: email.error ?? "email_send_failed",
        });
        continue;
      }

      await client.query(GRANDFATHER_UPDATE_SQL, [
        row.subscriptionId,
        trialEndsIso,
      ]);
      processed.push({
        ...row,
        result: "sent",
        messageId: email.messageId,
        newTrialEndsAt: trialEndsIso,
      });
    }

    const result: GrandfatherRunResult = {
      scanned: rows.length,
      sent: processed.filter((row) => row.result === "sent").length,
      skipped: processed.filter((row) => row.result === "skipped").length,
      failed: processed.filter((row) => row.result === "failed").length,
      blocked: false,
      reportPath,
      rows: processed,
    };

    await reportWriter(reportPath, renderReport(result, now));
    stdout(
      `[grandfather] scanned=${result.scanned} sent=${result.sent} failed=${result.failed} report=${reportPath}\n`,
    );
    return result;
  } finally {
    if (ownsClient) {
      await client.end();
    }
  }
}

function createPgClient(): GrandfatherDbClient {
  const databaseUrl = process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    throw new Error("SUPABASE_DB_URL is required");
  }

  return new Client({ connectionString: databaseUrl });
}

async function writeReportFile(reportPath: string, markdown: string) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, markdown, "utf8");
}

function renderReport(result: GrandfatherRunResult, generatedAt: Date) {
  const lines = [
    "# Legacy Plan Grandfather Report",
    "",
    `Generated at: ${generatedAt.toISOString()}`,
    "",
    "## Summary",
    "",
    `- Scanned: ${result.scanned}`,
    `- Sent: ${result.sent}`,
    `- Skipped: ${result.skipped}`,
    `- Failed: ${result.failed}`,
    `- Blocked: ${result.blocked ? "yes" : "no"}`,
    "",
    "## Rows",
    "",
    "| company_id | company_name | owner_email | result | trial_ends_at | message_id | error |",
    "|---|---|---|---|---|---|---|",
  ];

  for (const row of result.rows) {
    lines.push(
      [
        row.companyId,
        escapeTableCell(row.companyName),
        maskEmail(row.ownerEmail),
        row.result,
        row.newTrialEndsAt ?? row.trialEndsAt ?? "",
        row.messageId ?? "",
        row.error ?? "",
      ].join(" | "),
    );
  }

  return `${lines.join("\n")}\n`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  const prefix = local.slice(0, 2);
  return `${prefix}${"*".repeat(Math.max(local.length - 2, 2))}@${domain}`;
}

function escapeTableCell(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export async function main() {
  try {
    const result = await runGrandfatherFreeUsers();
    process.exitCode = result.blocked || result.failed > 0 ? 1 : 0;
  } catch (error) {
    console.error(
      `[grandfather] ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void main();
}
