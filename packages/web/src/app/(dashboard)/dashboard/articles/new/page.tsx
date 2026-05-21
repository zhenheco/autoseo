import { headers } from "next/headers";
import { resolveActiveBrandFromCandidates } from "@/lib/brands/active-brand";
import { fetchBrandsFromApi } from "@/lib/brands/server-api";
import { ArticleGenerationWizardClient } from "./components/ArticleGenerationWizardClient";

type NewArticlePageProps = {
  searchParams?: Promise<NewArticleSearchParams>;
};

type NewArticleSearchParams = {
  brand?: string;
  topic?: string;
  trend?: string;
};

export const dynamic = "force-dynamic";

export default async function NewArticlePage({
  searchParams,
}: NewArticlePageProps) {
  const [brands, params, headerStore] = await Promise.all([
    fetchBrandsFromApi(),
    searchParams ?? Promise.resolve<NewArticleSearchParams>({}),
    headers(),
  ]);

  const requestUrl = new URL("https://dashboard.local/dashboard/articles/new");
  if (params.brand) {
    requestUrl.searchParams.set("brand", params.brand);
  }

  const activeBrand = resolveActiveBrandFromCandidates(
    new Request(requestUrl, {
      headers: {
        cookie: headerStore.get("cookie") ?? "",
      },
    }),
    brands,
  );

  return (
    <ArticleGenerationWizardClient
      brands={brands.map((brand) => ({ id: brand.id, name: brand.name }))}
      activeBrandId={activeBrand?.id ?? null}
      initialTopic={params.topic ?? null}
      initialTrendSignalId={params.trend ?? null}
    />
  );
}
