import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authWrappers = vi.hoisted(() => ({
  withAuth: vi.fn(),
  withCompany: vi.fn(),
  withAdmin: vi.fn(),
}));

vi.mock("./auth-middleware", () => authWrappers);

describe("withRouteAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    authWrappers.withAuth.mockImplementation(
      (handler) => async (request: NextRequest) =>
        handler(request, {
          user: { id: "user-1" },
          supabase: "supabase-client",
        }),
    );

    authWrappers.withCompany.mockImplementation(
      (handler) => async (request: NextRequest) =>
        handler(request, {
          user: { id: "user-1" },
          supabase: "supabase-client",
          companyId: "company-1",
        }),
    );

    authWrappers.withAdmin.mockImplementation(
      (handler) => async (request: NextRequest) =>
        handler(request, {
          user: { id: "admin-1" },
          supabase: "supabase-client",
          adminClient: "admin-client",
        }),
    );
  });

  it("runs public handlers without auth middleware", async () => {
    const { withRouteAuth } = await import("./route-auth");

    const route = withRouteAuth("public", async (_request, context) =>
      NextResponse.json(context),
    );

    const response = await route({} as never);

    expect(authWrappers.withAuth).not.toHaveBeenCalled();
    expect(authWrappers.withCompany).not.toHaveBeenCalled();
    expect(authWrappers.withAdmin).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ authMode: "public" });
  });

  it("runs public-read handlers without auth middleware", async () => {
    const { withRouteAuth } = await import("./route-auth");

    const route = withRouteAuth("public-read", async (_request, context) =>
      NextResponse.json(context),
    );

    const response = await route({} as never);

    expect(authWrappers.withAuth).not.toHaveBeenCalled();
    expect(authWrappers.withCompany).not.toHaveBeenCalled();
    expect(authWrappers.withAdmin).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ authMode: "public-read" });
  });

  it("passes route arguments to public-read handlers", async () => {
    const { withRouteAuth } = await import("./route-auth");

    const route = withRouteAuth(
      "public-read",
      async (_request, context, routeContext: { params: { slug: string } }) =>
        NextResponse.json({
          authMode: context.authMode,
          slug: routeContext.params.slug,
        }),
    );

    const response = await route({} as never, {
      params: { slug: "seo-guide" },
    });

    await expect(response.json()).resolves.toEqual({
      authMode: "public-read",
      slug: "seo-guide",
    });
  });

  it("runs webhook handlers without auth middleware", async () => {
    const { withRouteAuth } = await import("./route-auth");

    const route = withRouteAuth("webhook", async (_request, context) =>
      NextResponse.json(context),
    );

    const response = await route({} as never);

    expect(authWrappers.withAuth).not.toHaveBeenCalled();
    expect(authWrappers.withCompany).not.toHaveBeenCalled();
    expect(authWrappers.withAdmin).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ authMode: "webhook" });
  });

  it("routes authenticated handlers through withAuth", async () => {
    const { withRouteAuth } = await import("./route-auth");

    const route = withRouteAuth("authenticated", async (_request, context) =>
      NextResponse.json({
        authMode: context.authMode,
        userId: context.user.id,
      }),
    );

    const response = await route({} as never);

    expect(authWrappers.withAuth).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      authMode: "authenticated",
      userId: "user-1",
    });
  });

  it("routes company handlers through withCompany", async () => {
    const { withRouteAuth } = await import("./route-auth");

    const route = withRouteAuth("company", async (_request, context) =>
      NextResponse.json({
        authMode: context.authMode,
        companyId: context.companyId,
      }),
    );

    const response = await route({} as never);

    expect(authWrappers.withCompany).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      authMode: "company",
      companyId: "company-1",
    });
  });

  it("routes admin handlers through withAdmin", async () => {
    const { withRouteAuth } = await import("./route-auth");

    const route = withRouteAuth("admin", async (_request, context) =>
      NextResponse.json({
        authMode: context.authMode,
        userId: context.user.id,
        hasAdminClient: Boolean(context.adminClient),
      }),
    );

    const response = await route({} as never);

    expect(authWrappers.withAdmin).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      authMode: "admin",
      userId: "admin-1",
      hasAdminClient: true,
    });
  });

  it("rejects cron handlers when cron secret is not configured", async () => {
    const { withRouteAuth } = await import("./route-auth");

    const route = withRouteAuth(
      "cron",
      async () => NextResponse.json({ ok: true }),
      { cronSecret: "" },
    );

    const response = await route({
      headers: new Headers({ authorization: "Bearer cron-secret" }),
    } as never);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("rejects cron handlers when bearer token does not match", async () => {
    const { withRouteAuth } = await import("./route-auth");

    const route = withRouteAuth(
      "cron",
      async () => NextResponse.json({ ok: true }),
      { cronSecret: "cron-secret" },
    );

    const response = await route({
      headers: new Headers({ authorization: "Bearer wrong" }),
    } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "UNAUTHORIZED",
    });
  });

  it("runs cron handlers when bearer token matches", async () => {
    const { withRouteAuth } = await import("./route-auth");

    const route = withRouteAuth(
      "cron",
      async (_request, context) => NextResponse.json(context),
      { cronSecret: "cron-secret" },
    );

    const response = await route({
      headers: new Headers({ authorization: "Bearer cron-secret" }),
    } as never);

    expect(authWrappers.withAuth).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ authMode: "cron" });
  });
});
