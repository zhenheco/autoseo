/**
 * useArticle Hook
 * 用於在 React 組件中取得單篇文章
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { SyncClient } from "../../core/client";
import type {
  SyncClientConfig,
  UseArticleOptions,
  UseArticleResult,
  SyncedArticle,
} from "../../core/types";

/**
 * useArticle Hook
 *
 * @example
 * ```tsx
 * const { article, isLoading, error } = useArticle(config, slug);
 * ```
 */
export function useArticle(
  config: SyncClientConfig,
  slug: string,
  options: UseArticleOptions = {}
): UseArticleResult {
  const { enabled = true } = options;

  const [article, setArticle] = useState<SyncedArticle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchArticle = useCallback(async () => {
    if (!enabled || !slug) return;

    setIsLoading(true);
    setError(null);

    try {
      const client = new SyncClient(config);
      const response = await client.getArticleBySlug(slug);
      setArticle(response.article);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [
    config.supabaseUrl,
    config.supabaseKey,
    config.tableName,
    slug,
    enabled,
  ]);

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  return {
    article,
    isLoading,
    error,
    refetch: fetchArticle,
  };
}

/**
 * useArticleBySourceId Hook
 *
 * @example
 * ```tsx
 * const { article, isLoading, error } = useArticleBySourceId(config, sourceId);
 * ```
 */
export function useArticleBySourceId(
  config: SyncClientConfig,
  sourceId: string,
  options: UseArticleOptions = {}
): UseArticleResult {
  const { enabled = true } = options;

  const [article, setArticle] = useState<SyncedArticle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchArticle = useCallback(async () => {
    if (!enabled || !sourceId) return;

    setIsLoading(true);
    setError(null);

    try {
      const client = new SyncClient(config);
      const response = await client.getArticleBySourceId(sourceId);
      setArticle(response.article);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [
    config.supabaseUrl,
    config.supabaseKey,
    config.tableName,
    sourceId,
    enabled,
  ]);

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  return {
    article,
    isLoading,
    error,
    refetch: fetchArticle,
  };
}
