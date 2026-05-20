import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSupabaseShoplineInvitationStore,
  findActiveInvitation,
  type ShoplineInvitation,
} from "@/lib/shopline/invitations";

type PageProps = {
  params: Promise<{ token: string }> | { token: string };
};

export const dynamic = "force-dynamic";

export default async function ShoplineInvitationPage({ params }: PageProps) {
  const { token } = await params;
  const store = createSupabaseShoplineInvitationStore(createAdminClient());

  let invitation: ShoplineInvitation;
  try {
    invitation = await findActiveInvitation(store, token);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "shopline_invitation_expired"
    ) {
      return (
        <InvitationShell
          title="連結已過期"
          description="連結已過期，請聯絡 1waySEO 取得新連結"
        />
      );
    }

    if (
      error instanceof Error &&
      error.message === "shopline_invitation_revoked"
    ) {
      return (
        <InvitationShell
          title="連結已撤銷"
          description="此 SHOPLINE 綁定連結已撤銷。"
        />
      );
    }

    return (
      <InvitationShell
        title="連結無效"
        description="此 SHOPLINE 綁定連結不存在或已無法使用。"
      />
    );
  }

  return (
    <InvitationShell
      title="綁定您的 SHOPLINE 商店"
      description="授權後 1waySEO 將可代您管理商品 SEO"
    >
      <form
        action={`/api/connect/shopline/${encodeURIComponent(token)}/install`}
        method="GET"
        className="mt-6 space-y-4"
      >
        <label className="block text-sm font-medium text-slate-800">
          SHOPLINE 商店代號
          <input
            name="shopHandle"
            defaultValue={invitation.expectedShopHandle ?? ""}
            className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-base outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            placeholder="your-store"
            required
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          前往 SHOPLINE 授權
        </button>
      </form>
    </InvitationShell>
  );
}

function InvitationShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-950">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <img src="/logo.svg" alt="1waySEO" className="mb-6 h-10 w-auto" />
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
        {children}
      </section>
    </main>
  );
}
