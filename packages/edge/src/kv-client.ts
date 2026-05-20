import type { EdgeRule } from "./html-rewriter";

interface EdgeRulesEnvelope {
  rules: EdgeRule[];
  updated_at?: string;
}

type StoredEdgeRules = EdgeRule[] | EdgeRulesEnvelope;

export async function readEdgeRules(
  namespace: KVNamespace,
  key: string,
): Promise<EdgeRule[] | null> {
  const stored = await namespace.get<StoredEdgeRules>(key, "json");
  if (!stored) return null;

  if (Array.isArray(stored)) {
    return stored.filter(isEdgeRule);
  }

  if (Array.isArray(stored.rules)) {
    return stored.rules.filter(isEdgeRule);
  }

  return null;
}

function isEdgeRule(value: unknown): value is EdgeRule {
  if (typeof value !== "object" || value === null) return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record.type === "string" &&
    typeof record.value === "string" &&
    [
      "meta-description",
      "og-image",
      "og-title",
      "canonical",
      "structured-data-jsonld",
    ].includes(record.type)
  );
}
