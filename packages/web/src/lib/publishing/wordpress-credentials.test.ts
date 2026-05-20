import { describe, expect, it, vi } from "vitest";
import { resolveWordPressApplicationPassword } from "./wordpress-credentials";

describe("resolveWordPressApplicationPassword", () => {
  it("returns an empty password when no stored value exists", () => {
    expect(resolveWordPressApplicationPassword(null)).toBe("");
    expect(resolveWordPressApplicationPassword(undefined)).toBe("");
  });

  it("keeps legacy plaintext passwords", () => {
    const decrypt = vi.fn();

    expect(
      resolveWordPressApplicationPassword("plain-password", {
        isEncrypted: () => false,
        decrypt,
      }),
    ).toBe("plain-password");
    expect(decrypt).not.toHaveBeenCalled();
  });

  it("decrypts encrypted WordPress passwords", () => {
    const decrypt = vi.fn(() => "decrypted-password");

    expect(
      resolveWordPressApplicationPassword("iv:tag:data", {
        isEncrypted: () => true,
        decrypt,
      }),
    ).toBe("decrypted-password");
    expect(decrypt).toHaveBeenCalledWith("iv:tag:data");
  });
});
