import type { AuditIssue } from "./types";

const SEVERITY_WEIGHT: Record<AuditIssue["severity"], number> = {
  critical: 10,
  warning: 5,
  info: 0,
};

export function scoreHealth(issues: AuditIssue[]): number {
  const total = issues.reduce(
    (acc, issue) => acc + SEVERITY_WEIGHT[issue.severity],
    0,
  );
  return Math.max(0, 100 - total);
}
