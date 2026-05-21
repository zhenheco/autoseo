export type EdgeRule =
  | { type: "meta-description"; value: string }
  | { type: "og-image"; value: string }
  | { type: "og-title"; value: string }
  | { type: "canonical"; value: string }
  | { type: "structured-data-jsonld"; value: string };

export interface PushEdgeRuleInput {
  shopDomain: string;
  path: string;
  rules: EdgeRule[];
}

export interface PushEdgeRuleDeps {
  kvPut: (key: string, value: string) => Promise<void>;
  kvGet: (key: string) => Promise<string | null>;
  now?: () => Date;
}

interface CloudflareKvEnv {
  [key: string]: string | undefined;
  CF_API_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
  EDGE_RULES_NAMESPACE_ID?: string;
}

export interface PushEdgeRuleResult {
  key: string;
  ruleCount: number;
}

export async function pushEdgeRule(
  input: PushEdgeRuleInput,
  deps: PushEdgeRuleDeps,
): Promise<PushEdgeRuleResult> {
  const merged = await mergeEdgeRule(input, deps);
  const updatedAt = (deps.now?.() ?? new Date()).toISOString();

  await deps.kvPut(
    merged.key,
    JSON.stringify({
      rules: merged.rules,
      updated_at: updatedAt,
    }),
  );

  return {
    key: merged.key,
    ruleCount: merged.rules.length,
  };
}

export async function mergeEdgeRule(
  input: PushEdgeRuleInput,
  deps: Pick<PushEdgeRuleDeps, "kvGet">,
): Promise<{ key: string; rules: EdgeRule[]; ruleCount: number }> {
  const key = edgeRuleKey(input);
  const existingValue = await deps.kvGet(key);
  const existingRules = parseStoredRules(existingValue);
  const rules = mergeRules(existingRules, input.rules);

  return {
    key,
    rules,
    ruleCount: rules.length,
  };
}

export function createCloudflareKvDeps(
  env: CloudflareKvEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): PushEdgeRuleDeps {
  const apiToken = requiredEnv(env.CF_API_TOKEN, "CF_API_TOKEN");
  const accountId = requiredEnv(env.CF_ACCOUNT_ID, "CF_ACCOUNT_ID");
  const namespaceId = requiredEnv(
    env.EDGE_RULES_NAMESPACE_ID,
    "EDGE_RULES_NAMESPACE_ID",
  );
  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values`;

  return {
    kvGet: async (key) => {
      const response = await fetchImpl(`${baseUrl}/${encodeURIComponent(key)}`, {
        headers: {
          authorization: `Bearer ${apiToken}`,
        },
      });

      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`cloudflare_kv_get_failed:${response.status}`);
      }

      return response.text();
    },
    kvPut: async (key, value) => {
      const response = await fetchImpl(`${baseUrl}/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
        },
        body: value,
      });

      if (!response.ok) {
        throw new Error(`cloudflare_kv_put_failed:${response.status}`);
      }
    },
  };
}

function edgeRuleKey(input: PushEdgeRuleInput) {
  return `${normalizeShopDomain(input.shopDomain)}:${normalizePath(input.path)}`;
}

function normalizeShopDomain(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) throw new Error("edge_rule_shop_domain_required");

  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`)
      .hostname;
  } catch {
    throw new Error("edge_rule_shop_domain_invalid");
  }
}

function normalizePath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("edge_rule_path_required");
  if (trimmed === "*") return "*";

  try {
    const url = new URL(trimmed);
    return url.pathname || "/";
  } catch {
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }
}

function parseStoredRules(value: string | null): EdgeRule[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.filter(isEdgeRule);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      Array.isArray((parsed as { rules?: unknown }).rules)
    ) {
      return (parsed as { rules: unknown[] }).rules.filter(isEdgeRule);
    }
  } catch {
    return [];
  }

  return [];
}

function mergeRules(existingRules: EdgeRule[], incomingRules: EdgeRule[]) {
  const merged = [...existingRules];

  for (const incomingRule of incomingRules.filter(isEdgeRule)) {
    const existingIndex = merged.findIndex(
      (rule) => rule.type === incomingRule.type,
    );

    if (existingIndex >= 0) {
      merged[existingIndex] = incomingRule;
    } else {
      merged.push(incomingRule);
    }
  }

  return merged;
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

function requiredEnv(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name}_required`);
  return value;
}
