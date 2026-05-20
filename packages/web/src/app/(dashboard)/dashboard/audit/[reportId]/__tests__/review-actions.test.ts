import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
}));

vi.mock("@shared/auth", () => authMocks);

function formData(entries: Record<string, string | string[]> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) {
      for (const item of value) data.append(key, item);
    } else {
      data.set(key, value);
    }
  }
  return data;
}

describe("audit review actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    authMocks.getUser.mockResolvedValue({ id: "user-1" });
  });

  it("approveAuditIssue returns unauthorized when the user is not authenticated", async () => {
    authMocks.getUser.mockResolvedValueOnce(null);
    const { approveAuditIssue } = await import("../review-actions");

    const result = await approveAuditIssue(formData({ issueId: "issue-1" }));

    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });
});
