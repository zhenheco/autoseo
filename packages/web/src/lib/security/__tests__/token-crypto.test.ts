import { describe, expect, it } from "vitest";
import { createTokenCrypto } from "../token-crypto";

const keyA = new Uint8Array(32).fill(1);
const keyB = new Uint8Array(32).fill(2);

function flipLastCiphertextByte(value: string) {
  const [ivHex, ciphertextHex] = value.split(":");
  expect(ivHex).toBeDefined();
  expect(ciphertextHex).toBeDefined();

  const bytes = ciphertextHex!.match(/.{2}/g) ?? [];
  const lastByte = Number.parseInt(bytes.at(-1)!, 16);
  bytes[bytes.length - 1] = (lastByte ^ 1).toString(16).padStart(2, "0");

  return `${ivHex}:${bytes.join("")}`;
}

describe("token crypto", () => {
  it("round-trips encrypted token payloads", async () => {
    const tokenCrypto = createTokenCrypto(keyA);

    const encrypted = await tokenCrypto.encrypt("oauth-access-token");

    await expect(tokenCrypto.decrypt(encrypted)).resolves.toBe(
      "oauth-access-token",
    );
    expect(encrypted).toMatch(/^[0-9a-f]{24}:[0-9a-f]+$/);
  });

  it("uses a different IV for each encryption", async () => {
    const tokenCrypto = createTokenCrypto(keyA);

    const first = await tokenCrypto.encrypt("same-token");
    const second = await tokenCrypto.encrypt("same-token");

    expect(first).not.toBe(second);
  });

  it("rejects decryption with the wrong key", async () => {
    const encrypted = await createTokenCrypto(keyA).encrypt("token");

    await expect(createTokenCrypto(keyB).decrypt(encrypted)).rejects.toThrow();
  });

  it("rejects tampered ciphertext", async () => {
    const tokenCrypto = createTokenCrypto(keyA);
    const encrypted = await tokenCrypto.encrypt("token");

    await expect(
      tokenCrypto.decrypt(flipLastCiphertextByte(encrypted)),
    ).rejects.toThrow();
  });

  it("validates master key length at construction", () => {
    expect(() => createTokenCrypto(new Uint8Array(31))).toThrow(
      "Token crypto master key must be 32 bytes",
    );
  });
});
