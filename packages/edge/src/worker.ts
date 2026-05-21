import { applyHtmlRewrites } from "./html-rewriter";
import { readEdgeRules } from "./kv-client";
import type { EdgeRule } from "./html-rewriter";

interface Env {
  EDGE_RULES?: KVNamespace;
  CARD_ASSETS?: R2Bucket;
  BROWSER?: unknown;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const ruleKey = `${url.host}:${url.pathname}`;
    const fallbackKey = `${url.host}:*`;

    const rules = env.EDGE_RULES
      ? ((await readEdgeRules(env.EDGE_RULES, ruleKey)) ??
        (await readEdgeRules(env.EDGE_RULES, fallbackKey)))
      : null;

    const upstream = await fetch(request);
    if (!rules || rules.length === 0) return upstream;

    return applyHtmlRewrites(upstream, rules);
  },
};

export { applyHtmlRewrites };
export type { EdgeRule };
export {
  generateCards,
  CardCapExceededError,
  CardQuotaExceededError,
} from "./cards/generate";
export type {
  BrowserRenderingClient,
  CardQuotaEnforcer,
  CardQuotaResult,
  CardQuotaWarning,
  CardURL,
  GenerateCardsInput,
} from "./cards/generate";
