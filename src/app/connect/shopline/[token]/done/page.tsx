import { getTranslations } from "next-intl/server";

type DonePageProps = {
  searchParams?: Promise<{ shop?: string }> | { shop?: string };
};

export default async function ShoplineInvitationDonePage({
  searchParams,
}: DonePageProps) {
  const params = searchParams ? await searchParams : {};
  const shopHandle = params.shop?.trim();
  const t = await getTranslations("connect.shopline");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-950">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">{t("done.title")}</h1>
        {shopHandle ? (
          <p className="mt-3 text-base font-medium text-slate-800">
            <span className="sr-only">{t("done.shopLabel")}: </span>
            {shopHandle}
          </p>
        ) : null}
        <p className="mt-4 text-sm leading-6 text-slate-600">
          {t("done.instruction")}
        </p>
      </section>
    </main>
  );
}
