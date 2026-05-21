import { describe, expect, it } from "vitest";
import { checkShoplineScope } from "../scope-guard";

describe("checkShoplineScope", () => {
  it("returns ok when granted contains every required scope", () => {
    expect(
      checkShoplineScope(
        ["write_products", "write_content"],
        ["write_products", "write_content"],
      ),
    ).toEqual({ ok: true });
  });

  it("returns one missing scope when granted is missing one required scope", () => {
    expect(
      checkShoplineScope(
        ["write_products", "write_content"],
        ["write_products"],
      ),
    ).toEqual({ ok: false, missing: ["write_content"] });
  });

  it("returns every required scope when granted is empty", () => {
    expect(
      checkShoplineScope(["write_products", "write_content", "write_page"], []),
    ).toEqual({
      ok: false,
      missing: ["write_products", "write_content", "write_page"],
    });
  });

  it("returns ok when granted is a superset of required scopes", () => {
    expect(
      checkShoplineScope(
        ["write_products"],
        ["read_products", "write_products", "write_content"],
      ),
    ).toEqual({ ok: true });
  });
});
