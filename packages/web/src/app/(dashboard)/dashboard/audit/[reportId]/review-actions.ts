"use server";

import { getUser } from "@shared/auth";

type ActionResult = { ok: boolean; error?: string };

export async function approveAuditIssue(
  _formData: FormData,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  return { ok: false, error: "not_implemented" };
}

export async function rejectAuditIssue(
  _formData: FormData,
): Promise<ActionResult> {
  return { ok: false, error: "not_implemented" };
}

export async function editAndApplyAuditIssue(
  _formData: FormData,
): Promise<ActionResult> {
  return { ok: false, error: "not_implemented" };
}

export async function bulkApproveAuditIssues(_formData: FormData): Promise<{
  ok: boolean;
  results: Array<{ issueId: string; ok: boolean; error?: string }>;
}> {
  return { ok: false, results: [] };
}
