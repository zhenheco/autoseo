import { beforeEach, describe, expect, it, vi } from "vitest";

type AuthMode = "authorized" | "unauthorized";

const authState = vi.hoisted(() => ({
  mode: "authorized" as AuthMode,
  supabase: null as unknown,
}));

vi.mock("@/lib/api/auth-middleware", () => ({
  withCompany: vi.fn(
    (handler) =>
      async (request: Request, ...args: unknown[]) => {
        if (authState.mode === "unauthorized") {
          return Response.json(
            { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
            { status: 401 },
          );
        }

        return handler(
          request,
          {
            user: { id: "user-1" },
            companyId: "company-1",
            supabase: authState.supabase,
          },
          ...args,
        );
      },
  ),
}));

function params(issueId = "issue-1") {
  return {
    params: Promise.resolve({ issueId }),
  };
}

async function post(issueId = "issue-1") {
  const { POST } = await import("../route");
  return POST(
    new Request(`https://1wayseo.com/api/audit/issues/${issueId}/apply`, {
      method: "POST",
    }) as never,
    params(issueId),
  );
}

describe("POST /api/audit/issues/[issueId]/apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    authState.mode = "authorized";
    authState.supabase = {};
  });

  it("returns 401 when the user is not authenticated", async () => {
    authState.mode = "unauthorized";

    const response = await post();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "Unauthorized",
    });
  });
});
