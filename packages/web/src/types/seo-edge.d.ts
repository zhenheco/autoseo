declare module "@seo/edge" {
  export function generateCards(
    input: {
      articleId: string;
      brandId: string;
      companyId?: string;
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
      quotaEnforcer?: {
        canConsume(
          companyId: string,
          resource: "cards",
          amount: number,
        ): Promise<{
          allowed: boolean;
          used: number;
          cap: number;
          remaining: number;
          plan: string;
          resource: string;
        }>;
        consume(
          companyId: string,
          resource: "cards",
          amount: number,
        ): Promise<{
          allowed: boolean;
          used: number;
          cap: number;
          remaining: number;
          plan: string;
          resource: string;
        }>;
      };
      captureCardQuotaWarning?: (warning: {
        companyId: string;
        used: number;
        cap: number;
        plan: string;
        threshold: number;
      }) => void | Promise<void>;
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
