#!/usr/bin/env tsx

import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { AIClient } from "../../src/lib/ai/ai-client";
import { createBrandMemoryStore } from "../../src/lib/brands/memory-store";
import {
  createSelfOptimizer,
  type SelfOptimizer,
} from "../../src/lib/optimization/self-optimizer";

type SelfOptimizeLogger = Pick<typeof console, "error" | "log" | "warn">;

export type SelfOptimizeJobDeps = {
  optimizer: SelfOptimizer;
  logger?: SelfOptimizeLogger;
};

export async function runSelfOptimize(
  deps = createProductionDeps(),
): Promise<Awaited<ReturnType<SelfOptimizer["optimizeAll"]>>> {
  const logger = deps.logger ?? console;
  const results = await deps.optimizer.optimizeAll();

  logger.log("[Self Optimize] Complete", {
    processed: results.length,
    metricsUpdated: results.reduce(
      (total, result) => total + result.metricsUpdated,
      0,
    ),
    coldStart: results.filter((result) => result.coldStart).length,
  });

  return results;
}

function createProductionDeps(): SelfOptimizeJobDeps {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return {
    optimizer: createSelfOptimizer({
      supabase: supabase as never,
      brandMemoryStore: createBrandMemoryStore({ supabase: supabase as never }),
      llm: new AIClient({
        deepseekApiKey: process.env.DEEPSEEK_API_KEY,
        openaiApiKey: process.env.OPENAI_API_KEY,
      }),
    }),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runSelfOptimize().catch((error) => {
    console.error("[Self Optimize] Fatal error", error);
    process.exitCode = 1;
  });
}
