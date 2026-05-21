import {
  createTokenCrypto,
  type TokenCrypto,
} from "@/lib/security/token-crypto";

function decodeMasterKey(value: string): Uint8Array {
  const trimmed = value.trim();

  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    return new Uint8Array(Buffer.from(trimmed, "hex"));
  }

  try {
    const normalized = trimmed
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(trimmed.length / 4) * 4, "=");
    const decoded = Buffer.from(normalized, "base64");
    if (decoded.byteLength === 32) {
      return new Uint8Array(decoded);
    }
  } catch {
    // Fall through to UTF-8 validation.
  }

  const utf8 = Buffer.from(trimmed, "utf8");
  if (utf8.byteLength === 32) {
    return new Uint8Array(utf8);
  }

  throw new Error("SOCIAL_TOKEN_MASTER_KEY must decode to 32 bytes");
}

export function getSocialTokenCrypto(): TokenCrypto {
  const masterKey = process.env.SOCIAL_TOKEN_MASTER_KEY;
  if (!masterKey || masterKey.startsWith("op://")) {
    throw new Error("SOCIAL_TOKEN_MASTER_KEY is not configured");
  }

  return createTokenCrypto(decodeMasterKey(masterKey));
}
