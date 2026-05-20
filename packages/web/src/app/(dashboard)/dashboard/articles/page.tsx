import { getQuotaStatus } from "./actions";
import { ArticlesClient } from "./articles-client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ website?: string }>;
}

export default async function ArticlesPage({ searchParams }: PageProps) {
  const quotaStatus = await getQuotaStatus();
  const { website: websiteId } = await searchParams;

  return (
    <ArticlesClient quotaStatus={quotaStatus} initialWebsiteId={websiteId} />
  );
}
