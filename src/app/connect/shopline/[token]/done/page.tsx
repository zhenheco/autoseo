type DonePageProps = {
  searchParams?: Promise<{ shop?: string }> | { shop?: string };
};

export default async function ShoplineInvitationDonePage({
  searchParams,
}: DonePageProps) {
  const params = searchParams ? await searchParams : {};
  const shopHandle = params.shop?.trim();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-950">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-emerald-50 text-2xl font-semibold text-emerald-700">
          ✓
        </div>
        <h1 className="text-2xl font-semibold">SHOPLINE 商店已成功綁定</h1>
        {shopHandle ? (
          <p className="mt-3 text-base font-medium text-slate-800">
            {shopHandle}
          </p>
        ) : null}
        <p className="mt-4 text-sm leading-6 text-slate-600">
          您可關閉此頁面，1waySEO 團隊將開始為您管理 SEO
        </p>
      </section>
    </main>
  );
}
