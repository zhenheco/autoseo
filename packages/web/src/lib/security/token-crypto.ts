export interface TokenCrypto {
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
}

const AES_GCM_IV_BYTES = 12;
const AES_GCM_KEY_BYTES = 32;
const AES_GCM_TAG_BYTES = 16;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function getWebCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API is required for token encryption");
  }

  return globalThis.crypto;
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function fromHex(value: string, label: string) {
  if (value.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(value)) {
    throw new Error(`Invalid ${label} hex encoding`);
  }

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

export function createTokenCrypto(masterKey: Uint8Array): TokenCrypto {
  if (masterKey.byteLength !== AES_GCM_KEY_BYTES) {
    throw new Error("Token crypto master key must be 32 bytes");
  }

  const keyBytes = new Uint8Array(masterKey);
  const cryptoKey = getWebCrypto().subtle.importKey(
    "raw",
    keyBytes,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );

  return {
    async encrypt(plaintext: string) {
      const crypto = getWebCrypto();
      const iv = new Uint8Array(AES_GCM_IV_BYTES);
      crypto.getRandomValues(iv);

      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        await cryptoKey,
        textEncoder.encode(plaintext),
      );
      const ciphertext = new Uint8Array(encrypted);

      return `${toHex(iv)}:${toHex(ciphertext)}`;
    },

    async decrypt(ciphertext: string) {
      const parts = ciphertext.split(":");
      if (parts.length !== 2) {
        throw new Error("Invalid token ciphertext format");
      }

      const [ivHex, ciphertextHex] = parts;
      const iv = fromHex(ivHex, "IV");
      const encrypted = fromHex(ciphertextHex, "ciphertext");

      if (iv.byteLength !== AES_GCM_IV_BYTES) {
        throw new Error("Invalid token ciphertext IV length");
      }

      if (encrypted.byteLength < AES_GCM_TAG_BYTES) {
        throw new Error("Invalid token ciphertext length");
      }

      const decrypted = await getWebCrypto().subtle.decrypt(
        { name: "AES-GCM", iv },
        await cryptoKey,
        encrypted,
      );

      return textDecoder.decode(decrypted);
    },
  };
}
