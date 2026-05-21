import { describe, expect, it } from "vitest";

import { createCodeChallenge, generatePkcePair } from "./oauth";

describe("X OAuth PKCE helpers", () => {
  it("generates an RFC 7636 S256 verifier/challenge pair", async () => {
    const pair = await generatePkcePair();

    expect(pair.codeVerifier).toMatch(/^[A-Za-z0-9_-]{86}$/);
    expect(pair.codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pair.codeVerifier).not.toContain("=");
    expect(pair.codeChallenge).not.toContain("=");
    await expect(createCodeChallenge(pair.codeVerifier)).resolves.toBe(
      pair.codeChallenge,
    );
  });
});
