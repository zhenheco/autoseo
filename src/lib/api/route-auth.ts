import type { NextRequest, NextResponse } from "next/server";
import {
  ERROR_CODES,
  errorResponse,
  HTTP_STATUS,
  unauthorized,
} from "./response-helpers";
import {
  withAdmin,
  withAuth,
  withCompany,
  type AdminAuthContext,
  type AuthContext,
  type CompanyAuthContext,
} from "./auth-middleware";

export type RouteAuthMode =
  | "public"
  | "public-read"
  | "webhook"
  | "authenticated"
  | "company"
  | "admin"
  | "cron";

export interface RouteAuthOptions {
  cronSecret?: string | null;
}

export interface PublicRouteAuthContext {
  authMode: "public";
}

export interface PublicReadRouteAuthContext {
  authMode: "public-read";
}

export interface WebhookRouteAuthContext {
  authMode: "webhook";
}

export type AuthenticatedRouteAuthContext = AuthContext & {
  authMode: "authenticated";
};

export type CompanyRouteAuthContext = CompanyAuthContext & {
  authMode: "company";
};

export type AdminRouteAuthContext = AdminAuthContext & {
  authMode: "admin";
};

export interface CronRouteAuthContext {
  authMode: "cron";
}

export type RouteAuthContextByMode<TMode extends RouteAuthMode> =
  TMode extends "public"
    ? PublicRouteAuthContext
    : TMode extends "public-read"
      ? PublicReadRouteAuthContext
      : TMode extends "webhook"
        ? WebhookRouteAuthContext
        : TMode extends "authenticated"
          ? AuthenticatedRouteAuthContext
          : TMode extends "company"
            ? CompanyRouteAuthContext
            : TMode extends "admin"
              ? AdminRouteAuthContext
              : CronRouteAuthContext;

export type RouteAuthHandler<
  TMode extends RouteAuthMode,
  TArgs extends unknown[] = [],
> = (
  request: NextRequest,
  context: RouteAuthContextByMode<TMode>,
  ...args: TArgs
) => Promise<NextResponse> | NextResponse;

export function withRouteAuth<
  TMode extends RouteAuthMode,
  TArgs extends unknown[] = [],
>(
  mode: TMode,
  handler: RouteAuthHandler<TMode, TArgs>,
  options: RouteAuthOptions = {},
): (request: NextRequest, ...args: TArgs) => Promise<NextResponse> {
  if (mode === "public") {
    return async (request, ...args) =>
      handler(
        request,
        {
          authMode: "public",
        } as RouteAuthContextByMode<TMode>,
        ...args,
      );
  }

  if (mode === "public-read") {
    return async (request, ...args) =>
      handler(
        request,
        {
          authMode: "public-read",
        } as RouteAuthContextByMode<TMode>,
        ...args,
      );
  }

  if (mode === "webhook") {
    return async (request, ...args) =>
      handler(
        request,
        {
          authMode: "webhook",
        } as RouteAuthContextByMode<TMode>,
        ...args,
      );
  }

  if (mode === "authenticated") {
    return withAuth<AuthContext, TArgs>(async (request, context, ...args) =>
      handler(
        request,
        {
          ...context,
          authMode: "authenticated",
        } as RouteAuthContextByMode<TMode>,
        ...args,
      ),
    );
  }

  if (mode === "company") {
    return withCompany<TArgs>(async (request, context, ...args) =>
      handler(
        request,
        {
          ...context,
          authMode: "company",
        } as RouteAuthContextByMode<TMode>,
        ...args,
      ),
    );
  }

  if (mode === "cron") {
    return async (request, ...args) => {
      const cronSecret = options.cronSecret ?? process.env.CRON_SECRET;
      if (!cronSecret) {
        return errorResponse(
          "Cron secret is not configured",
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          ERROR_CODES.SERVICE_UNAVAILABLE,
        );
      }

      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        return unauthorized("Invalid cron secret");
      }

      return handler(
        request,
        {
          authMode: "cron",
        } as RouteAuthContextByMode<TMode>,
        ...args,
      );
    };
  }

  return withAdmin<TArgs>(async (request, context, ...args) =>
    handler(
      request,
      {
        ...context,
        authMode: "admin",
      } as RouteAuthContextByMode<TMode>,
      ...args,
    ),
  );
}
