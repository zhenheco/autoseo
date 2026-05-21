import {
  decryptWordPressPassword,
  isEncrypted,
} from "@/lib/security/token-encryption";

interface WordPressPasswordDependencies {
  isEncrypted?: (value: string) => boolean;
  decrypt?: (value: string) => string;
}

export function resolveWordPressApplicationPassword(
  storedPassword: string | null | undefined,
  dependencies: WordPressPasswordDependencies = {},
) {
  if (!storedPassword) {
    return "";
  }

  const checkEncrypted = dependencies.isEncrypted ?? isEncrypted;
  if (!checkEncrypted(storedPassword)) {
    return storedPassword;
  }

  return (dependencies.decrypt ?? decryptWordPressPassword)(storedPassword);
}
