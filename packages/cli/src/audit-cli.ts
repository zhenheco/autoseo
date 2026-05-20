#!/usr/bin/env tsx

import { auditWebsite } from "@audit";
import { createAdminClient } from "@shared/supabase";

type Args = Record<string, string | boolean>;

interface RunAuditDeps {
  adminClient?: unknown;
  auditWebsiteFn?: typeof auditWebsite;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (let index = 0; index < argv.length; index++) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;

    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index++;
  }

  return args;
}

function arg(args: Args, name: string): string | undefined {
  const value = args[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function runAudit(
  argv: string[],
  deps: RunAuditDeps = {},
): Promise<void> {
  const args = parseArgs(argv);
  const websiteId = arg(args, "website-id");
  const url = arg(args, "url");

  if (!websiteId && !url) {
    throw new Error("missing required argument: --website-id or --url");
  }

  void (deps.adminClient ?? createAdminClient());
  void (deps.auditWebsiteFn ?? auditWebsite);
}

async function main(): Promise<void> {
  await runAudit(process.argv.slice(2));
}

if (process.argv[1]?.endsWith("audit-cli.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
