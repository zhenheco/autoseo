declare module "@seo/edge" {
  export function generateCards(
    input: {
      articleId: string;
      brandId: string;
      formats: Array<"ig_square" | "ig_story" | "og">;
      templates?: Array<"quote" | "stat" | "list" | "hero">;
    },
    deps: {
      fetchArticle(id: string): Promise<{
        id: string;
        title: string;
        [key: string]: unknown;
      }>;
      fetchBrand(id: string): Promise<{
        id: string;
        name: string;
        [key: string]: unknown;
      }>;
      browserRenderingClient: {
        screenshot(input: {
          html: string;
          size: { width: number; height: number };
        }): Promise<ArrayBuffer>;
      };
      r2Bucket: R2Bucket;
    },
  ): Promise<
    Array<{
      template: string;
      format: string;
      size: { width: number; height: number };
      r2Url: string;
    }>
  >;
}
