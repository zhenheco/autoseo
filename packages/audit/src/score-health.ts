import type { AuditIssue } from "./types";

export function scoreHealth(_issues: AuditIssue[]): number {
  return 100;
}
