import { headers } from "next/headers";
import { fetchBrandsFromApi } from "@/lib/brands/server-api";
import { resolveActiveBrandFromCandidates } from "@/lib/brands/active-brand";
import { AutomationSettingsClient } from "./AutomationSettingsClient";

type AutomationPageProps = {
  searchParams?: Promise<AutomationSearchParams>;
};

type AutomationSearchParams = {
  brand?: string;
};

export const dynamic = "force-dynamic";

export default async function AutomationPage({
  searchParams,
}: AutomationPageProps) {
  const [brands, params, headerStore] = await Promise.all([
    fetchBrandsFromApi(),
    searchParams ?? Promise.resolve<AutomationSearchParams>({}),
    headers(),
  ]);

  const requestUrl = new URL("https://dashboard.local/dashboard/automation");
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

  if (!activeBrand) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border p-6">
        <h1 className="text-2xl font-semibold tracking-normal">
          Automation settings
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a brand before configuring automation.
        </p>
      </div>
    );
  }

  return <AutomationSettingsClient brand={activeBrand} />;
}
