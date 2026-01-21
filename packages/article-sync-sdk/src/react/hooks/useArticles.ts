/**
 * useArticles Hook
 * 用於在 React 組件中取得文章列表
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { SyncClient } from "../../core/client";
import type {
  SyncClientConfig,
  UseArticlesOptions,
  UseArticlesResult,
  SyncedArticleListItem,
} from "../../core/types";

/**
 * useArticles Hook
 *
 * @example
 * ```tsx
 * const { articles, isLoading, error } = useArticles(config, {
 *   limit: 10,
 *   language: 'zh-TW',
 * });
 * ```
 */
export function useArticles(
  config: SyncClientConfig,
  options: UseArticlesOptions = {}
): UseArticlesResult {
  const {
    limit = 10,
    offset = 0,
    language,
    category,
    tag,
    sortBy = "published_at",
    sortOrder = "desc",
    enabled = true,
  } = options;

  const [articles, setArticles] = useState<SyncedArticleListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchArticles = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const client = new SyncClient(config);
      const response = await client.getArticles({
        limit,
        offset,
        language,
        category,
        tag,
        sortBy,
        sortOrder,
      });

      setArticles(response.articles);
      setTotal(response.total);
      setHasMore(response.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [
    config.supabaseUrl,
    config.supabaseKey,
    config.tableName,
    limit,
    offset,
    language,
    category,
    tag,
    sortBy,
    sortOrder,
    enabled,
  ]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  return {
    articles,
    total,
    isLoading,
    error,
    hasMore,
    refetch: fetchArticles,
  };
}
