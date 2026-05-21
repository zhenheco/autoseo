import {
  pushEdgeRule,
  type EdgeRule,
  type PushEdgeRuleDeps,
} from "./push-edge-rule";
import type { AuditIssue } from "./types";

export interface ApplyEdgeFixInput {
  issue: AuditIssue;
  shopDomain: string;
  path: string;
}

export interface ApplyEdgeFixResult {
  ok: boolean;
  route: "edge-worker";
  before: string;
  after: string;
  error?: string;
}

export async function applyAuditFixToEdgeWorker(
  input: ApplyEdgeFixInput,
  deps: PushEdgeRuleDeps,
): Promise<ApplyEdgeFixResult> {
  const rule = toEdgeRule(input.issue);
  if (!rule) {
    return failure(input.issue.current, "", "rule_not_supported");
  }

  try {
    await pushEdgeRule(
      {
        shopDomain: input.shopDomain,
        path: input.path,
        rules: [rule],
      },
      deps,
    );

    return {
      ok: true,
      route: "edge-worker",
      before: input.issue.current,
      after: JSON.stringify([rule]),
    };
  } catch (error) {
    return failure(input.issue.current, "", errorMessage(error));
  }
}

export function toEdgeRule(issue: AuditIssue): EdgeRule | null {
  const suggested = issue.suggested?.trim();

  switch (issue.ruleId) {
    case "meta.description.tooShort":
    case "meta.description.tooLong":
    case "meta.description.missing":
      return suggested ? { type: "meta-description", value: suggested } : null;
    case "og.image.missing":
      return suggested ? { type: "og-image", value: suggested } : null;
    case "og.title.missing":
    case "og.title.tooShort":
      return suggested ? { type: "og-title", value: suggested } : null;
    case "canonical.missing":
      return {
        type: "canonical",
        value: suggested || issue.page,
      };
    case "structured-data.product.missing":
    case "structured-data-jsonld.missing":
      return suggested
        ? { type: "structured-data-jsonld", value: suggested }
        : null;
    default:
      return null;
  }
}

function failure(
  before: string,
  after: string,
  error: string,
): ApplyEdgeFixResult {
  return {
    ok: false,
    route: "edge-worker",
    before,
    after,
    error,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
