import { Button } from "@shared/ui/button";

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams?: Promise<SearchParams> | SearchParams;
};

export const dynamic = "force-dynamic";

export default async function ShoplineAdminPage({
  searchParams,
}: PageProps = {}) {
  const params = await searchParams;
  const shopParam = Array.isArray(params?.shop)
    ? params?.shop[0]
    : params?.shop;
  const shop = shopParam?.trim() || "demo";
  const dashboardUrl = `https://1wayseo.com/dashboard?shop=${encodeURIComponent(shop)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-950">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <img src="/logo.svg" alt="1waySEO" className="h-10 w-auto" />
        <h1 className="mt-6 text-2xl font-semibold tracking-normal">
          1waySEO Connector
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Manage your SEO at 1waySEO Dashboard
        </p>

        <Button asChild size="lg" className="mt-8 w-full">
          <a href={dashboardUrl} target="_top">
            Open 1waySEO Dashboard →
          </a>
        </Button>

        <nav
          aria-label="SHOPLINE connector resources"
          className="mt-5 flex items-center justify-center gap-3 text-sm text-slate-600"
        >
          <a className="underline-offset-4 hover:underline" href="/privacy">
            View Privacy Policy
          </a>
          <span aria-hidden="true" className="text-slate-300">
            /
          </span>
          <a className="underline-offset-4 hover:underline" href="/faq">
            FAQ
          </a>
        </nav>
      </section>
    </main>
  );
}
