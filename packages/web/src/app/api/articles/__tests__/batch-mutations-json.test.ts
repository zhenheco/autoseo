import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/route-auth", () => ({
  withRouteAuth: vi.fn(
    (_mode, handler) => (request: Request) =>
      handler(request, {
        authMode: "authenticated",
        user: { id: "user-1" },
        supabase: {
          from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn(async () => ({
              data: { company_id: "company-1" },
              error: null,
            })),
          })),
        },
      }),
  ),
}));

vi.mock("@/lib/services/slug-generator", () => ({
  assemblePublishURL: vi.fn(),
  generateAndEnsureUniqueSlug: vi.fn(),
}));

describe("article batch mutation JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    [
      "batch publish",
      "../batch-publish/route",
      "https://example.com/api/articles/batch-publish",
    ],
    [
      "schedule batch publish",
      "../schedule-batch-publish/route",
      "https://example.com/api/articles/schedule-batch-publish",
    ],
    [
      "import batch",
      "../import-batch/route",
      "https://example.com/api/articles/import-batch",
    ],
  ])("returns 400 for empty %s body", async (_name, routePath, url) => {
    const { POST } = await import(routePath);

    const response = await POST(
      new Request(url, {
        method: "POST",
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
      code: "INVALID_JSON",
    });
  });
});
