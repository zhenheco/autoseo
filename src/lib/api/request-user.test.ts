import { describe, expect, it, vi } from "vitest";
import { resolveRequestUser } from "./request-user";

describe("resolveRequestUser", () => {
  it("resolves bearer token users through the anon Supabase client", async () => {
    const authGetUser = vi.fn(async () => ({
      data: {
        user: {
          id: "user-1",
          email: "user@example.com",
        },
      },
      error: null,
    }));
    const createSupabaseClient = vi.fn(() => ({
      auth: {
        getUser: authGetUser,
      },
    }));
    const createCookieClient = vi.fn();

    const result = await resolveRequestUser(
      {
        headers: new Headers({ authorization: "Bearer token-1" }),
      },
      {
        createCookieClient,
        createSupabaseClient,
        env: {
          NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        },
      },
    );

    expect(result).toEqual({
      success: true,
      user: {
        id: "user-1",
        email: "user@example.com",
      },
    });
    expect(createSupabaseClient).toHaveBeenCalledWith(
      "https://supabase.test",
      "anon-key",
    );
    expect(authGetUser).toHaveBeenCalledWith("token-1");
    expect(createCookieClient).not.toHaveBeenCalled();
  });

  it("returns the legacy invalid token response", async () => {
    const result = await resolveRequestUser(
      {
        headers: new Headers({ authorization: "Bearer bad-token" }),
      },
      {
        createCookieClient: vi.fn(),
        createSupabaseClient: vi.fn(() => ({
          auth: {
            getUser: vi.fn(async () => ({
              data: {
                user: null,
              },
              error: {
                message: "JWT expired",
              },
            })),
          },
        })),
        env: {
          NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        },
      },
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(401);
      await expect(result.response.json()).resolves.toEqual({
        error: "Invalid token",
        details: "JWT expired",
      });
    }
  });

  it("falls back to the cookie Supabase client", async () => {
    const createCookieClient = vi.fn(async () => ({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: "cookie-user",
            },
          },
        })),
      },
    }));

    const result = await resolveRequestUser(
      {
        headers: new Headers(),
      },
      {
        createCookieClient,
        createSupabaseClient: vi.fn(),
        env: {},
      },
    );

    expect(result).toEqual({
      success: true,
      user: {
        id: "cookie-user",
      },
    });
  });

  it("treats a missing headers object as cookie auth", async () => {
    const createCookieClient = vi.fn(async () => ({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: "cookie-user",
            },
          },
        })),
      },
    }));

    const result = await resolveRequestUser(
      {},
      {
        createCookieClient,
        createSupabaseClient: vi.fn(),
        env: {},
      },
    );

    expect(result).toEqual({
      success: true,
      user: {
        id: "cookie-user",
      },
    });
  });

  it("returns the legacy unauthorized response when no user is present", async () => {
    const result = await resolveRequestUser(
      {
        headers: new Headers(),
      },
      {
        createCookieClient: vi.fn(async () => ({
          auth: {
            getUser: vi.fn(async () => ({
              data: {
                user: null,
              },
            })),
          },
        })),
        createSupabaseClient: vi.fn(),
        env: {},
      },
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(401);
      await expect(result.response.json()).resolves.toEqual({
        error: "Unauthorized",
      });
    }
  });
});
