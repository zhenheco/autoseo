import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "../route";

function request(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest;
}

function context(token = "invite-token") {
  return { params: Promise.resolve({ token }) };
}

describe("public SHOPLINE invitation install route", () => {
  it("returns missing_shop_handle when shopHandle is absent", async () => {
    const resp = await GET(
      request("https://1wayseo.com/api/connect/shopline/invite-token/install"),
      context(),
    );

    expect(resp.status).toBe(400);
    await expect(resp.json()).resolves.toEqual({
      error: "missing_shop_handle",
    });
  });

  it("returns invalid_shop_handle when shopHandle cannot be normalized", async () => {
    const resp = await GET(
      request(
        "https://1wayseo.com/api/connect/shopline/invite-token/install?shopHandle=bad%20shop",
      ),
      context(),
    );

    expect(resp.status).toBe(400);
    await expect(resp.json()).resolves.toEqual({
      error: "invalid_shop_handle",
    });
  });
});
