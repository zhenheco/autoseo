export function checkShoplineScope(
  required: readonly string[],
  granted: readonly string[],
): { ok: true } | { ok: false; missing: string[] } {
  const grantedSet = new Set(granted);
  const missing = required.filter((scope) => !grantedSet.has(scope));

  if (missing.length === 0) {
    return { ok: true };
  }

  return { ok: false, missing };
}
