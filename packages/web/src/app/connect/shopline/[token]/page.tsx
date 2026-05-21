import { createAdminClient } from "@shared/supabase";
import {
  createSupabaseShoplineInvitationStore,
  findActiveInvitation,
  type ShoplineInvitation,
} from "@/lib/shopline/invitations";
import { getTranslations } from "next-intl/server";

type PageProps = {
  params: Promise<{ token: string }> | { token: string };
};

export const dynamic = "force-dynamic";

export default async function ShoplineInvitationPage({ params }: PageProps) {
  const { token } = await params;
  const t = await getTranslations("connect.shopline");
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
          title={t("errors.expired")}
          description={t("errors.expired")}
        />
      );
    }

    if (
      error instanceof Error &&
      error.message === "shopline_invitation_revoked"
    ) {
      return (
        <InvitationShell
          title={t("errors.revoked")}
          description={t("errors.revoked")}
        />
      );
    }

    return (
      <InvitationShell
        title={t("errors.invalid")}
        description={t("errors.invalid")}
      />
    );
  }

  return (
    <InvitationShell title={t("title")} description={t("subtitle")}>
      <form
        action={`/api/connect/shopline/${encodeURIComponent(token)}/install`}
        method="GET"
        className="mt-6 space-y-4"
      >
        <label className="block text-sm font-medium text-slate-800">
          {t("shopHandleLabel")}
          <input
            name="shopHandle"
            defaultValue={invitation.expectedShopHandle ?? ""}
            className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-base outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            placeholder={t("shopHandlePlaceholder")}
            required
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {t("authorizeButton")}
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
