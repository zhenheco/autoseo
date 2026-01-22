import { S as SyncClientConfig, U as UseArticlesOptions, k as UseArticlesResult, l as UseArticleOptions, m as UseArticleResult } from '../types-BUKyMdyc.mjs';
export { f as SyncedArticle, c as SyncedArticleListItem } from '../types-BUKyMdyc.mjs';

/**
 * useArticles Hook
 * 用於在 React 組件中取得文章列表
 */

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
declare function useArticles(config: SyncClientConfig, options?: UseArticlesOptions): UseArticlesResult;

/**
 * useArticle Hook
 * 用於在 React 組件中取得單篇文章
 */

/**
 * useArticle Hook
 *
 * @example
 * ```tsx
 * const { article, isLoading, error } = useArticle(config, slug);
 * ```
 */
declare function useArticle(config: SyncClientConfig, slug: string, options?: UseArticleOptions): UseArticleResult;
/**
 * useArticleBySourceId Hook
 *
 * @example
 * ```tsx
 * const { article, isLoading, error } = useArticleBySourceId(config, sourceId);
 * ```
 */
declare function useArticleBySourceId(config: SyncClientConfig, sourceId: string, options?: UseArticleOptions): UseArticleResult;

export { UseArticleOptions, UseArticleResult, UseArticlesOptions, UseArticlesResult, useArticle, useArticleBySourceId, useArticles };
